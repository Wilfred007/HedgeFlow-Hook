'use client';

import { useState, useEffect, useCallback } from 'react';
import { RiskBadge } from '@/components/RiskBadge';
import type { SwapRecord, RiskSnapshot } from '@/lib/api';

const POOL_ID  = process.env.NEXT_PUBLIC_DEMO_POOL_ID ?? '';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const EXPLORER = 'https://sepolia.uniscan.xyz/tx/';

const MODE_COLORS: Record<string, string> = {
  NORMAL: '#10b981', ELEVATED: '#f59e0b', DEFENSIVE: '#f97316', CRISIS: '#ef4444',
};

const COMPONENTS = [
  { key: 'volatility_score',       label: 'Volatility',       color: '#22d3ee', weight: '40%' },
  { key: 'liquidity_stress_score', label: 'Liq. Stress',      color: '#a855f7', weight: '30%' },
  { key: 'whale_activity_score',   label: 'Whale Activity',   color: '#f59e0b', weight: '20%' },
  { key: 'reserve_pressure_score', label: 'Reserve Pressure', color: '#ef4444', weight: '10%' },
] as const;

// pg returns numeric columns as strings; coerce to number
function num(v: unknown): number { return Number(v ?? 0); }

function timeAgo(ts: number) {
  const sec = Math.floor(Date.now() / 1000) - ts;
  if (sec < 60)    return `${sec}s ago`;
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtAmount(val: string) {
  const n = Number(val);
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(4);
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon, msg, hint }: { icon: string; msg: string; hint: string }) {
  return (
    <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '10px' }}>{icon}</div>
      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>{msg}</div>
      <div style={{ fontSize: '0.72rem' }}>{hint}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [swaps,     setSwaps]     = useState<SwapRecord[]>([]);
  const [snapshots, setSnapshots] = useState<RiskSnapshot[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [secondsSince, setSecondsSince] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [swapRes, snapRes] = await Promise.all([
        fetch(`${API_BASE}/api/pools/${POOL_ID}/swaps?limit=50`),
        fetch(`${API_BASE}/api/risk/snapshots?limit=20`),
      ]);
      if (!swapRes.ok) throw new Error(`Swaps API ${swapRes.status}`);
      if (!snapRes.ok) throw new Error(`Snapshots API ${snapRes.status}`);
      const [s, n] = await Promise.all([swapRes.json(), snapRes.json()]);
      setSwaps(s);
      setSnapshots(n);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15 s
  const INTERVAL = 15;
  useEffect(() => {
    const id = setInterval(load, INTERVAL * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Tick the seconds-since counter every second
  useEffect(() => {
    if (!updatedAt) return;
    setSecondsSince(0);
    const id = setInterval(() => setSecondsSince(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  // Derived: swap count per risk mode
  const modeDist = swaps.reduce<Record<string, number>>((acc, s) => {
    acc[s.risk_mode] = (acc[s.risk_mode] ?? 0) + 1;
    return acc;
  }, {});

  const latest = snapshots[0] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Indexer Data</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
            On-chain events indexed from Unichain Sepolia
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Auto-refresh pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '999px', fontSize: '0.68rem',
            fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)',
            color: 'var(--text-muted)',
          }}>
            {loading ? (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22d3ee', display: 'inline-block', animation: 'glow-pulse 0.6s ease-in-out infinite' }} />
            ) : (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee', display: 'inline-block', animation: 'glow-pulse 2s ease-in-out infinite' }} />
            )}
            {loading
              ? 'updating…'
              : updatedAt
                ? `${secondsSince < 5 ? 'just updated' : `${secondsSince}s ago`} · refreshes in ${Math.max(0, INTERVAL - secondsSince)}s`
                : `every ${INTERVAL}s`}
          </div>
          {/* Manual refresh */}
          <button
            onClick={load}
            disabled={loading}
            title="Refresh now"
            style={{
              padding: '5px 10px', borderRadius: '8px', fontSize: '0.82rem',
              background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
              color: '#c084fc', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.4 : 1, lineHeight: 1,
            }}
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '0.8rem' }}>
          ⚠ {error} — ensure the API is running (<code style={{ color: '#f87171' }}>docker-compose up api</code>)
        </div>
      )}

      {/* ── Risk Component Breakdown ───────────────────────────────── */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #a855f7, #22d3ee, transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Current Risk Breakdown</h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {latest ? `Latest snapshot · ${timeAgo(num(latest.timestamp))}` : 'No snapshot data yet'}
            </p>
          </div>
          {latest && <RiskBadge mode={latest.risk_mode} score={Math.round(num(latest.risk_score))} size="lg" />}
        </div>

        {!latest ? (
          <EmptyState icon="📡" msg="No risk snapshots" hint="Start the automation service to generate snapshots" />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {COMPONENTS.map(c => {
                const val = num((latest as unknown as Record<string, unknown>)[c.key]);
                return (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}`, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem' }}>{c.label}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>×{c.weight}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 600, color: c.color }}>
                        {val.toFixed(1)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${val}%`, background: `linear-gradient(90deg, ${c.color}70, ${c.color})`, boxShadow: `0 0 8px ${c.color}40` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="formula-box" style={{ marginTop: '16px', fontSize: '0.75rem' }}>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>Score = </span>
              {([
                [0.4, num(latest.volatility_score)],
                [0.3, num(latest.liquidity_stress_score)],
                [0.2, num(latest.whale_activity_score)],
                [0.1, num(latest.reserve_pressure_score)],
              ] as [number, number][]).map(([w, v], i) => `${i > 0 ? ' + ' : ''}${w} × ${v.toFixed(1)}`).join('')}
              {' = '}
              <span style={{ color: '#a855f7', fontWeight: 700 }}>{num(latest.risk_score).toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Two-column: Distribution + History ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

        {/* Swap distribution by mode */}
        <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }} />
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>Swaps by Risk Mode</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '18px' }}>Last {swaps.length} swaps</p>
          {swaps.length === 0 ? (
            <EmptyState icon="🔄" msg="No swaps indexed" hint="Use the Test Pool page to generate swap volume" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(['NORMAL', 'ELEVATED', 'DEFENSIVE', 'CRISIS'] as const).map(mode => {
                const count = modeDist[mode] ?? 0;
                const pct   = swaps.length > 0 ? (count / swaps.length) * 100 : 0;
                const color = MODE_COLORS[mode];
                return (
                  <div key={mode}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color }}>{mode}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {count} <span style={{ color: 'var(--text-muted)' }}>({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, opacity: 0.75, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}

              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                {[
                  { label: 'Total Swaps', value: swaps.length },
                  { label: 'Avg Fee', value: `${Math.round(swaps.reduce((a, s) => a + s.fee_bps, 0) / swaps.length || 0)} bps` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: '#c084fc' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Risk snapshot history */}
        <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)' }} />
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>Risk Snapshot History</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '14px' }}>Last {snapshots.length} snapshots</p>
          {snapshots.length === 0 ? (
            <EmptyState icon="📊" msg="No snapshots yet" hint="Run docker-compose up automation to start collecting" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '320px', overflowY: 'auto' }}>
              {snapshots.map((s) => {
                const color = MODE_COLORS[s.risk_mode] ?? '#10b981';
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', minWidth: '52px', flexShrink: 0 }}>
                      {timeAgo(num(s.timestamp))}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color, minWidth: '32px', flexShrink: 0 }}>
                      {Math.round(num(s.risk_score))}
                    </span>
                    <RiskBadge mode={s.risk_mode} size="sm" />
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                      <span title="Volatility" style={{ color: '#22d3ee' }}>v:{num(s.volatility_score).toFixed(0)}</span>
                      <span title="Liquidity Stress" style={{ color: '#a855f7' }}>l:{num(s.liquidity_stress_score).toFixed(0)}</span>
                      <span title="Whale Activity" style={{ color: '#f59e0b' }}>w:{num(s.whale_activity_score).toFixed(0)}</span>
                      <span title="Reserve Pressure" style={{ color: '#ef4444' }}>r:{num(s.reserve_pressure_score).toFixed(0)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Swaps Table ────────────────────────────────────── */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #10b981, transparent)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Recent Swaps</h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Last {swaps.length} indexed swaps</p>
          </div>
          {swaps.length > 0 && (
            <a
              href={`https://sepolia.uniscan.xyz/address/${process.env.NEXT_PUBLIC_HEDGEFLOW_HOOK}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: '0.72rem', color: '#22d3ee', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}
            >
              View on explorer ↗
            </a>
          )}
        </div>

        {swaps.length === 0 ? (
          <EmptyState icon="🔄" msg="No swaps indexed yet" hint="Use the Test Pool page to swap tokens — each swap triggers HedgeFlow's dynamic fee logic" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="HedgeFlow-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  {['Time', 'Trader', 'Amount In', 'Amount Out', 'Fee', 'Mode', 'Tx'].map(col => (
                    <th key={col} style={{ textAlign: 'left', padding: '0 12px 10px', whiteSpace: 'nowrap' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {swaps.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap',
                      borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      {timeAgo(num(s.timestamp))}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      <a href={`https://sepolia.uniscan.xyz/address/${s.trader}`} target="_blank" rel="noreferrer"
                        style={{ color: '#a855f7', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                        {shortAddr(s.trader)}
                      </a>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                      borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      {fmtAmount(s.amount_in)}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                      borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      {fmtAmount(s.amount_out)}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: '#34d399',
                      borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      {s.fee_bps} bps
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700,
                        color: MODE_COLORS[s.risk_mode] ?? '#10b981',
                        background: `${MODE_COLORS[s.risk_mode] ?? '#10b981'}15`,
                        border: `1px solid ${MODE_COLORS[s.risk_mode] ?? '#10b981'}30`,
                        letterSpacing: '0.04em', whiteSpace: 'nowrap',
                      }}>
                        {s.risk_mode}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: i < swaps.length - 1 ? '1px solid rgba(26,26,48,0.8)' : 'none' }}>
                      <a href={`${EXPLORER}${s.tx_hash}`} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textDecoration: 'none' }}>
                        {s.tx_hash.slice(0, 8)}…↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
