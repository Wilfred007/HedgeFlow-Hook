'use client';

import { useState } from 'react';
import { RiskBadge } from '@/components/RiskBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricePoint   { price: number; timestamp: number; }
interface PoolMetrics  { pool_id: string; prices: PricePoint[]; tvl_usd: number; volume_24h_usd: number; reserve_balance: number; total_liabilities: number; }
interface RiskComponents { volatility: number; liquidity_stress: number; whale_activity: number; reserve_pressure: number; }
interface SentimentResult { score: number; label: string; }
interface RiskEngineOutput { risk_score: number; risk_mode: string; recommended_fee_bps: number; components: RiskComponents; sentiment?: SentimentResult; timestamp: number; }

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS = {
  stable: {
    name: 'Stable Market',
    description: 'Low volatility, healthy liquidity, minimal whale activity',
    color: '#10b981', badge: '▲',
    prices: Array.from({ length: 50 }, (_, i) => ({ price: 3000 + Math.sin(i / 10) * 5, timestamp: Date.now() - (50 - i) * 60000 })),
    tvl_usd: 10_000_000, volume_24h_usd: 500_000, reserve_balance: 5_000_000, total_liabilities: 100_000,
  },
  moderate: {
    name: 'Moderate Volatility',
    description: 'Normal market with some price swings',
    color: '#f59e0b', badge: '◈',
    prices: Array.from({ length: 50 }, (_, i) => ({ price: 3000 * (1 + Math.sin(i / 5) * 0.02 + (Math.random() - 0.5) * 0.01), timestamp: Date.now() - (50 - i) * 60000 })),
    tvl_usd: 5_000_000, volume_24h_usd: 2_000_000, reserve_balance: 2_000_000, total_liabilities: 500_000,
  },
  volatile: {
    name: 'High Volatility',
    description: 'Significant price swings, high volume stress',
    color: '#f97316', badge: '⬡',
    prices: Array.from({ length: 50 }, (_, i) => ({ price: 3000 * (1 + Math.sin(i / 3) * 0.05 + (Math.random() - 0.5) * 0.03), timestamp: Date.now() - (50 - i) * 60000 })),
    tvl_usd: 2_000_000, volume_24h_usd: 5_000_000, reserve_balance: 500_000, total_liabilities: 400_000,
  },
  crisis: {
    name: 'Crisis Mode',
    description: 'Extreme volatility, reserve pressure, flash crash',
    color: '#ef4444', badge: '⚠',
    prices: Array.from({ length: 50 }, (_, i) => ({ price: 3000 * (1 + (i > 25 ? -0.15 : 0) + (Math.random() - 0.5) * 0.08), timestamp: Date.now() - (50 - i) * 60000 })),
    tvl_usd: 500_000, volume_24h_usd: 10_000_000, reserve_balance: 100_000, total_liabilities: 500_000,
  },
};

const FEE_MAP: Record<string, string> = { NORMAL: '0.30%', ELEVATED: '0.60%', DEFENSIVE: '1.20%', CRISIS: '2.50%' };

const COMPONENTS = [
  { key: 'volatility',       label: 'Volatility',       weight: 40, color: '#22d3ee' },
  { key: 'liquidity_stress', label: 'Liquidity Stress', weight: 30, color: '#a855f7' },
  { key: 'whale_activity',   label: 'Whale Activity',   weight: 20, color: '#f59e0b' },
  { key: 'reserve_pressure', label: 'Reserve Pressure', weight: 10, color: '#ef4444' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AITestPage() {
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<RiskEngineOutput | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [sentiment, setSentiment]     = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveStatus, setLiveStatus]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [livePrices, setLivePrices]   = useState<PricePoint[] | null>(null);

  const [custom, setCustom] = useState({
    tvl_usd: 10_000_000,
    volume_24h_usd: 500_000,
    reserve_balance: 5_000_000,
    total_liabilities: 100_000,
    volatility: 2,
  });

  const fetchLiveData = async () => {
    setLiveLoading(true);
    setLiveStatus(null);
    setLivePrices(null);
    try {
      const API_URL  = process.env.NEXT_PUBLIC_API_URL  ?? 'http://localhost:3001';
      const POOL_ID  = process.env.NEXT_PUBLIC_DEMO_POOL_ID ?? '';

      const [analyticsRes, swapsRes] = await Promise.all([
        fetch(`${API_URL}/api/pools/${POOL_ID}/analytics`),
        fetch(`${API_URL}/api/pools/${POOL_ID}/swaps?limit=50`),
      ]);
      if (!analyticsRes.ok) throw new Error(`Analytics ${analyticsRes.status}: ${await analyticsRes.text()}`);

      const analytics = await analyticsRes.json();
      const swaps: Array<{ price: string; timestamp: number }> = swapsRes.ok ? await swapsRes.json() : [];

      // Build price series: use real prices when non-zero, else simulate from risk score
      const riskScore     = Number(analytics.currentRiskScore ?? 20);
      const volFactor     = Math.max(riskScore / 100 * 0.06, 0.002);
      const basePrice     = 3000;
      const realPrices    = swaps.filter(s => Number(s.price) > 0);
      const prices: PricePoint[] = realPrices.length >= 5
        ? realPrices.map(s => ({ price: Number(s.price), timestamp: s.timestamp * 1000 })).reverse()
        : Array.from({ length: 50 }, (_, i) => ({
            price: basePrice * (1 + (Math.random() - 0.5) * volFactor * 2),
            timestamp: Date.now() - (50 - i) * 60_000,
          }));

      const volume        = Number(analytics.volume24hUsd) || 0;
      const totalLPs      = Number(analytics.totalLPs) || 0;
      const reserveHealth = Number(analytics.reserveHealth ?? 1);
      const estTvl        = Math.max(totalLPs * 5_000, 50_000);
      const estReserve    = estTvl * 0.05;
      const estLiab       = reserveHealth > 0.01 ? estReserve / reserveHealth : estReserve * 2;

      setLivePrices(prices);
      setCustom({
        tvl_usd:           Math.round(estTvl),
        volume_24h_usd:    Math.round(volume),
        reserve_balance:   Math.round(estReserve),
        total_liabilities: Math.round(estLiab),
        volatility:        Math.round(volFactor * 100 * 10) / 10,
      });
      setLiveStatus({
        ok: true,
        msg: `Live: ${analytics.swapCount24h} swaps · ${totalLPs} LPs · $${Math.round(volume).toLocaleString()} vol · mode ${analytics.currentRiskMode}`,
      });
    } catch (e) {
      setLiveStatus({ ok: false, msg: e instanceof Error ? e.message : 'Failed to fetch live data' });
    } finally {
      setLiveLoading(false);
    }
  };

  const testRisk = async (preset?: keyof typeof PRESETS) => {
    setLoading(true); setError(null); setResult(null);
    setActivePreset(preset ?? 'custom');
    if (!preset) setLiveStatus(null);
    try {
      const metrics: PoolMetrics = preset
        ? { pool_id: '0xtest', ...PRESETS[preset] }
        : {
            pool_id: '0xcustom',
            prices: livePrices ?? Array.from({ length: 50 }, (_, i) => ({
              price: 3000 * (1 + (Math.random() - 0.5) * (custom.volatility / 100) * 2),
              timestamp: Date.now() - (50 - i) * 60000,
            })),
            tvl_usd: custom.tvl_usd,
            volume_24h_usd: custom.volume_24h_usd,
            reserve_balance: custom.reserve_balance,
            total_liabilities: custom.total_liabilities,
          };

      const RISK_ENGINE_URL = process.env.NEXT_PUBLIC_RISK_ENGINE_URL ?? 'http://localhost:8000';
      const res = await fetch(`${RISK_ENGINE_URL}/risk/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool_metrics: metrics, include_sentiment: sentiment }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '860px', margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <div className="section-label" style={{ marginBottom: '6px' }}>HedgeFlow AI Integration</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Risk Engine Lab
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
          Test the HedgeFlow risk scoring engine with different market scenarios
        </p>
      </div>

      {/* ── HedgeFlow Sentiment Toggle ──────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          borderRadius: '16px',
          padding: '24px',
          background: sentiment
            ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(79,70,229,0.06))'
            : undefined,
          border: sentiment ? '1px solid rgba(124,58,237,0.35)' : undefined,
          position: 'relative', overflow: 'hidden',
        }}
      >
        {sentiment && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #7c3aed, #a855f7, transparent)' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1rem' }}>🧠</span>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>HedgeFlow AI Sentiment Analysis</span>
              {sentiment && (
                <span style={{ padding: '2px 8px', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, color: '#c084fc', letterSpacing: '0.08em' }}>
                  ENABLED
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Enable HedgeFlow to analyze market sentiment — contributes 20% to final risk score
            </p>
          </div>
          {/* Toggle */}
          <button
            onClick={() => setSentiment(!sentiment)}
            style={{
              width: '48px', height: '26px',
              background: sentiment ? 'var(--accent)' : 'var(--border)',
              borderRadius: '13px',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
              boxShadow: sentiment ? '0 0 12px rgba(124,58,237,0.5)' : 'none',
            }}
            aria-label="Toggle sentiment"
          >
            <span
              style={{
                position: 'absolute',
                top: '3px',
                left: sentiment ? '25px' : '3px',
                width: '20px', height: '20px',
                background: 'white',
                borderRadius: '50%',
                transition: 'left 0.2s',
                display: 'block',
              }}
            />
          </button>
        </div>
      </div>

      {/* ── Preset Scenarios ───────────────────────────────────── */}
      <div className="glass-card" style={{ borderRadius: '16px', padding: '24px' }}>
        <h2 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Preset Scenarios
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {Object.entries(PRESETS).map(([key, p]) => {
            const isActive = activePreset === key && !!result;
            return (
              <button
                key={key}
                onClick={() => testRisk(key as keyof typeof PRESETS)}
                disabled={loading}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '18px 16px',
                  background: isActive ? `${p.color}12` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${isActive ? p.color + '50' : 'var(--border)'}`,
                  borderRadius: '12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    (e.currentTarget as HTMLElement).style.borderColor = `${p.color}60`;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${p.color}, transparent)` }} />}
                <span style={{ fontSize: '1.25rem', color: p.color }}>{p.badge}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px', color: 'var(--text-primary)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {p.description}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                  TVL ${(p.tvl_usd / 1e6).toFixed(1)}M
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Custom Metrics ─────────────────────────────────────── */}
      <div className="glass-card" style={{ borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Custom Metrics
            {livePrices && (
              <span style={{ marginLeft: '8px', padding: '2px 7px', background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.35)', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, color: '#22d3ee', letterSpacing: '0.06em' }}>
                LIVE
              </span>
            )}
          </h2>
          <button
            onClick={fetchLiveData}
            disabled={liveLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
              background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)',
              color: '#22d3ee', cursor: liveLoading ? 'not-allowed' : 'pointer',
              opacity: liveLoading ? 0.6 : 1,
            }}
          >
            {liveLoading
              ? <><span style={{ width: '10px', height: '10px', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', borderRadius: '50%', animation: 'spin-slow 0.7s linear infinite', display: 'inline-block' }} /> Fetching…</>
              : <>📡 Use Live Pool Data</>}
          </button>
        </div>

        {/* Live status banner */}
        {liveStatus && (
          <div style={{
            marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.75rem',
            background: liveStatus.ok ? 'rgba(34,211,238,0.06)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${liveStatus.ok ? 'rgba(34,211,238,0.25)' : 'rgba(239,68,68,0.25)'}`,
            color: liveStatus.ok ? '#67e8f9' : '#fca5a5',
          }}>
            {liveStatus.ok ? '✓ ' : '⚠ '}{liveStatus.msg}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
          {[
            { label: 'TVL (USD)',               key: 'tvl_usd',           step: 100000 },
            { label: '24h Volume (USD)',         key: 'volume_24h_usd',    step: 50000  },
            { label: 'Reserve Balance (USD)',    key: 'reserve_balance',   step: 100000 },
            { label: 'Total Liabilities (USD)',  key: 'total_liabilities', step: 10000  },
            { label: 'Price Volatility (%)',     key: 'volatility',        step: 0.1    },
          ].map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {field.label}
              </label>
              <input
                type="number"
                step={field.step}
                value={(custom as Record<string, number>)[field.key]}
                onChange={e => setCustom({ ...custom, [field.key]: Number(e.target.value) })}
                className="HedgeFlow-input"
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => testRisk()}
          disabled={loading}
          className="btn-primary"
          style={{ marginTop: '20px', width: '100%', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin-slow 0.7s linear infinite', display: 'inline-block' }} />
              Computing…
            </span>
          ) : 'Run Risk Analysis →'}
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div style={{ borderRadius: '14px', padding: '20px 24px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '6px', fontSize: '0.9rem' }}>
            ⚠ Connection Error
          </div>
          <p style={{ fontSize: '0.8rem', color: '#fca5a5', fontFamily: 'var(--font-mono)' }}>{error}</p>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px' }}>
            Start the risk engine: <code style={{ color: '#a855f7' }}>docker-compose up risk-engine</code>
          </p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────── */}
      {result && (
        <div className="glass-card" style={{ borderRadius: '16px', padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
          {/* Top gradient line matching mode color */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${result.risk_mode === 'CRISIS' ? '#ef4444' : result.risk_mode === 'DEFENSIVE' ? '#f97316' : result.risk_mode === 'ELEVATED' ? '#f59e0b' : '#10b981'}, transparent)`,
          }} />

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Analysis Results</h2>
            <RiskBadge mode={result.risk_mode} score={Math.round(result.risk_score)} size="lg" />
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {[
              { label: 'Risk Score',      value: result.risk_score.toFixed(1), sub: '/ 100',                color: '#a855f7' },
              { label: 'Mode',            value: result.risk_mode,              sub: undefined,              color: 'var(--text-primary)' },
              { label: 'Recommended Fee', value: FEE_MAP[result.risk_mode],     sub: `${result.recommended_fee_bps} bps`, color: '#34d399' },
              { label: 'Computed At',     value: new Date(result.timestamp * 1000).toLocaleTimeString(), sub: undefined, color: 'var(--text-secondary)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Component bars */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
              Score Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {COMPONENTS.map(c => {
                const val = result.components[c.key];
                return (
                  <div key={c.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.label}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>×{c.weight}%</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: c.color }}>
                        {val.toFixed(1)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${val}%`,
                          background: `linear-gradient(90deg, ${c.color}80, ${c.color})`,
                          boxShadow: `0 0 8px ${c.color}50`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Sentiment */}
          {result.sentiment && (
            <div style={{ marginTop: '24px', padding: '18px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span>🧠</span>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>HedgeFlow Sentiment</span>
                <span style={{ padding: '2px 8px', background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700, color: '#c084fc', letterSpacing: '0.08em' }}>
                  20% WEIGHT
                </span>
              </div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Label</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c084fc' }}>{result.sentiment.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Score</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#c084fc', fontFamily: 'var(--font-mono)' }}>
                    {result.sentiment.score.toFixed(1)} / 100
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Formula */}
          <div className="formula-box" style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '8px', color: '#a855f7', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Calculation
            </div>
            <div>
              Statistical = 0.4 × {result.components.volatility.toFixed(1)}
              {' + '}0.3 × {result.components.liquidity_stress.toFixed(1)}
              {' + '}0.2 × {result.components.whale_activity.toFixed(1)}
              {' + '}0.1 × {result.components.reserve_pressure.toFixed(1)}
              {' = '}{(0.4*result.components.volatility + 0.3*result.components.liquidity_stress + 0.2*result.components.whale_activity + 0.1*result.components.reserve_pressure).toFixed(2)}
            </div>
            {result.sentiment && (
              <div style={{ marginTop: '6px' }}>
                Final = 0.8 × {(0.4*result.components.volatility + 0.3*result.components.liquidity_stress + 0.2*result.components.whale_activity + 0.1*result.components.reserve_pressure).toFixed(2)}
                {' + '}0.2 × {result.sentiment.score.toFixed(1)} = <span style={{ color: '#a855f7', fontWeight: 600 }}>{result.risk_score.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Info callout ───────────────────────────────────────── */}
      <div style={{ borderRadius: '14px', padding: '24px', background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.15)' }}>
        <div style={{ fontWeight: 600, color: '#22d3ee', marginBottom: '12px', fontSize: '0.875rem' }}>
          How it works
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>Statistical Risk (80%):</span>{' '}
            Volatility, liquidity stress, whale activity, and reserve pressure are weighted and combined
          </div>
          <div>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>HedgeFlow AI Sentiment (20%):</span>{' '}
            Optional HedgeFlow API integration analyzes market conditions and social signals
          </div>
          <div>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>Mode Thresholds:</span>{' '}
            NORMAL (0–30) → ELEVATED (31–55) → DEFENSIVE (56–80) → CRISIS (81–100)
          </div>
        </div>
      </div>
    </div>
  );
}
