# HedgeFlow

**Adaptive liquidity protection for Uniswap v4 — powered by dynamic fees, reserve-backed IL compensation, and an AI risk engine.**

HedgeFlow is a Uniswap v4 hook protocol that protects liquidity providers from impermanent loss. It continuously monitors on-chain conditions, classifies risk into one of four modes, adjusts trading fees dynamically, and compensates LPs from a shared reserve vault when they suffer losses. An AI layer (Groq LLM) blends real-time market sentiment into the risk score, and Reactive Network automation keeps the on-chain risk mode in sync with off-chain analysis.

---

## Table of Contents

- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Risk Scoring](#risk-scoring)
- [Smart Contracts](#smart-contracts)
- [Deployed Addresses](#deployed-addresses)
- [Backend Services](#backend-services)
- [Frontend](#frontend)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Key Design Decisions](#key-design-decisions)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Unichain Sepolia                         │
│                                                                 │
│  PoolManager ──► HedgeFlowHook ──► RiskManager                 │
│                       │                  │                      │
│                       ▼                  ▼                      │
│               ReserveVault         OracleManager                │
│               ILCalculator         FeeRouter                    │
│               EmergencyController                               │
└─────────────────────────────────────────────────────────────────┘
              ▲                              ▲
              │ events                       │ setRiskMode()
              │                              │
┌─────────────┴──────────────────────────────┴─────────────────────┐
│                         Off-chain Layer                          │
│                                                                  │
│  Indexer ──► PostgreSQL ◄── API ◄── Frontend (Next.js)          │
│                  ▲                                               │
│  Automation ─────┘                                               │
│      │                                                           │
│      └──► Risk Engine (FastAPI + Groq AI) ──► Redis cache       │
└──────────────────────────────────────────────────────────────────┘
              ▲
              │ cross-chain automation
┌─────────────┴────────────────┐
│     Reactive Network (Lasna) │
│     HedgeFlowReactive        │
└──────────────────────────────┘
```

---

## How It Works

### Every Swap

1. A trader swaps through the Uniswap v4 pool
2. The **HedgeFlowHook** intercepts the swap via `beforeSwap` / `afterSwap`
3. It reads the current risk mode from **RiskManager** and applies the corresponding fee
4. A portion of the fee is allocated to the **ReserveVault**
5. The swap is recorded on-chain and indexed off-chain

### Every 60 Seconds

1. The **Automation** service fetches pool analytics from the API
2. It retrieves real price history derived from on-chain `sqrtPriceX96` values and recent swap amounts
3. It calls the **Risk Engine** with all metrics
4. The Risk Engine scores the pool across four components and optionally blends in AI sentiment from **Groq**
5. The result is persisted to PostgreSQL and cached in Redis
6. If the risk mode changed, the Automation sends a transaction calling `RiskManager.setRiskMode()`

### When an LP Withdraws

1. The hook calculates impermanent loss at withdrawal time
2. The **ILCalculator** computes the USD difference between the held vs. provided value
3. The **ReserveVault** compensates the LP up to the available reserve balance
4. Compensation is first-come-first-served — the vault pays until funds are exhausted

---

## Risk Scoring

The risk engine produces a score from **0–100** using a weighted formula:

```
Risk Score = 40% × Volatility
           + 30% × Liquidity Stress
           + 20% × Whale Activity
           + 10% × Reserve Pressure
           + (optional) blended with 20% AI Sentiment
```

| Component | Description |
|---|---|
| **Volatility** | Annualised standard deviation of log returns from real on-chain `sqrtPriceX96` price history |
| **Liquidity Stress** | 24h volume ÷ TVL — high trading activity relative to pool size |
| **Whale Activity** | Percentage of swaps exceeding 1% of pool TVL in size |
| **Reserve Pressure** | Reserve balance relative to pending LP liabilities |
| **AI Sentiment** | Groq `llama-3.3-70b-versatile` classifies market as FEAR / NEUTRAL / GREED and returns a 0–100 score |

### Risk Modes

| Mode | Score | Fee | IL Cover | Description |
|---|---|---|---|---|
| **NORMAL** | 0–30 | 0.30% | 20% | Standard market conditions |
| **ELEVATED** | 31–55 | 0.60% | 30% | Increased volatility detected |
| **DEFENSIVE** | 56–80 | 1.20% | 40% | High stress — fees doubled |
| **CRISIS** | 81–100 | 2.50% | 50% | Extreme conditions — maximum protection |

---

## Smart Contracts

| Contract | Description |
|---|---|
| `HedgeFlowHook` | Uniswap v4 hook — intercepts swaps, applies dynamic fees, emits events |
| `RiskManager` | Stores the current risk mode on-chain; only the authorised automation wallet can update it |
| `ReserveVault` | Holds accumulated fees; pays out IL compensation to withdrawing LPs |
| `ILCalculator` | Computes impermanent loss in USD at withdrawal time |
| `OracleManager` | Price registry — push-based, supports dual-feed deviation checks with configurable max age |
| `FeeRouter` | Routes fee splits between the reserve vault and protocol treasury |
| `EmergencyController` | Owner-controlled pause/unpause of the entire protocol |
| `HedgeFlowReactive` | Reactive Network contract — enables cross-chain event-driven automation |
| `HedgeFlowMath` | Shared math library for IL calculations and fee curve logic |

---

## Deployed Addresses

### Unichain Sepolia (Chain ID: 1301) — Deployed 2026-06-03

| Contract | Address |
|---|---|
| HedgeFlowHook | `0x3A3d97eBC316426B0f94DF5fD22352EA3Cf489C1` |
| RiskManager | `0x8d4ed7b20d9d7344994448872d46Cb687d9995bd` |
| ReserveVault | `0xd56f8DBbd3376c6c72383245c76933FA2e9B0fBd` |
| OracleManager | `0x7F084b3245b1FCFC44B2f55c2a2047ae33e9d5a8` |
| FeeRouter | `0xDddB586f219291d28aEf584Ea867f28C7BE1c49B` |
| ILCalculator | `0xd29EEf8790Db194c670C6998e180CEce204DCd41` |
| EmergencyController | `0xD46f2e8f6778bC842ac081Ce6CC96037Fc825052` |
| Uniswap v4 PoolManager | `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` |
| Test Pool ID (tWETH/tUSDC) | `0xab93ee9c614b5f8355e9cb8c2379613e09a5411be72622ce4ad757620c6d3f4f` |
| TestRouter | `0x6067c0ed54A28AD7ff1434AA4f5D0eA91Ea878De` |

### Reactive Network — Lasna Testnet (Chain ID: 5318007) — Deployed 2026-06-03

| Contract | Address |
|---|---|
| HedgeFlowReactive | `0x2e9e978149b3aa1704fA39c26b4adE29fcD8B82D` |

> **Note:** HedgeFlow uses `DYNAMIC_FEE_FLAG`. Uniswap's default swap interface will not route through this pool — swaps must go through the protocol's custom router or a direct integration.

---

## Backend Services

The off-chain backend is a Node.js / Python monorepo with four services, orchestrated via Docker Compose.

### Indexer (`backend/indexer`)
- Polls Unichain Sepolia for new blocks every 5 seconds in a persistent loop
- Listens for `SwapExecuted`, `LiquidityAdded`, `LiquidityRemoved`, `ReserveAllocated`, and `RiskModeUpdated` events
- Extracts real swap amounts (`amount0`, `amount1`) and spot prices (`sqrtPriceX96`) from the Uniswap v4 PoolManager `Swap` event
- Queries `ReserveVault.reserveBalance()` on-chain after each deposit event
- Computes reserve health from actual DB deposit and liability records
- Writes all data to PostgreSQL

### Risk Engine (`backend/risk-engine`)
- FastAPI service (Python)
- Implements the weighted scoring formula across all four components
- Optionally calls Groq API for AI sentiment and blends it at 20% weight
- Caches the latest snapshot in Redis with a 5-minute TTL, with in-memory fallback
- Exposes `POST /risk/score`, `GET /risk/latest`, `GET /risk/demo`, `GET /health`

### Automation (`backend/automation`)
- Runs every 60 seconds
- Fetches pool analytics and real `sqrtPriceX96`-derived price history from the API
- Passes live swap amounts to the risk engine for whale activity scoring
- Persists the risk snapshot to PostgreSQL
- Sends `setRiskMode()` on-chain only when the mode has changed (gas-efficient — no unnecessary transactions)
- Recovers automatically from transient RPC errors up to 5 consecutive failures

### API (`backend/api`)
- Express REST API serving the frontend
- Endpoints:

| Endpoint | Description |
|---|---|
| `GET /api/pools/:poolId/analytics` | 24h volume, swap count, current risk mode, LP count, reserve health |
| `GET /api/pools/:poolId/swaps` | Recent swaps with amounts, prices, fees |
| `GET /api/pools/:poolId/price-history` | On-chain spot price history for volatility charts |
| `GET /api/lp/:address/positions` | Open LP positions |
| `GET /api/lp/:address/history` | Closed positions with IL and compensation data |
| `GET /api/reserve/:token` | Reserve vault stats per token |
| `GET /api/risk/snapshots` | Historical risk score snapshots |
| `GET /api/risk/current` | Latest risk snapshot |

---

## Frontend

Next.js 15 application with a cinematic landing page and a real-time analytics dashboard.

### Pages

| Route | Description |
|---|---|
| `/` | Immersive landing page with Three.js WebGL environment |
| `/dashboard` | Live protocol metrics — risk score, mode, volume, LPs, reserve health |
| `/analytics` | Risk score history chart, recent swaps table, risk mode reference |
| `/positions` | LP position tracker with IL and compensation history |
| `/test-pool` | Swap interface for the tWETH/tUSDC test pool |
| `/chat` | AI advisor powered by Groq streaming completions |

### Landing Page

Built to award-winning quality with:
- Cinematic split-panel loader with animated counter and scanning lines
- Three.js WebGL scene — orbital rings, glass icosahedron, layered particle fields, mouse-reactive lighting
- GSAP ScrollTrigger for scroll-driven section transitions
- Lenis smooth scrolling
- Editorial hero with oversized mixed-weight typography and line-mask character reveals
- Custom morphing cursor system

---

## Tech Stack

### Smart Contracts
- Solidity `^0.8.24`
- Foundry (forge, cast, anvil)
- Uniswap v4 Core
- Reactive Network SDK

### Backend
- **Node.js 22 / TypeScript** — Indexer, Automation, API
- **Python 3.11 / FastAPI** — Risk Engine
- **PostgreSQL 16** — Primary data store
- **Redis 7** — Risk snapshot cache
- **ethers.js v6** — On-chain reads and writes
- **Groq API** — AI sentiment analysis (`llama-3.3-70b-versatile`)
- **Docker / Docker Compose** — Container orchestration

### Frontend
- **Next.js 15** / React 19 / TypeScript
- **Three.js** + **React Three Fiber** + **@react-three/drei**
- **GSAP 3** (ScrollTrigger, SplitText)
- **Lenis** — smooth scroll
- **Framer Motion**
- **Privy** — embedded wallet authentication
- **Wagmi v2** — Ethereum interactions
- **TailwindCSS**

---

## Local Development

### Prerequisites

- Node.js 22+
- Docker Desktop
- Foundry — `curl -L https://foundry.paradigm.xyz | bash`
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone and install

```bash
git clone https://github.com/Wilfred007/HedgeFlow-Hook.git
cd HedgeFlow-Hook

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your private key, Groq API key, and WalletConnect project ID
```

### 3. Start the backend

```bash
docker compose up -d
```

Check everything is running:

```bash
docker compose ps

# Watch the risk scoring loop
docker compose logs -f automation
```

### 4. Start the frontend

```bash
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy contracts (already live on Unichain Sepolia)

```bash
cd contracts

forge install
forge test -vvv

# Deploy
forge script script/DeployUnichain.s.sol \
  --rpc-url https://sepolia.unichain.org \
  --broadcast -vvvv
```

---

## Environment Variables

Create a `.env` file at the project root:

```env
# ── Blockchain ────────────────────────────────────────────────────
RPC_URL=https://sepolia.unichain.org
CHAIN_ID=1301
START_BLOCK=53000000

# ── Uniswap v4 ────────────────────────────────────────────────────
POOL_MANAGER_ADDRESS=0x00B036B58a818B1BC34d502D3fE730Db729e62AC

# ── Contract Addresses ────────────────────────────────────────────
HEDGEFLOW_HOOK=0x093D70C6D2A7D8BC96e428Ad3A2362aF787549C1
RISK_MANAGER=0x57ADf72f1f43C18D3c11dCE2C107d49b9083eEB4
RESERVE_VAULT=0xA046d4bDb3CDc4ba92cA0939b1464aE1cAb6B025
ORACLE_MANAGER=0xC8b62a2F4A7B3E1dc8c3DC052d67428df1b5F1c2
FEE_ROUTER=0xf3c832A9E35762bc9Fd270D5399EC1FeF5D40273
IL_CALCULATOR=0x7E62b9Ab00952e5B19b5018703e68FeB665D4E9b
EMERGENCY_CONTROLLER=0x5434080F1AB9e78b9DAD5cf77e077c5E766F8A78

# ── Keys ──────────────────────────────────────────────────────────
DEPLOYER_PRIVATE_KEY=           # deployer wallet
AUTOMATION_PRIVATE_KEY=         # wallet that calls setRiskMode()

# ── Services ──────────────────────────────────────────────────────
DATABASE_URL=postgresql://hedgeflow:hedgeflow@localhost:5432/hedgeflow
REDIS_URL=redis://localhost:6379
RISK_ENGINE_URL=http://localhost:8000
API_PORT=3001

# ── AI ────────────────────────────────────────────────────────────
HedgeFlow_API_KEY=              # Groq API key (gsk_...)
HedgeFlow_API_URL=https://api.groq.com/openai/v1

# ── Frontend ──────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_DEMO_POOL_ID=0x06fd0bd9f5516995db114d257958dcaca29beb4369a324adca85b4e0603118df
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # from cloud.walletconnect.com

# ── Reactive Network ──────────────────────────────────────────────
REACTIVE_RPC_URL=https://lasna-rpc.rnk.dev/
REACTIVE_CHAIN_ID=5318007
HEDGEFLOW_REACTIVE=0xabE58d409fE97863356059469E9aF9c4DFaD8BF4
```

---

## Project Structure

```
HedgeFlow/
├── contracts/                    # Foundry smart contract project
│   ├── src/
│   │   ├── hooks/
│   │   │   └── HedgeFlowHook.sol
│   │   ├── managers/
│   │   │   ├── RiskManager.sol
│   │   │   ├── OracleManager.sol
│   │   │   ├── ILCalculator.sol
│   │   │   ├── FeeRouter.sol
│   │   │   └── EmergencyController.sol
│   │   ├── vaults/
│   │   │   └── ReserveVault.sol
│   │   ├── reactive/
│   │   │   └── HedgeFlowReactive.sol
│   │   ├── libraries/
│   │   │   └── HedgeFlowMath.sol
│   │   └── interfaces/
│   ├── script/                   # Foundry deploy scripts
│   ├── test/                     # Foundry tests
│   └── foundry.toml
│
├── backend/                      # Node.js + Python monorepo
│   ├── shared/                   # Shared ABIs, config, types
│   ├── indexer/                  # On-chain event indexer (Node.js)
│   ├── automation/               # Risk scoring loop + on-chain updates (Node.js)
│   ├── api/                      # REST API (Express)
│   └── risk-engine/              # Risk scoring service (Python / FastAPI)
│
├── frontend/                     # Next.js 15 application
│   ├── app/
│   │   ├── (app)/                # Dashboard routes
│   │   │   ├── dashboard/
│   │   │   ├── analytics/
│   │   │   ├── positions/
│   │   │   ├── test-pool/
│   │   │   └── chat/
│   │   └── page.tsx              # Landing page
│   ├── components/
│   │   └── landing/              # Cinematic landing components
│   └── lib/
│
├── docker-compose.yml            # Full backend stack
├── .env.example
└── README.md
```

---

## Key Design Decisions

**Dynamic fees over static fees.** Uniswap v4's hook system allows fees to be set per-swap at runtime. HedgeFlow uses this to make the pool self-adjusting — no governance vote or manual intervention is needed to change fees as market conditions shift.

**No Uniswap router compatibility.** HedgeFlow sets `DYNAMIC_FEE_FLAG`, which Uniswap's default router explicitly skips when routing. This is a deliberate trade-off: the hook cannot be routed through the standard interface, but it gains full control over fee logic. Integrators must call the pool directly.

**Push oracle over pull oracle.** Unichain Sepolia has no live Chainlink or Pyth feeds. The `OracleManager` accepts price updates from an authorised source. In production this would be replaced with adapters pointing to live feeds. Real volatility data is sourced directly from the pool's `sqrtPriceX96` values, making the oracle only needed for USD pricing.

**First-come-first-served reserve model.** The reserve pays out IL compensation in order of withdrawal. This keeps the contract simple, gas-efficient, and avoids complex pro-rata accounting. LPs who withdraw during high-reserve periods are fully compensated; those who withdraw after depletion receive their liquidity but no IL payment.

**Reactive Network for cross-chain automation.** `HedgeFlowReactive` on Lasna testnet subscribes to Unichain Sepolia events and can trigger on-chain responses without a centralised keeper. This is complementary to the off-chain automation layer — the Reactive contract acts as an on-chain fallback.

**AI sentiment as an optional blend.** The Groq sentiment layer is additive — if the API key is missing or the call fails, the system degrades gracefully to purely statistical scoring. Sentiment influences at most 20% of the final score, keeping the output stable even when the AI layer is unavailable.

---

## License

MIT
