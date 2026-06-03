import { Suspense } from 'react';
import { createPublicClient, http, formatUnits } from 'viem';
import { StatCard } from '@/components/StatCard';
import { RiskBadge } from '@/components/RiskBadge';
import { RiskChart } from '@/components/RiskChart';
import { AutoRefresh } from '@/components/AutoRefresh';
import { api } from '@/lib/api';
import type { PoolAnalytics, RiskSnapshot } from '@/lib/api';

const RESERVE_VAULT   = '0xA046d4bDb3CDc4ba92cA0939b1464aE1cAb6B025' as const;
const TOKEN0_ADDRESS  = (process.env.NEXT_PUBLIC_TOKEN0 ?? '') as `0x${string}`;
const TOKEN1_ADDRESS  = (process.env.NEXT_PUBLIC_TOKEN1 ?? '') as `0x${string}`;
const TOKEN0_SYMBOL   = process.env.NEXT_PUBLIC_TOKEN0_SYMBOL ?? 'Token0';
const TOKEN1_SYMBOL   = process.env.NEXT_PUBLIC_TOKEN1_SYMBOL ?? 'Token1';
const RPC_URL         = process.env.NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA ?? 'https://sepolia.unichain.org';

const RESERVE_BALANCE_ABI = [{
  name: 'reserveBalance',
  type: 'function',
  stateMutability: 'view',
  inputs:  [{ name: 'token', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

async function getVaultBalances() {
  try {
    const client = createPublicClient({ transport: http(RPC_URL) });
    const [bal0, bal1] = await Promise.all([
      client.readContract({ address: RESERVE_VAULT, abi: RESERVE_BALANCE_ABI, functionName: 'reserveBalance', args: [TOKEN0_ADDRESS] }),
      client.readContract({ address: RESERVE_VAULT, abi: RESERVE_BALANCE_ABI, functionName: 'reserveBalance', args: [TOKEN1_ADDRESS] }),
    ]);
    return { bal0: Number(formatUnits(bal0, 18)), bal1: Number(formatUnits(bal1, 18)) };
  } catch {
    return { bal0: 0, bal1: 0 };
  }
}

const DEMO_POOL_ID = process.env.NEXT_PUBLIC_DEMO_POOL_ID ?? '0xdemo';

const MODE_COLORS: Record<string, string> = {
  NORMAL:    '#10b981',
  ELEVATED:  '#f59e0b',
  DEFENSIVE: '#f97316',
  CRISIS:    '#ef4444',
};

const FEE_MAP: Record<string, string> = {
  NORMAL: '0.30%', ELEVATED: '0.60%', DEFENSIVE: '1.20%', CRISIS: '2.50%',
};

async function DashboardContent() {
  let analytics: PoolAnalytics | null = null;
  let riskSnapshots: RiskSnapshot[] = [];
  let currentRisk: RiskSnapshot | null = null;

  try {
    [analytics, riskSnapshots, currentRisk] = await Promise.all([
      api.getPoolAnalytics(DEMO_POOL_ID),
      api.getRiskSnapshots(50),
      api.getCurrentRisk(),
    ]);
  } catch {
    // API offline — show placeholder UI
  }

  const vault = await getVaultBalances();

  const mode  = currentRisk?.risk_mode ?? analytics?.currentRiskMode ?? 'NORMAL';
  const score = Number(currentRisk?.risk_score ?? analytics?.currentRiskScore ?? 0);
  const modeColor = MODE_COLORS[mode] ?? '#10b981';

  const THRESHOLD_ROWS = [
    { mode: 'NORMAL',    range: '0–30',   fee: '0.30%', cover: '20%', desc: 'Standard market conditions',            color: '#10b981', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.2)'  },
    { mode: 'ELEVATED',  range: '31–55',  fee: '0.60%', cover: '30%', desc: 'Increased volatility detected',         color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)'  },
    { mode: 'DEFENSIVE', range: '56–80',  fee: '1.20%', cover: '40%', desc: 'High stress — doubled fees',            color: '#f97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)'  },
    { mode: 'CRISIS',    range: '81–100', fee: '2.50%', cover: '50%', desc: 'Extreme conditions — max protection',   color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.2)'   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── Page header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Live Analytics</div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Pool Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
            Real-time HedgeFlow protocol metrics
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AutoRefresh intervalMs={10_000} />
          <RiskBadge mode={mode} score={Math.round(score)} size="lg" />
        </div>
      </div>

      {/* ── Risk score gauge ───────────────────────────────────── */}
      <div
        className="glass-card"
        style={{
          borderRadius: '16px',
          padding: '28px 32px',
          background: `linear-gradient(135deg, ${modeColor}08 0%, rgba(0,0,0,0.4) 100%)`,
          border: `1px solid ${modeColor}25`,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${modeColor}, transparent)` }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="section-label" style={{ marginBottom: '6px' }}>Risk Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '3.5rem', fontWeight: 700, color: modeColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {Math.round(score)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>/100</span>
            </div>
          </div>

          {/* Score bar */}
          <div style={{ flex: 1, minWidth: '200px', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <span>Normal</span><span>Elevated</span><span>Defensive</span><span>Crisis</span>
            </div>
            <div style={{ height: '10px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden', position: 'relative' }}>
              {/* Colored segments */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #10b981 0% 30%, #f59e0b 30% 55%, #f97316 55% 80%, #ef4444 80% 100%)', opacity: 0.25 }} />
              {/* Fill */}
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(score, 100)}%`,
                  background: `linear-gradient(90deg, #10b981, ${modeColor})`,
                  borderRadius: '999px',
                  transition: 'width 1s ease',
                  boxShadow: `0 0 8px ${modeColor}`,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
              <span>0</span><span>31</span><span>56</span><span>81</span><span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Risk Mode"         value={mode}                      icon="🎯" highlight />
        <StatCard label="Active Fee"        value={FEE_MAP[mode] ?? '0.30%'}  icon="💸" sub="Adjusts with risk" />
        <StatCard label="24h Volume"        value={analytics ? `$${Number(analytics.volume24hUsd).toLocaleString()}` : '—'} icon="📊" />
        <StatCard label="Total LPs"         value={analytics?.totalLPs ?? '—'} icon="👥" />
        <StatCard label="Reserve Health"    value={analytics ? `${(Number(analytics.reserveHealth) * 100).toFixed(0)}%` : '—'} icon="🏦" sub="Reserve / Liabilities" />
        <StatCard label="IL Compensated"    value={analytics ? `$${Number(analytics.totalILPaidUsd).toLocaleString()}` : '—'} icon="💰" />
        <StatCard label="Risk Score"        value={`${Math.round(score)} / 100`} icon="📈" sub="0 safe → 100 crisis" />
        <StatCard label="Swaps (24h)"       value={analytics?.swapCount24h ?? '—'} icon="🔄" />
      </div>

      {/* ── Reserve Vault ──────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{ borderRadius: '16px', padding: '28px 24px', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #10b981, transparent)' }} />
        <div style={{ marginBottom: '20px' }}>
          <div className="section-label" style={{ marginBottom: '6px' }}>On-Chain</div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Reserve Vault</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Funded by 0.20% swap fees · {RESERVE_VAULT.slice(0, 6)}…{RESERVE_VAULT.slice(-4)}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {[
            { symbol: TOKEN0_SYMBOL, balance: vault.bal0, color: '#10b981' },
            { symbol: TOKEN1_SYMBOL, balance: vault.bal1, color: '#22d3ee' },
          ].map((t: { symbol: string; balance: number; color: string }) => (
            <div
              key={t.symbol}
              style={{
                borderRadius: '12px',
                padding: '18px 16px',
                background: `${t.color}08`,
                border: `1px solid ${t.color}25`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
                {t.symbol}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: t.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {t.balance > 0
                  ? t.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })
                  : '—'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {t.balance > 0 ? 'accrued from fees' : 'no fees collected yet'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Risk chart ──────────────────────────────────────────── */}
      <div
        className="glass-card"
        style={{ borderRadius: '16px', padding: '28px 24px', position: 'relative', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #7c3aed, #22d3ee, transparent)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Risk Score History</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Last 50 snapshots</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '20px', height: '2px', background: '#a855f7', display: 'inline-block', borderRadius: '1px' }} />
              Risk Score
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '20px', height: '2px', background: '#22d3ee', display: 'inline-block', borderRadius: '1px', opacity: 0.7 }} />
              Volatility
            </span>
          </div>
        </div>

        {riskSnapshots.length > 0 ? (
          <RiskChart snapshots={riskSnapshots} />
        ) : (
          <div
            style={{
              height: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: 'var(--text-muted)',
              border: '1px dashed var(--border)',
              borderRadius: '10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>📡</span>
            No risk data yet
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Run docker-compose up to start the indexer</span>
          </div>
        )}
      </div>

      {/* ── Mode thresholds ─────────────────────────────────────── */}
      <div className="glass-card" style={{ borderRadius: '16px', padding: '28px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Risk Mode Thresholds</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Score ranges → protocol behavior
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {THRESHOLD_ROWS.map(m => {
            const isActive = m.mode === mode;
            return (
              <div
                key={m.mode}
                style={{
                  borderRadius: '12px',
                  padding: '18px 16px',
                  background: m.bg,
                  border: isActive ? `1px solid ${m.color}60` : `1px solid ${m.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.2s',
                  boxShadow: isActive ? `0 0 20px ${m.color}15` : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isActive && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <RiskBadge mode={m.mode} size="sm" />
                  {isActive && (
                    <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: m.color, fontWeight: 700, letterSpacing: '0.1em' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.fee}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fee</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 700, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.cover}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>IL Cover</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.desc}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: m.color, opacity: 0.6 }}>
                  Score: {m.range}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
          Loading dashboard...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
