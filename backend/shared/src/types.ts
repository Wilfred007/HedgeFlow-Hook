// ─── HedgeFlow Shared Types ────────────────────────────────────────────────────

export enum RiskMode {
  NORMAL    = 'NORMAL',
  ELEVATED  = 'ELEVATED',
  DEFENSIVE = 'DEFENSIVE',
  CRISIS    = 'CRISIS',
}

export interface SwapEvent {
  id?: number;
  poolId: string;
  trader: string;
  amountIn: string;
  amountOut: string;
  price: string;
  feeBps: number;
  riskMode: RiskMode;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

export interface LPPosition {
  id?: number;
  userAddress: string;
  poolId: string;
  depositAmount0: string;
  depositAmount1: string;
  depositValueUsd: string;
  withdrawalAmount0?: string;
  withdrawalAmount1?: string;
  withdrawalValueUsd?: string;
  holdValueUsd?: string;
  realizedIlUsd?: string;
  compensationPaidUsd?: string;
  depositTimestamp: number;
  withdrawalTimestamp?: number;
  txHashDeposit: string;
  txHashWithdrawal?: string;
}

export interface ReserveEvent {
  id?: number;
  eventType: 'DEPOSIT' | 'COMPENSATION_PAID' | 'EMERGENCY_WITHDRAWAL';
  token: string;
  amount: string;
  reserveBalance: string;
  lp?: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

export interface RiskSnapshot {
  id?: number;
  riskScore: number;
  riskMode: RiskMode;
  volatilityScore: number;
  liquidityStressScore: number;
  whaleActivityScore: number;
  reservePressureScore: number;
  sentimentScore?: number;
  reserveHealth: string;
  timestamp: number;
}

export interface RiskEngineOutput {
  riskScore: number;
  riskMode: RiskMode;
  recommendedFeeBps: number;
  components: {
    volatility: number;
    liquidityStress: number;
    whaleActivity: number;
    reservePressure: number;
  };
  sentiment?: {
    score: number;
    label: string;
  };
  timestamp: number;
}

export interface PoolAnalytics {
  poolId: string;
  tvlUsd: string;
  volume24hUsd: string;
  feesCollected24hUsd: string;
  reserveBalance: string;
  currentRiskMode: RiskMode;
  currentFeeBps: number;
  totalLPs: number;
  totalILPaid: string;
}
