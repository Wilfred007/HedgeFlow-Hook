'use client';

import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { api, LPPosition } from '@/lib/api';
import { StatCard } from '@/components/StatCard';

function formatUsd(val: string | undefined | null): string {
  if (!val) return '$0.00';
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number | undefined | null): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

export default function LPPage() {
  const { address, isConnected } = useAccount();

  let login: () => void = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivy();
    login = privy.login;
  } catch {
    // PrivyProvider not initialised (no appId)
  }
  const [positions, setPositions]   = useState<LPPosition[]>([]);
  const [history, setHistory]       = useState<{ positions: LPPosition[]; totals: { totalIL: number; totalCompensation: number } } | null>(null);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([api.getLPPositions(address), api.getLPHistory(address)])
      .then(([pos, hist]) => { setPositions(pos); setHistory(hist); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  /* ── Not connected ─────────────────────────────────────────── */
  if (!isConnected) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '55vh',
          gap: '24px',
          textAlign: 'center',
        }}
      >
        {/* Glow circle */}
        <div
          style={{
            width: '80px', height: '80px',
            borderRadius: '50%',
            background: 'rgba(124,58,237,0.12)',
            border: '1px solid rgba(124,58,237,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px',
            boxShadow: '0 0 40px rgba(124,58,237,0.2)',
          }}
        >
          🔐
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Connect your wallet
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>
            Connect to view your LP positions and IL compensation history.
          </p>
        </div>
        <button
          onClick={login}
          className="btn-primary"
          style={{ fontSize: '0.9rem', padding: '10px 28px', border: 'none', cursor: 'pointer' }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const openPositions   = positions.filter(p => !p.withdrawal_timestamp);
  const closedPositions = history?.positions ?? [];

  /* ── Connected ─────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div>
        <div className="section-label" style={{ marginBottom: '6px' }}>LP Positions</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          My Positions
        </h1>
        <div
          style={{
            marginTop: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block' }} />
          {address}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard label="Open Positions"   value={openPositions.length}   icon="📂" />
        <StatCard label="Closed Positions" value={closedPositions.length} icon="✅" />
        <StatCard
          label="Total IL Incurred"
          value={formatUsd(history?.totals.totalIL.toString())}
          icon="📉"
        />
        <StatCard
          label="Total Compensation"
          value={formatUsd(history?.totals.totalCompensation.toString())}
          icon="💰"
          highlight
        />
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
          Loading positions…
        </div>
      )}

      {/* Open positions */}
      {openPositions.length > 0 && (
        <div className="glass-card" style={{ borderRadius: '16px', padding: '28px 24px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #10b981, transparent)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Open Positions</h2>
            <span style={{ padding: '2px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)' }}>
              {openPositions.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="HedgeFlow-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Pool ID</th>
                  <th style={{ textAlign: 'right' }}>Deposit Value</th>
                  <th style={{ textAlign: 'right' }}>Deposited</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map(pos => (
                  <tr key={pos.id}>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#a855f7' }}>
                        {shortAddr(pos.pool_id)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatUsd(pos.deposit_value_usd)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {formatDate(pos.deposit_timestamp)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, color: '#34d399', letterSpacing: '0.08em' }}>
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Closed / IL history */}
      {closedPositions.length > 0 && (
        <div className="glass-card" style={{ borderRadius: '16px', padding: '28px 24px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #7c3aed, transparent)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>IL Compensation History</h2>
            <span style={{ padding: '2px 10px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, color: '#c084fc', fontFamily: 'var(--font-mono)' }}>
              {closedPositions.length}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="HedgeFlow-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Pool</th>
                  <th style={{ textAlign: 'right' }}>Deposit</th>
                  <th style={{ textAlign: 'right' }}>Withdrawal</th>
                  <th style={{ textAlign: 'right' }}>IL</th>
                  <th style={{ textAlign: 'right' }}>Compensation</th>
                  <th style={{ textAlign: 'right' }}>Closed</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map(pos => (
                  <tr key={pos.id}>
                    <td style={{ textAlign: 'left' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#a855f7' }}>
                        {shortAddr(pos.pool_id)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatUsd(pos.deposit_value_usd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatUsd(pos.withdrawal_value_usd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#f87171' }}>
                      {formatUsd(pos.realized_il_usd)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#34d399' }}>
                      {formatUsd(pos.compensation_paid_usd)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {formatDate(pos.withdrawal_timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && openPositions.length === 0 && closedPositions.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            gap: '12px',
            border: '1px dashed var(--border-accent)',
            borderRadius: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem' }}>📭</div>
          <p style={{ fontWeight: 600 }}>No LP positions found</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Add liquidity to a HedgeFlow-protected pool to get started.
          </p>
        </div>
      )}
    </div>
  );
}
