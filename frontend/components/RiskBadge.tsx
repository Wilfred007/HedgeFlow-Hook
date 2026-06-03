import React from 'react';

const RISK_CONFIG: Record<string, {
  bg: string; border: string; color: string; dot: string; label: string;
}> = {
  NORMAL: {
    bg:     'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.35)',
    color:  '#34d399',
    dot:    '#10b981',
    label:  'NORMAL',
  },
  ELEVATED: {
    bg:     'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.35)',
    color:  '#fbbf24',
    dot:    '#f59e0b',
    label:  'ELEVATED',
  },
  DEFENSIVE: {
    bg:     'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.35)',
    color:  '#fb923c',
    dot:    '#f97316',
    label:  'DEFENSIVE',
  },
  CRISIS: {
    bg:     'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.45)',
    color:  '#f87171',
    dot:    '#ef4444',
    label:  'CRISIS',
  },
};

interface RiskBadgeProps {
  mode: string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ mode, score, size = 'md' }: RiskBadgeProps) {
  const cfg = RISK_CONFIG[mode] ?? RISK_CONFIG.NORMAL;
  const isCrisis = mode === 'CRISIS';

  const sizeStyle: Record<string, React.CSSProperties> = {
    sm: { fontSize: '0.68rem', padding: '3px 10px', gap: '5px' },
    md: { fontSize: '0.75rem', padding: '5px 12px', gap: '6px' },
    lg: { fontSize: '0.875rem', padding: '7px 16px', gap: '8px' },
  };

  const dotSize: Record<string, number> = { sm: 5, md: 7, lg: 8 };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: cfg.color,
        fontWeight: 700,
        letterSpacing: '0.08em',
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap',
        animation: isCrisis ? 'glow-pulse 1.5s ease-in-out infinite' : undefined,
        boxShadow: isCrisis
          ? `0 0 12px rgba(239,68,68,0.35), inset 0 0 8px rgba(239,68,68,0.05)`
          : undefined,
        ...sizeStyle[size],
      }}
    >
      {/* Pulsing dot */}
      <span
        style={{
          width: `${dotSize[size]}px`,
          height: `${dotSize[size]}px`,
          borderRadius: '50%',
          background: cfg.dot,
          boxShadow: `0 0 ${dotSize[size]}px ${cfg.dot}`,
          display: 'inline-block',
          animation: isCrisis ? 'glow-pulse 1s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }}
      />
      <span>{cfg.label}</span>
      {score !== undefined && (
        <span style={{ opacity: 0.6, fontWeight: 500 }}>
          ({score})
        </span>
      )}
    </span>
  );
}
