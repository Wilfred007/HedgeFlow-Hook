import { NextRequest } from 'next/server';

const HedgeFlow_API_URL = process.env.HedgeFlow_API_URL ?? 'https://api.x.ai/v1';
const HedgeFlow_API_KEY = process.env.HedgeFlow_API_KEY ?? '';

const SYSTEM_PROMPT = `You are HedgeFlow's AI advisor, specialized in helping liquidity providers (LPs) make smart decisions on the HedgeFlow protocol — a Uniswap v4-based AMM with adaptive risk management and impermanent loss (IL) protection.

## HedgeFlow Risk Modes
The protocol operates in 4 modes based on a 0–100 risk score:
| Mode      | Score  | Fee    | IL Protection | When                          |
|-----------|--------|--------|---------------|-------------------------------|
| NORMAL    | 0–30   | 0.30%  | 20%           | Stable conditions             |
| ELEVATED  | 31–55  | 0.60%  | 30%           | Moderate volatility           |
| DEFENSIVE | 56–80  | 1.20%  | 40%           | High stress, doubled fees     |
| CRISIS    | 81–100 | 2.50%  | 50%           | Extreme conditions            |

## Risk Score Components
- Volatility (40%) — annualized price standard deviation
- Liquidity Stress (30%) — 24h trading volume relative to TVL
- Whale Activity (20%) — proportion of large trades (>1% of TVL)
- Reserve Pressure (10%) — insurance fund health ratio

## How IL Protection Works
When an LP removes liquidity, HedgeFlow's RiskManager calculates their impermanent loss. If the current risk mode's IL protection threshold is met, the ReserveVault compensates the LP for that percentage of their IL. Higher risk modes mean higher IL coverage.

## Your Role
Help LPs with:
- When to enter or exit positions based on the current risk mode and score
- Understanding impermanent loss and how HedgeFlow's IL compensation works
- Position sizing, range selection, and diversification strategies
- Reading market signals: what high volatility, whale activity, or liquidity stress means for them
- How fees compound at different risk levels
- General DeFi LP best practices (concentrated liquidity, rebalancing, gas optimization)

## Style
Be concise and practical. Use numbers when relevant. If they ask about current live data, direct them to the Dashboard page. Don't repeat the full mode table unless they ask — they can see it on the dashboard.`;

export async function POST(req: NextRequest) {
  if (!HedgeFlow_API_KEY) {
    return new Response(JSON.stringify({ error: 'HedgeFlow API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages } = await req.json() as { messages: { role: string; content: string }[] };

  const upstream = await fetch(`${HedgeFlow_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HedgeFlow_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(JSON.stringify({ error: text }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
