'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import type { RiskSnapshot } from '@/lib/api';

interface RiskChartProps {
  snapshots: RiskSnapshot[];
}

const THRESHOLDS = [
  { value: 31,  label: 'ELEVATED',  color: '#f59e0b' },
  { value: 56,  label: 'DEFENSIVE', color: '#f97316' },
  { value: 81,  label: 'CRISIS',    color: '#ef4444' },
];

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: 'rgba(10, 10, 24, 0.95)',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        borderRadius: '10px',
        padding: '12px 16px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.05em' }}>
        {label}
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
            {p.name}
          </span>
          <span style={{ color: p.color, fontWeight: 600, marginLeft: 'auto', paddingLeft: '16px' }}>
            {p.value?.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RiskChart({ snapshots }: RiskChartProps) {
  const data = snapshots
    .slice()
    .reverse()
    .map(s => ({
      time:       new Date(Number(s.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score:      Number(s.risk_score),
      volatility: Number(s.volatility_score),
      liquidity:  Number(s.liquidity_stress_score),
    }));

  return (
    <div style={{ width: '100%', height: '280px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}   />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
            tickCount={6}
          />
          <Tooltip content={<CustomTooltip />} />

          {THRESHOLDS.map(t => (
            <ReferenceLine
              key={t.value}
              y={t.value}
              stroke={t.color}
              strokeDasharray="5 5"
              strokeOpacity={0.4}
              label={{
                value: t.label,
                fill: t.color,
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                dx: 4,
              }}
            />
          ))}

          <Area
            type="monotone"
            dataKey="volatility"
            stroke="#22d3ee"
            strokeWidth={1.5}
            fill="url(#volGrad)"
            dot={false}
            name="Volatility"
            strokeDasharray="5 3"
            strokeOpacity={0.7}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#a855f7"
            strokeWidth={2.5}
            fill="url(#scoreGrad)"
            dot={false}
            name="Risk Score"
            strokeLinecap="round"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
