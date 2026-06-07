/**
 * HedgeFlow Automation Layer
 *
 * Every AUTOMATION_INTERVAL_MS:
 *   1. Fetches real pool analytics from the API
 *   2. Calls /risk/score on the risk engine with real data
 *   3. Saves the result as a snapshot to the DB
 *   4. If the risk mode changed, calls setRiskMode() on the RiskManager contract
 */

import axios from 'axios';
import { ethers } from 'ethers';
import { Pool as PgPool } from 'pg';
import { config, RISK_MANAGER_ABI, ORACLE_MANAGER_ABI } from '@hedgeflow/shared';

// ─── Types (snake_case — matching FastAPI response) ───────────────────────────

interface EngineResponse {
  risk_score:          number;
  risk_mode:           string;
  recommended_fee_bps: number;
  components: {
    volatility:       number;
    liquidity_stress: number;
    whale_activity:   number;
    reserve_pressure: number;
  };
  sentiment: { score: number; label: string } | null;
  timestamp: number;
}

interface PoolAnalytics {
  swapCount24h:     number;
  volume24hUsd:     string;
  currentRiskMode:  string;
  currentRiskScore: number;
  reserveHealth:    string;
  totalLPs:         number;
  totalILPaidUsd:   string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL   = process.env.API_URL        ?? 'http://localhost:3001';
const POOL_ID   = process.env.DEMO_POOL_ID   ?? '';
const TOKEN0    = process.env.TOKEN0         ?? '';
const TOKEN1    = process.env.TOKEN1         ?? '';
// Fixed 1 USD price in 18-decimal wei — sufficient for testnet oracle
const PRICE_1E18 = ethers.parseUnits('1', 18);

const RISK_MODE_TO_UINT: Record<string, number> = {
  NORMAL: 0, ELEVATED: 1, DEFENSIVE: 2, CRISIS: 3,
};
const UINT_TO_MODE: Record<number, string> = {
  0: 'NORMAL', 1: 'ELEVATED', 2: 'DEFENSIVE', 3: 'CRISIS',
};

// ─── State ────────────────────────────────────────────────────────────────────

let lastOnChainMode: string | null = null;
let consecutiveErrors = 0;
const MAX_ERRORS = 20;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[Automation] Starting HedgeFlow automation layer...');
  console.log(`[Automation] Risk Engine : ${config.riskEngineUrl}`);
  console.log(`[Automation] API         : ${API_URL}`);
  console.log(`[Automation] Pool ID     : ${POOL_ID}`);
  console.log(`[Automation] RiskManager : ${config.riskManager}`);
  console.log(`[Automation] Interval    : ${config.automationInterval}ms`);

  if (!config.automationPrivateKey) {
    console.error('[Automation] AUTOMATION_PRIVATE_KEY not set — exiting');
    process.exit(1);
  }

  const db = new PgPool({ connectionString: config.databaseUrl });

  const provider   = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet     = new ethers.Wallet(config.automationPrivateKey, provider);
  const riskMgr    = new ethers.Contract(
    config.riskManager,
    RISK_MANAGER_ABI as unknown as string[],
    wallet
  );
  const oracleMgr  = config.oracleManager
    ? new ethers.Contract(config.oracleManager, ORACLE_MANAGER_ABI as unknown as string[], wallet)
    : null;

  console.log(`[Automation] Wallet: ${wallet.address}`);

  try {
    const mode = await riskMgr.getMode();
    lastOnChainMode = UINT_TO_MODE[Number(mode)] ?? 'NORMAL';
    console.log(`[Automation] On-chain mode: ${lastOnChainMode}`);
  } catch {
    lastOnChainMode = 'NORMAL';
  }

  while (true) {
    try {
      await tick(riskMgr, oracleMgr, db);
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      console.error(`[Automation] Tick error (${consecutiveErrors}/${MAX_ERRORS}):`, err);
      if (consecutiveErrors >= MAX_ERRORS) {
        console.error('[Automation] Too many errors — exiting');
        process.exit(1);
      }
    }
    await sleep(config.automationInterval);
  }
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

async function tick(riskMgr: ethers.Contract, oracleMgr: ethers.Contract | null, db: PgPool): Promise<void> {
  // 0. Refresh oracle prices so the hook can record LP positions
  if (oracleMgr && TOKEN0 && TOKEN1) {
    try {
      // Only send TXs for tokens whose price is actually stale
      const [fresh0, fresh1]: [boolean, boolean] = await Promise.all([
        oracleMgr.isPriceFresh(TOKEN0).catch(() => false),
        oracleMgr.isPriceFresh(TOKEN1).catch(() => false),
      ]);

      if (!fresh0 || !fresh1) {
        // Fetch confirmed nonce to avoid colliding with any mempool remnants
        const nonce = await oracleMgr.runner!.provider!.getTransactionCount(
          await (oracleMgr.runner as ethers.Wallet).getAddress(), 'latest'
        );
        const gasOpts = { gasLimit: 100_000, maxFeePerGas: ethers.parseUnits('25', 'gwei'), maxPriorityFeePerGas: ethers.parseUnits('6', 'gwei') };
        let n = nonce;
        if (!fresh0) {
          const tx = await oracleMgr.updatePrice(TOKEN0, PRICE_1E18, PRICE_1E18, { ...gasOpts, nonce: n++ });
          await Promise.race([tx.wait(), new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 30_000))]);
        }
        if (!fresh1) {
          const tx = await oracleMgr.updatePrice(TOKEN1, PRICE_1E18, PRICE_1E18, { ...gasOpts, nonce: n });
          await Promise.race([tx.wait(), new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 30_000))]);
        }
        console.log('[Automation] Oracle prices refreshed');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[Automation] Oracle price refresh failed:', msg.slice(0, 120));
    }
  }

  // 1. Fetch pool analytics from API
  let analytics: PoolAnalytics | null = null;
  try {
    const { data } = await axios.get<PoolAnalytics>(
      `${API_URL}/api/pools/${POOL_ID}/analytics`,
      { timeout: 5_000 }
    );
    analytics = data;
  } catch (e) {
    console.warn('[Automation] Could not fetch pool analytics — using defaults');
  }

  // 2. Fetch recent swap amounts for whale activity scoring
  let swapAmounts: number[] = [];
  try {
    const { data: swaps } = await axios.get<Array<{ amount_in: string }>>(
      `${API_URL}/api/pools/${POOL_ID}/swaps?limit=100`,
      { timeout: 5_000 }
    );
    swapAmounts = swaps
      .map(s => Number(s.amount_in ?? 0))
      .filter(a => a > 0);
  } catch {
    console.warn('[Automation] Could not fetch swap amounts — whale scoring will be skipped');
  }

  // 3. Fetch real price history from on-chain swap data
  let prices: Array<{ price: number; timestamp: number }> = [];
  try {
    const { data } = await axios.get<Array<{ price: number; timestamp: number }>>(
      `${API_URL}/api/pools/${POOL_ID}/price-history?limit=50`,
      { timeout: 5_000 }
    );
    prices = data.filter(p => p.price > 0);
  } catch {
    console.warn('[Automation] Could not fetch price history — using fallback');
  }

  // Pad to at least 2 points so the volatility formula can run
  if (prices.length < 2) {
    const basePrice = prices.length === 1 ? prices[0].price : 1.0; // 1:1 pool init ratio
    const now = Math.floor(Date.now() / 1000);
    prices = Array.from({ length: 50 }, (_, i) => ({
      price:     basePrice,
      timestamp: now - (50 - i) * 300,
    }));
  } else if (prices.length < 50) {
    // Pad the older end with the earliest known price (contributes 0 extra volatility)
    const earliest = prices[0];
    const pad = Array.from({ length: 50 - prices.length }, (_, i) => ({
      price:     earliest.price,
      timestamp: earliest.timestamp - (50 - prices.length - i) * 300,
    }));
    prices = [...pad, ...prices];
  }

  // 4. Build PoolMetrics for risk engine
  const volume    = Number(analytics?.volume24hUsd ?? 0);
  const totalLPs  = Number(analytics?.totalLPs ?? 1);
  const rHealth   = Number(analytics?.reserveHealth ?? 1);
  const estTvl    = Math.max(totalLPs * 5_000, 50_000);
  const estReserve = estTvl * 0.05;
  const estLiab   = rHealth > 0.01 ? estReserve / rHealth : estReserve * 2;

  const poolMetrics = {
    pool_id:           POOL_ID || '0xdemo',
    prices,
    tvl_usd:           estTvl,
    volume_24h_usd:    volume,
    reserve_balance:   estReserve,
    total_liabilities: estLiab,
  };

  // 5. Call risk engine
  const { data: out } = await axios.post<EngineResponse>(
    `${config.riskEngineUrl}/risk/score`,
    { pool_metrics: poolMetrics, swap_amounts: swapAmounts, include_sentiment: true },
    { timeout: 15_000 }
  );

  const newMode   = out.risk_mode;
  const riskScore = out.risk_score;

  console.log(
    `[Automation] Score: ${riskScore.toFixed(1)} → mode: ${newMode} ` +
    `(on-chain: ${lastOnChainMode ?? 'unknown'})`
  );

  // 6. Persist snapshot to DB every tick
  await db.query(
    `INSERT INTO risk_snapshots
       (risk_score, risk_mode, volatility_score, liquidity_stress_score,
        whale_activity_score, reserve_pressure_score, reserve_health, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      riskScore,
      newMode,
      out.components.volatility,
      out.components.liquidity_stress,
      out.components.whale_activity,
      out.components.reserve_pressure,
      String(rHealth),
      out.timestamp,
    ]
  );
  console.log(`[Automation] Snapshot saved`);

  // 7. Push on-chain only when mode changes
  if (newMode === lastOnChainMode) {
    console.log('[Automation] Mode unchanged — no tx needed');
    return;
  }

  console.log(`[Automation] Mode change: ${lastOnChainMode} → ${newMode}`);
  const modeUint = RISK_MODE_TO_UINT[newMode] ?? 0;
  try {
    const tx = await riskMgr.setRiskMode(modeUint, Math.round(riskScore), {
      gasLimit: 300_000,
      maxFeePerGas: ethers.parseUnits('5', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
    });
    console.log(`[Automation] Tx: ${tx.hash}`);
    // 30-second timeout — a dropped TX must not block the tick loop
    const receipt = await Promise.race([
      tx.wait(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('tx.wait() timed out after 30s')), 30_000)
      ),
    ]);
    console.log(`[Automation] Confirmed block ${(receipt as Awaited<ReturnType<typeof tx.wait>>)!.blockNumber}`);
    lastOnChainMode = newMode;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[Automation] setRiskMode failed (will retry next tick): ${msg.slice(0, 120)}`);
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prevent ECONNRESET / socket hang-up from killing the process — the tick
// loop already has try/catch; these are stray async network errors.
process.on('uncaughtException', (err) => {
  console.warn('[Automation] Uncaught exception (continuing):', (err as Error).message?.slice(0, 120));
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Automation] Unhandled rejection (continuing):', String(reason).slice(0, 120));
});

main().catch(err => {
  console.error('[Automation] Fatal:', err);
  process.exit(1);
});
