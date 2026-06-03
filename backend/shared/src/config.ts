import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // ── Blockchain ──────────────────────────────────────────────────────────────
  rpcUrl:              optional('RPC_URL', 'http://localhost:8545'),
  chainId:             parseInt(optional('CHAIN_ID', '84532')), // Base Sepolia
  startBlock:          parseInt(optional('START_BLOCK', '0')),

  // ── Contract addresses ──────────────────────────────────────────────────────
  hedgeflowHook:       optional('HEDGEFLOW_HOOK', ''),
  riskManager:         optional('RISK_MANAGER', ''),
  reserveVault:        optional('RESERVE_VAULT', ''),
  oracleManager:       optional('ORACLE_MANAGER', ''),
  poolManager:         optional('POOL_MANAGER_ADDRESS', ''),

  // ── Database ────────────────────────────────────────────────────────────────
  databaseUrl:         optional('DATABASE_URL', 'postgresql://hedgeflow:hedgeflow@localhost:5432/hedgeflow'),

  // ── Redis ───────────────────────────────────────────────────────────────────
  redisUrl:            optional('REDIS_URL', 'redis://localhost:6379'),

  // ── Risk Engine ─────────────────────────────────────────────────────────────
  riskEngineUrl:       optional('RISK_ENGINE_URL', 'http://localhost:8000'),

  // ── Automation ──────────────────────────────────────────────────────────────
  automationPrivateKey: optional('AUTOMATION_PRIVATE_KEY', ''),
  automationInterval:   parseInt(optional('AUTOMATION_INTERVAL_MS', '60000')), // 1 min

  // ── API ─────────────────────────────────────────────────────────────────────
  apiPort:             parseInt(optional('API_PORT', '3001')),

  // ── HedgeFlow / xAI ──────────────────────────────────────────────────────────────
  HedgeFlowApiKey:          optional('HedgeFlow_API_KEY', ''),
  HedgeFlowApiUrl:          optional('HedgeFlow_API_URL', 'https://api.x.ai/v1'),
} as const;
