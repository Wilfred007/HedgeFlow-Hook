'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const MODES = [
  {
    mode:    'NORMAL',
    range:   '0 – 30',
    fee:     '0.30%',
    cover:   '20%',
    color:   '#10b981',
    bg:      'rgba(16,185,129,0.06)',
    border:  'rgba(16,185,129,0.2)',
    shadow:  'rgba(16,185,129,0.15)',
    desc:    'Standard market conditions. Baseline fees, minimal protection overhead. LPs enjoy maximum capital efficiency.',
    cond:    'Low volatility · Normal volume · Healthy reserves',
  },
  {
    mode:    'ELEVATED',
    range:   '31 – 55',
    fee:     '0.60%',
    cover:   '30%',
    color:   '#f59e0b',
    bg:      'rgba(245,158,11,0.06)',
    border:  'rgba(245,158,11,0.2)',
    shadow:  'rgba(245,158,11,0.15)',
    desc:    'Increased volatility detected. Fees double to build reserve. Coverage expands to absorb growing IL risk.',
    cond:    'Rising volatility · Whale accumulation · Mild stress',
  },
  {
    mode:    'DEFENSIVE',
    range:   '56 – 80',
    fee:     '1.20%',
    cover:   '40%',
    color:   '#f97316',
    bg:      'rgba(249,115,22,0.06)',
    border:  'rgba(249,115,22,0.2)',
    shadow:  'rgba(249,115,22,0.15)',
    desc:    'High stress. Protocol shifts to protection mode. Fees quadruple to aggressively fund the reserve vault for LP compensation.',
    cond:    'High volatility · Liquidity drain · Reserve pressure',
  },
  {
    mode:    'CRISIS',
    range:   '81 – 100',
    fee:     '2.50%',
    cover:   '50%',
    color:   '#ef4444',
    bg:      'rgba(239,68,68,0.06)',
    border:  'rgba(239,68,68,0.25)',
    shadow:  'rgba(239,68,68,0.2)',
    desc:    'Extreme market conditions. Maximum protection activated. Half of all IL is covered — the reserve vault operates at full capacity.',
    cond:    'Extreme volatility · Market crash · Reserve critical',
  },
];

export function RiskModesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    cardsRef.current.forEach((el, i) => {
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 82%',
        once: true,
        onEnter() {
          gsap.fromTo(
            el,
            { opacity: 0, y: 60, scale: 0.96 },
            {
              opacity: 1, y: 0, scale: 1,
              duration: 0.8,
              ease: 'power3.out',
              delay: i * 0.1,
            }
          );
        },
      });
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '120px 24px',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '72px' }}>
        <div
          style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(168,85,247,0.6)',
            marginBottom: '20px',
          }}
        >
          Adaptive Risk Engine
        </div>
        <h2
          style={{
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: '#ffffff',
            marginBottom: '16px',
          }}
        >
          Four modes. Zero intervention.
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(160,160,200,0.55)',
            maxWidth: '500px',
            margin: '0 auto',
            lineHeight: 1.7,
          }}
        >
          AI risk scores 0–100 trigger automatic protocol-wide mode changes. Every LP position is protected accordingly.
        </p>
      </div>

      {/* Score visualizer */}
      <div
        style={{
          margin: '0 auto 60px',
          maxWidth: '600px',
          padding: '0 8px',
        }}
      >
        <div
          style={{
            height: '6px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '999px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, #10b981 0% 30%, #f59e0b 30% 55%, #f97316 55% 80%, #ef4444 80% 100%)',
              opacity: 0.7,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: 'rgba(160,160,200,0.35)',
          }}
        >
          <span>0</span><span>31</span><span>56</span><span>81</span><span>100</span>
        </div>
      </div>

      {/* Mode cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {MODES.map((m, i) => (
          <div
            key={m.mode}
            ref={el => { cardsRef.current[i] = el; }}
            onClick={() => setActive(i)}
            style={{
              opacity: 0,
              position: 'relative',
              borderRadius: '20px',
              padding: '32px 28px',
              background: active === i ? m.bg : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active === i ? m.border : 'rgba(255,255,255,0.05)'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'hidden',
              transition: 'all 0.4s ease',
              boxShadow: active === i ? `0 0 40px ${m.shadow}, 0 8px 32px rgba(0,0,0,0.3)` : 'none',
              transform: active === i ? 'translateY(-4px)' : 'translateY(0)',
            }}
          >
            {/* Top line */}
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '2px',
                background: `linear-gradient(90deg, transparent, ${m.color}, transparent)`,
                opacity: active === i ? 1 : 0.2,
                transition: 'opacity 0.4s ease',
              }}
            />

            {/* Badge + range */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: `${m.color}15`,
                  border: `1px solid ${m.color}40`,
                  borderRadius: '999px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: m.color,
                }}
              >
                <span
                  style={{
                    width: '5px', height: '5px',
                    background: m.color,
                    borderRadius: '50%',
                    boxShadow: active === i ? `0 0 6px ${m.color}` : 'none',
                  }}
                />
                {m.mode}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: `${m.color}70`,
                  padding: '3px 8px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '6px',
                }}
              >
                {m.range}
              </span>
            </div>

            {/* Fee */}
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  color: active === i ? m.color : '#ffffff',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  transition: 'color 0.4s ease',
                }}
              >
                {m.fee}
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(160,160,200,0.35)',
                  marginTop: '4px',
                }}
              >
                Dynamic Fee
              </div>
            </div>

            {/* IL Cover */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: m.color,
                }}
              >
                {m.cover}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'rgba(160,160,200,0.5)' }}>IL Coverage</span>
            </div>

            {/* Desc */}
            <p
              style={{
                fontSize: '0.8rem',
                color: 'rgba(160,160,200,0.6)',
                lineHeight: 1.65,
              }}
            >
              {m.desc}
            </p>

            {/* Conditions */}
            {active === i && (
              <div
                style={{
                  fontSize: '0.68rem',
                  color: `${m.color}80`,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  paddingTop: '8px',
                  borderTop: `1px solid ${m.color}15`,
                }}
              >
                {m.cond}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
