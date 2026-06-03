'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastUpdated(new Date());
      setTick(t => t + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  const seconds = Math.round((Date.now() - lastUpdated.getTime()) / 1000);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        background: 'rgba(34,211,238,0.06)',
        border: '1px solid rgba(34,211,238,0.15)',
        borderRadius: '999px',
        fontSize: '0.68rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.04em',
      }}
      key={tick}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: '#22d3ee',
          boxShadow: '0 0 6px #22d3ee',
          display: 'inline-block',
          animation: 'glow-pulse 2s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      {seconds < 5 ? 'just updated' : `${seconds}s ago`} · every {intervalMs / 1000}s
    </div>
  );
}
