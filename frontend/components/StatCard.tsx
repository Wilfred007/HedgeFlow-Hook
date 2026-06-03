import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  highlight?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ label, value, sub, icon, highlight, trend }: StatCardProps) {
  return (
    <div
      className="glass-card"
      style={{
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative',
        overflow: 'hidden',
        background: highlight
          ? 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(79,70,229,0.06) 100%)'
          : 'linear-gradient(135deg, rgba(15,15,30,0.9) 0%, rgba(12,12,24,0.85) 100%)',
        border: highlight
          ? '1px solid rgba(124,58,237,0.35)'
          : '1px solid var(--border)',
      }}
    >
      {/* Accent line at top for highlighted cards */}
      {highlight && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #7c3aed, #a855f7, transparent)',
          }}
        />
      )}

      {/* Label row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          fontWeight: 500,
          letterSpacing: '0.03em',
        }}
      >
        {icon && (
          <span
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: highlight ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            {icon}
          </span>
        )}
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.68rem', fontWeight: 700 }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div
        className="stat-value"
        style={{
          color: highlight ? '#c084fc' : 'var(--text-primary)',
          ...(highlight ? {
            background: 'linear-gradient(135deg, #c084fc, #7c3aed)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          } : {}),
        }}
      >
        {value}
      </div>

      {/* Sub label */}
      {sub && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-4px' }}>
          {sub}
        </div>
      )}

      {/* Trend indicator */}
      {trend && trend !== 'neutral' && (
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: trend === 'up' ? '#34d399' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {trend === 'up' ? '↑' : '↓'}
        </div>
      )}
    </div>
  );
}
