import { Pool } from 'pg';
import { config } from '@hedgeflow/shared';

export const db = new Pool({ connectionString: config.databaseUrl });

/// ─── Schema migrations ────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // ── swaps ──────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS swaps (
        id            SERIAL PRIMARY KEY,
        pool_id       TEXT        NOT NULL,
        trader        TEXT        NOT NULL,
        amount_in     NUMERIC     NOT NULL,
        amount_out    NUMERIC     NOT NULL,
        price         NUMERIC     NOT NULL,
        fee_bps       INTEGER     NOT NULL,
        risk_mode     TEXT        NOT NULL,
        timestamp     BIGINT      NOT NULL,
        tx_hash       TEXT        NOT NULL UNIQUE,
        block_number  BIGINT      NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_swaps_pool_id   ON swaps(pool_id);
      CREATE INDEX IF NOT EXISTS idx_swaps_timestamp ON swaps(timestamp);
    `);

    // ── lp_positions ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS lp_positions (
        id                    SERIAL PRIMARY KEY,
        user_address          TEXT        NOT NULL,
        pool_id               TEXT        NOT NULL,
        deposit_amount0       NUMERIC     NOT NULL,
        deposit_amount1       NUMERIC     NOT NULL,
        deposit_value_usd     NUMERIC     NOT NULL,
        withdrawal_amount0    NUMERIC,
        withdrawal_amount1    NUMERIC,
        withdrawal_value_usd  NUMERIC,
        hold_value_usd        NUMERIC,
        realized_il_usd       NUMERIC,
        compensation_paid_usd NUMERIC,
        deposit_timestamp     BIGINT      NOT NULL,
        withdrawal_timestamp  BIGINT,
        tx_hash_deposit       TEXT        NOT NULL,
        tx_hash_withdrawal    TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_lp_user    ON lp_positions(user_address);
      CREATE INDEX IF NOT EXISTS idx_lp_pool_id ON lp_positions(pool_id);
    `);

    // ── reserve_events ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reserve_events (
        id              SERIAL PRIMARY KEY,
        event_type      TEXT        NOT NULL,
        token           TEXT        NOT NULL,
        amount          NUMERIC     NOT NULL,
        reserve_balance NUMERIC     NOT NULL,
        lp              TEXT,
        timestamp       BIGINT      NOT NULL,
        tx_hash         TEXT        NOT NULL UNIQUE,
        block_number    BIGINT      NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reserve_timestamp ON reserve_events(timestamp);
    `);

    // ── risk_snapshots ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS risk_snapshots (
        id                    SERIAL PRIMARY KEY,
        risk_score            NUMERIC     NOT NULL,
        risk_mode             TEXT        NOT NULL,
        volatility_score      NUMERIC     NOT NULL,
        liquidity_stress_score NUMERIC    NOT NULL,
        whale_activity_score  NUMERIC     NOT NULL,
        reserve_pressure_score NUMERIC    NOT NULL,
        sentiment_score       NUMERIC,
        reserve_health        NUMERIC     NOT NULL,
        timestamp             BIGINT      NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_risk_timestamp ON risk_snapshots(timestamp);
    `);

    // ── indexer_state (checkpoint) ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS indexer_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO indexer_state (key, value)
      VALUES ('last_block', '0')
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('[DB] Migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getLastIndexedBlock(): Promise<number> {
  const res = await db.query(
    "SELECT value FROM indexer_state WHERE key = 'last_block'"
  );
  return parseInt(res.rows[0]?.value ?? '0', 10);
}

export async function setLastIndexedBlock(block: number): Promise<void> {
  await db.query(
    "INSERT INTO indexer_state (key, value) VALUES ('last_block', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [block.toString()]
  );
}
