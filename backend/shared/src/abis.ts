// ─── HedgeFlow Contract ABIs (minimal — events + key functions) ───────────────

export const HEDGEFLOW_HOOK_ABI = [
  // Events
  'event LiquidityAdded(address indexed lp, bytes32 indexed poolId, uint256 amount0, uint256 amount1, uint256 valueUSD, uint256 timestamp)',
  'event LiquidityRemoved(address indexed lp, bytes32 indexed poolId, uint256 withdrawAmount0, uint256 withdrawAmount1, uint256 ilAmountUSD, uint256 compensationUSD, uint256 timestamp)',
  'event SwapExecuted(bytes32 indexed poolId, address indexed sender, uint24 feeBps, uint8 riskMode, uint256 timestamp)',
  'event ReserveAllocated(bytes32 indexed poolId, address indexed token, uint256 amount, uint256 timestamp)',
  'event ProtocolPaused()',
  'event ProtocolResumed()',
  // Read
  'function paused() view returns (bool)',
  'function getPosition(address lp, bytes32 poolId) view returns (tuple(uint256 depositAmount0, uint256 depositAmount1, uint256 depositPrice0USD, uint256 depositPrice1USD, uint256 depositValueUSD, uint256 depositTimestamp, bool exists))',
] as const;

export const RISK_MANAGER_ABI = [
  // Events
  'event RiskModeUpdated(uint8 indexed oldMode, uint8 indexed newMode, uint256 riskScore, uint256 timestamp)',
  'event RiskScoreUpdated(uint256 riskScore, uint256 timestamp)',
  // Read
  'function getMode() view returns (uint8)',
  'function getRiskScore() view returns (uint256)',
  'function getCurrentFeeBps() view returns (uint24)',
  'function getProtectionRatioBps() view returns (uint256)',
  // Write
  'function setRiskMode(uint8 mode, uint256 riskScore)',
] as const;

export const RESERVE_VAULT_ABI = [
  // Events
  'event ReserveDeposited(address indexed token, uint256 amount, uint256 newBalance)',
  'event CompensationPaid(address indexed lp, address indexed token, uint256 amount)',
  'event ReserveHealthUpdated(uint256 reserveBalance, uint256 estimatedLiabilities, uint256 healthBps)',
  // Read
  'function reserveBalance(address token) view returns (uint256)',
  'function totalCompensationsPaid(address token) view returns (uint256)',
  'function reserveHealth(address token) view returns (uint256)',
  'function canPay(address token, uint256 amount) view returns (bool)',
] as const;

export const ORACLE_MANAGER_ABI = [
  'function getPrice(address token) view returns (uint256)',
  'function isPriceFresh(address token) view returns (bool)',
  'function updatePrice(address token, uint256 primaryPrice, uint256 secondaryPrice)',
] as const;

export const POOL_MANAGER_ABI = [
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
] as const;
