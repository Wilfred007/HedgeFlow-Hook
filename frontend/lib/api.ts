const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoolAnalytics {
  poolId: string;
  swapCount24h: number;
  volume24hUsd: string;
  avgFeeBps: number;
  currentRiskMode: string;
  currentRiskScore: number;
  reserveHealth: string;
  totalLPs: number;
  totalILPaidUsd: string;
}

export interface RiskSnapshot {
  id: number;
  risk_score: number;
  risk_mode: string;
  volatility_score: number;
  liquidity_stress_score: number;
  whale_activity_score: number;
  reserve_pressure_score: number;
  reserve_health: string;
  timestamp: number;
}

export interface LPPosition {
  id: number;
  user_address: string;
  pool_id: string;
  deposit_value_usd: string;
  withdrawal_value_usd?: string;
  realized_il_usd?: string;
  compensation_paid_usd?: string;
  deposit_timestamp: number;
  withdrawal_timestamp?: number;
}

export interface SwapRecord {
  id: number;
  pool_id: string;
  trader: string;
  amount_in: string;
  amount_out: string;
  fee_bps: number;
  risk_mode: string;
  timestamp: number;
  tx_hash: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export const api = {
  getPoolAnalytics: (poolId: string) =>
    get<PoolAnalytics>(`/api/pools/${poolId}/analytics`),

  getPoolSwaps: (poolId: string, limit = 50) =>
    get<SwapRecord[]>(`/api/pools/${poolId}/swaps?limit=${limit}`),

  getLPPositions: (address: string) =>
    get<LPPosition[]>(`/api/lp/${address}/positions`),

  getLPHistory: (address: string) =>
    get<{ positions: LPPosition[]; totals: { totalIL: number; totalCompensation: number } }>(
      `/api/lp/${address}/history`
    ),

  getRiskSnapshots: (limit = 100) =>
    get<RiskSnapshot[]>(`/api/risk/snapshots?limit=${limit}`),

  getCurrentRisk: () =>
    get<RiskSnapshot>(`/api/risk/current`),
};
