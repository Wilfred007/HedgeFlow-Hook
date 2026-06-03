/**
 * One-time backfill: updates swaps where amount_in = '0' by re-fetching
 * the PoolManager Swap event from each transaction's receipt.
 */
import { ethers } from 'ethers';
import { Pool as PgPool } from 'pg';
import { config, POOL_MANAGER_ABI } from '@hedgeflow/shared';

const poolManagerIface = new ethers.Interface(POOL_MANAGER_ABI as unknown as string[]);
const POOL_MANAGER_SWAP_TOPIC = poolManagerIface.getEvent('Swap')!.topicHash;

async function main() {
  const db     = new PgPool({ connectionString: config.databaseUrl });
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  const { rows } = await db.query(
    `SELECT id, pool_id, tx_hash FROM swaps WHERE amount_in = '0' ORDER BY timestamp ASC`
  );

  console.log(`[Backfill] Found ${rows.length} swaps to update`);

  for (const row of rows) {
    try {
      const receipt = await provider.getTransactionReceipt(row.tx_hash);
      let amountIn = 0n;
      let amountOut = 0n;
      let spotPrice = '0';

      for (const txLog of receipt?.logs ?? []) {
        if (
          txLog.topics[0] !== POOL_MANAGER_SWAP_TOPIC ||
          txLog.address.toLowerCase() !== config.poolManager.toLowerCase() ||
          txLog.topics[1] !== row.pool_id
        ) continue;

        const s = poolManagerIface.parseLog(txLog);
        if (!s) continue;

        const a0: bigint = s.args.amount0;
        const a1: bigint = s.args.amount1;
        amountIn  = a0 > 0n ? a0 : a1 > 0n ? a1 : 0n;
        amountOut = a0 < 0n ? -a0 : a1 < 0n ? -a1 : 0n;

        // Real spot price from sqrtPriceX96
        const sqrtPriceX96: bigint = s.args.sqrtPriceX96;
        if (sqrtPriceX96 > 0n) {
          const q = Number(sqrtPriceX96) / Number(2n ** 96n);
          spotPrice = (q * q).toFixed(18);
        }
        break;
      }

      if (amountIn === 0n && amountOut === 0n) {
        console.log(`[Backfill] No PoolManager Swap event found for tx ${row.tx_hash}`);
        continue;
      }

      await db.query(
        `UPDATE swaps SET amount_in = $1, amount_out = $2, price = $3 WHERE id = $4`,
        [
          ethers.formatUnits(amountIn, 18),
          ethers.formatUnits(amountOut, 18),
          spotPrice,
          row.id,
        ]
      );

      console.log(`[Backfill] Updated tx ${row.tx_hash.slice(0, 10)}… in=${ethers.formatUnits(amountIn, 18)} out=${ethers.formatUnits(amountOut, 18)} price=${spotPrice}`);
    } catch (e) {
      console.error(`[Backfill] Error on tx ${row.tx_hash}:`, e);
    }
  }

  console.log('[Backfill] Done');
  await db.end();
}

main().catch(err => {
  console.error('[Backfill] Fatal:', err);
  process.exit(1);
});
