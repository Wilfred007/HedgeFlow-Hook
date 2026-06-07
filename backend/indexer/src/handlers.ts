import { Pool as PgPool } from 'pg';
import { ethers } from 'ethers';
import { RiskMode, POOL_MANAGER_ABI } from '@hedgeflow/shared';

const RISK_MODE_MAP: Record<number, RiskMode> = {
  0: RiskMode.NORMAL,
  1: RiskMode.ELEVATED,
  2: RiskMode.DEFENSIVE,
  3: RiskMode.CRISIS,
};

const poolManagerIface = new ethers.Interface(POOL_MANAGER_ABI as unknown as string[]);
const POOL_MANAGER_SWAP_TOPIC = poolManagerIface.getEvent('Swap')!.topicHash;

/// ─── Swap handler ─────────────────────────────────────────────────────────────

export async function handleSwapExecuted(
  db: PgPool,
  log: ethers.Log,
  parsed: ethers.LogDescription,
  blockNumber: number,
  provider: ethers.Provider,
  poolManagerAddress: string
): Promise<void> {
  const { poolId, sender, feeBps, riskMode, timestamp } = parsed.args;

  let amountIn = 0n;
  let amountOut = 0n;
  let spotPrice = '0';
  try {
    const receipt = await provider.getTransactionReceipt(log.transactionHash);
    for (const txLog of receipt?.logs ?? []) {
      if (
        txLog.topics[0] !== POOL_MANAGER_SWAP_TOPIC ||
        txLog.address.toLowerCase() !== poolManagerAddress.toLowerCase() ||
        txLog.topics[1] !== poolId
      ) continue;

      const s = poolManagerIface.parseLog(txLog);
      if (!s) continue;

      const a0: bigint = s.args.amount0;
      const a1: bigint = s.args.amount1;
      amountIn  = a0 > 0n ? a0 : a1 > 0n ? a1 : 0n;
      amountOut = a0 < 0n ? -a0 : a1 < 0n ? -a1 : 0n;

      // Real spot price from sqrtPriceX96: price = (sqrtPriceX96 / 2^96)^2
      const sqrtPriceX96: bigint = s.args.sqrtPriceX96;
      if (sqrtPriceX96 > 0n) {
        const q = Number(sqrtPriceX96) / Number(2n ** 96n);
        spotPrice = (q * q).toFixed(18);
      }
      break;
    }
  } catch (e) {
    console.warn('[Indexer] Could not extract swap amounts:', e);
  }

  await db.query(
    `INSERT INTO swaps
       (pool_id, trader, amount_in, amount_out, price, fee_bps, risk_mode, timestamp, tx_hash, block_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [
      poolId,
      sender,
      ethers.formatUnits(amountIn, 18),
      ethers.formatUnits(amountOut, 18),
      spotPrice,
      Number(feeBps),
      RISK_MODE_MAP[Number(riskMode)] ?? RiskMode.NORMAL,
      Number(timestamp),
      log.transactionHash,
      blockNumber,
    ]
  );
}

/// ─── LP add handler ───────────────────────────────────────────────────────────

export async function handleLiquidityAdded(
  db: PgPool,
  log: ethers.Log,
  parsed: ethers.LogDescription,
  txFrom: string
): Promise<void> {
  const { poolId, amount0, amount1, valueUSD, timestamp } = parsed.args;

  await db.query(
    `INSERT INTO lp_positions
       (user_address, pool_id, deposit_amount0, deposit_amount1, deposit_value_usd,
        deposit_timestamp, tx_hash_deposit)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      txFrom,
      poolId,
      ethers.formatUnits(amount0, 18),
      ethers.formatUnits(amount1, 18),
      ethers.formatUnits(valueUSD, 18),
      Number(timestamp),
      log.transactionHash,
    ]
  );
}

/// ─── LP remove handler ────────────────────────────────────────────────────────

export async function handleLiquidityRemoved(
  db: PgPool,
  log: ethers.Log,
  parsed: ethers.LogDescription,
  txFrom: string
): Promise<void> {
  const {
    poolId,
    withdrawAmount0, withdrawAmount1,
    ilAmountUSD, compensationUSD,
    timestamp,
  } = parsed.args;

  // Update the most recent open position for this LP + pool
  await db.query(
    `UPDATE lp_positions
     SET
       withdrawal_amount0    = $1,
       withdrawal_amount1    = $2,
       realized_il_usd       = $3,
       compensation_paid_usd = $4,
       withdrawal_timestamp  = $5,
       tx_hash_withdrawal    = $6
     WHERE id = (
       SELECT id FROM lp_positions
       WHERE LOWER(user_address) = LOWER($7)
         AND pool_id = $8
         AND withdrawal_timestamp IS NULL
       ORDER BY deposit_timestamp DESC
       LIMIT 1
     )`,
    [
      ethers.formatUnits(withdrawAmount0, 18),
      ethers.formatUnits(withdrawAmount1, 18),
      ethers.formatUnits(ilAmountUSD, 18),
      ethers.formatUnits(compensationUSD, 18),
      Number(timestamp),
      log.transactionHash,
      txFrom,
      poolId,
    ]
  );
}

/// ─── Reserve event handler ────────────────────────────────────────────────────

export async function handleReserveAllocated(
  db: PgPool,
  log: ethers.Log,
  parsed: ethers.LogDescription,
  blockNumber: number,
  reserveVault: ethers.Contract
): Promise<void> {
  const { poolId: _poolId, token, amount, timestamp } = parsed.args;

  // Query the vault for the live post-deposit balance
  let reserveBalance = '0';
  try {
    const balance: bigint = await reserveVault.reserveBalance(token);
    reserveBalance = ethers.formatUnits(balance, 18);
  } catch (e) {
    console.warn('[Indexer] Could not fetch reserve balance:', e);
  }

  await db.query(
    `INSERT INTO reserve_events
       (event_type, token, amount, reserve_balance, timestamp, tx_hash, block_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [
      'DEPOSIT',
      token,
      ethers.formatUnits(amount, 18),
      reserveBalance,
      Number(timestamp),
      log.transactionHash,
      blockNumber,
    ]
  );
}

/// ─── Risk mode handler ────────────────────────────────────────────────────────

export async function handleRiskModeUpdated(
  db: PgPool,
  parsed: ethers.LogDescription
): Promise<void> {
  const { newMode, riskScore, timestamp } = parsed.args;

  // Compute reserve health from stored events rather than using a placeholder
  const [balRes, liabRes] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(CASE WHEN event_type = 'DEPOSIT' THEN amount::numeric
                                ELSE -amount::numeric END), 0) AS balance
       FROM reserve_events`
    ),
    db.query(
      `SELECT COALESCE(SUM(GREATEST(0, realized_il_usd::numeric - COALESCE(compensation_paid_usd::numeric, 0))), 0)
               AS pending
       FROM lp_positions
       WHERE realized_il_usd IS NOT NULL`
    ),
  ]);
  const balance = Number(balRes.rows[0]?.balance ?? 0);
  const pending = Number(liabRes.rows[0]?.pending ?? 0);
  const reserveHealth = pending > 0 ? (balance / pending).toFixed(4) : '1';

  await db.query(
    `INSERT INTO risk_snapshots
       (risk_score, risk_mode, volatility_score, liquidity_stress_score,
        whale_activity_score, reserve_pressure_score, reserve_health, timestamp)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      Number(riskScore),
      RISK_MODE_MAP[Number(newMode)] ?? RiskMode.NORMAL,
      0, 0, 0, 0,
      reserveHealth,
      Number(timestamp),
    ]
  );
}
