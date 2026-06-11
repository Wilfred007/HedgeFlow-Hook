/**
 * HedgeFlow REST API
 *
 * Endpoints:
 *   GET /api/pools/:poolId/analytics     — pool analytics
 *   GET /api/pools/:poolId/swaps         — recent swaps
 *   GET /api/lp/:address/positions       — LP positions
 *   GET /api/lp/:address/history         — LP IL + compensation history
 *   GET /api/reserve/:token              — reserve stats
 *   GET /api/risk/snapshots              — risk history
 *   GET /api/risk/current                — current risk mode
 *   GET /health                          — health check
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { config } from '@hedgeflow/shared';

const app = express();
app.use(cors());
app.use(express.json());

const db = new Pool({ connectionString: config.databaseUrl });

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ─── Pool analytics ───────────────────────────────────────────────────────────

app.get('/api/pools/:poolId/analytics', async (req: Request, res: Response) => {
  const { poolId } = req.params;

  const [swapStats, lpStats, riskSnap] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)                          AS swap_count,
         SUM(amount_in::numeric)           AS volume_24h,
         AVG(fee_bps)                      AS avg_fee_bps,
         MAX(risk_mode)                    AS current_risk_mode
       FROM swaps
       WHERE pool_id = $1
         AND timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')`,
      [poolId]
    ),
    db.query(
      `SELECT
         COUNT(DISTINCT user_address)      AS total_lps,
         SUM(compensation_paid_usd)        AS total_il_paid
       FROM lp_positions
       WHERE pool_id = $1`,
      [poolId]
    ),
    db.query(
      `SELECT risk_mode, risk_score, reserve_health
       FROM risk_snapshots
       ORDER BY timestamp DESC
       LIMIT 1`
    ),
  ]);

  res.json({
    poolId,
    swapCount24h:    Number(swapStats.rows[0]?.swap_count ?? 0),
    volume24hUsd:    swapStats.rows[0]?.volume_24h ?? '0',
    avgFeeBps:       Number(swapStats.rows[0]?.avg_fee_bps ?? 0),
    currentRiskMode: riskSnap.rows[0]?.risk_mode ?? 'NORMAL',
    currentRiskScore: Number(riskSnap.rows[0]?.risk_score ?? 0),
    reserveHealth:   riskSnap.rows[0]?.reserve_health ?? '1',
    totalLPs:        Number(lpStats.rows[0]?.total_lps ?? 0),
    totalILPaidUsd:  lpStats.rows[0]?.total_il_paid ?? '0',
  });
});

// ─── Price history ────────────────────────────────────────────────────────────

app.get('/api/pools/:poolId/price-history', async (req: Request, res: Response) => {
  const { poolId } = req.params;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const result = await db.query(
    `SELECT price, timestamp FROM swaps
     WHERE pool_id = $1 AND price > 0
     ORDER BY timestamp DESC
     LIMIT $2`,
    [poolId, limit]
  );

  // Return oldest-first so the risk engine receives a chronological price series
  const prices = result.rows.reverse().map(r => ({
    price:     Number(r.price),
    timestamp: Number(r.timestamp),
  }));

  res.json(prices);
});

// ─── Recent swaps ─────────────────────────────────────────────────────────────

app.get('/api/pools/:poolId/swaps', async (req: Request, res: Response) => {
  const { poolId } = req.params;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const result = await db.query(
    `SELECT * FROM swaps
     WHERE pool_id = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [poolId, limit]
  );

  res.json(result.rows);
});

// ─── LP positions ─────────────────────────────────────────────────────────────

app.get('/api/lp/:address/positions', async (req: Request, res: Response) => {
  const { address } = req.params;

  const result = await db.query(
    `SELECT * FROM lp_positions
     WHERE LOWER(user_address) = $1
     ORDER BY deposit_timestamp DESC`,
    [address.toLowerCase()]
  );

  res.json(result.rows);
});

// ─── LP history (closed positions with IL data) ───────────────────────────────

app.get('/api/lp/:address/history', async (req: Request, res: Response) => {
  const { address } = req.params;

  const result = await db.query(
    `SELECT
       id,
       pool_id,
       deposit_value_usd,
       withdrawal_value_usd,
       hold_value_usd,
       realized_il_usd,
       compensation_paid_usd,
       deposit_timestamp,
       withdrawal_timestamp,
       tx_hash_deposit,
       tx_hash_withdrawal
     FROM lp_positions
     WHERE LOWER(user_address) = $1
       AND withdrawal_timestamp IS NOT NULL
     ORDER BY withdrawal_timestamp DESC`,
    [address.toLowerCase()]
  );

  // Compute totals
  const totals = result.rows.reduce(
    (acc, row) => ({
      totalIL:           acc.totalIL + Number(row.realized_il_usd ?? 0),
      totalCompensation: acc.totalCompensation + Number(row.compensation_paid_usd ?? 0),
    }),
    { totalIL: 0, totalCompensation: 0 }
  );

  res.json({ positions: result.rows, totals });
});

// ─── Reserve stats ────────────────────────────────────────────────────────────

app.get('/api/reserve/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  const result = await db.query(
    `SELECT
       event_type,
       SUM(amount::numeric) AS total_amount,
       COUNT(*)             AS event_count
     FROM reserve_events
     WHERE token = $1
     GROUP BY event_type`,
    [token.toLowerCase()]
  );

  const stats: Record<string, { totalAmount: string; eventCount: number }> = {};
  for (const row of result.rows) {
    stats[row.event_type] = {
      totalAmount: row.total_amount,
      eventCount:  Number(row.event_count),
    };
  }

  res.json({ token, stats });
});

// ─── Risk snapshots ───────────────────────────────────────────────────────────

app.get('/api/risk/snapshots', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const since = Number(req.query.since ?? 0);

  const result = await db.query(
    `SELECT * FROM risk_snapshots
     WHERE timestamp > $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [since, limit]
  );

  res.json(result.rows);
});

app.get('/api/risk/current', async (_req: Request, res: Response) => {
  const result = await db.query(
    `SELECT * FROM risk_snapshots ORDER BY timestamp DESC LIMIT 1`
  );

  if (result.rows.length === 0) {
    return res.json({ riskMode: 'NORMAL', riskScore: 0 });
  }

  res.json(result.rows[0]);
});

// ─── Oracle price simulator ───────────────────────────────────────────────────

app.post('/api/oracle/set-prices', async (req: Request, res: Response) => {
  const { price0, price1 } = req.body as { price0?: number; price1?: number };

  if ((price0 !== undefined && (typeof price0 !== 'number' || price0 <= 0)) ||
      (price1 !== undefined && (typeof price1 !== 'number' || price1 <= 0))) {
    return res.status(400).json({ error: 'price0 and price1 must be positive numbers' });
  }
  if (price0 === undefined && price1 === undefined) {
    return res.status(400).json({ error: 'provide at least one of price0 or price1' });
  }
  const token0 = process.env.NEXT_PUBLIC_TOKEN0 ?? process.env.TOKEN0 ?? '';
  const token1 = process.env.NEXT_PUBLIC_TOKEN1 ?? process.env.TOKEN1 ?? '';

  try {
    if (price0 !== undefined && token0) {
      await db.query(
        `INSERT INTO indexer_state (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [`oracle_price_${token0.toLowerCase()}`, price0.toString()]
      );
    }
    if (price1 !== undefined && token1) {
      await db.query(
        `INSERT INTO indexer_state (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [`oracle_price_${token1.toLowerCase()}`, price1.toString()]
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }

  res.json({ success: true, queued: true });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(config.apiPort, () => {
  console.log(`[API] HedgeFlow API running on port ${config.apiPort}`);
});

export default app;
