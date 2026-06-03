'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const FEATURES = [
  {
    num: '01',
    title: 'Dynamic Fee Engine',
    desc: 'Fees respond in real-time to on-chain risk conditions. Normal markets pay 0.30% — during a crisis, fees rise to 2.50% to fund the reserve and protect LPs.',
    detail: '0.30% → 2.50%',
    detailLabel: 'Fee Range',
    color: '#7c3aed',
  },
  {
    num: '02',
    title: 'AI Risk Scoring',
    desc: 'A multi-component risk engine analyzes volatility, liquidity stress, whale activity, and reserve pressure — augmented with market sentiment from xAI Grok.',
    detail: '4 components',
    detailLabel: 'Signal Sources',
    color: '#22d3ee',
  },
  {
    num: '03',
    title: 'Reserve-Backed IL Coverage',
    desc: 'Every swap contributes 0.20% to the Reserve Vault. When LPs withdraw during adverse conditions, the protocol automatically compensates impermanent loss.',
    detail: '0-50%',
    detailLabel: 'Coverage Range',
    color: '#a855f7',
  },
  {
    num: '04',
    title: 'Zero-Keeper Automation',
    desc: 'Reactive Network monitors every swap event on Unichain Sepolia and autonomously calls RiskManager.setRiskMode() — no off-chain keepers, no human intervention.',
    detail: '<1 block',
    detailLabel: 'Reaction Time',
    color: '#10b981',
  },
];

function FeatureCard({ feat, index }: { feat: typeof FEATURES[number]; index: number }) {
  const cardRef    = useRef<HTMLDivElement>(null);
  const numRef     = useRef<HTMLDivElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);
  const lineRef    = useRef<HTMLDivElement>(null);
  const detailRef  = useRef<HTMLDivElement>(null);
  const hoverBgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    ScrollTrigger.create({
      trigger: card,
      start: 'top 80%',
      once: true,
      onEnter() {
        gsap.fromTo(
          card,
          { opacity: 0, y: 50, clipPath: 'inset(100% 0 0 0)' },
          {
            opacity: 1, y: 0,
            clipPath: 'inset(0% 0 0 0)',
            duration: 0.9,
            ease: 'power3.out',
            delay: (index % 2) * 0.12,
          }
        );
      },
    });

    // Hover 3D tilt
    const onEnter = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 12;
      const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -12;
      gsap.to(card, { rotateX: y, rotateY: x, duration: 0.4, ease: 'power2.out', transformPerspective: 800 });
      if (hoverBgRef.current) gsap.to(hoverBgRef.current, { opacity: 1, duration: 0.3 });
    };
    const onLeave = () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'power2.out' });
      if (hoverBgRef.current) gsap.to(hoverBgRef.current, { opacity: 0, duration: 0.4 });
    };
    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (hoverBgRef.current) {
        hoverBgRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, ${feat.color}12, transparent 60%)`;
      }
    };

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);
    card.addEventListener('mousemove', onMove);
    return () => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
      card.removeEventListener('mousemove', onMove);
    };
  }, [feat.color, index]);

  return (
    <div
      ref={cardRef}
      style={{
        opacity: 0,
        position: 'relative',
        padding: '36px 32px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        cursor: 'default',
        overflow: 'hidden',
        transformStyle: 'preserve-3d',
        transition: 'border-color 0.3s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${feat.color}30`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
      }}
    >
      {/* Mouse-follow bg */}
      <div
        ref={hoverBgRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          transition: 'none',
          borderRadius: '20px',
          pointerEvents: 'none',
        }}
      />

      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: '32px', right: '32px',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${feat.color}50, transparent)`,
        }}
      />

      {/* Number */}
      <div
        ref={numRef}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: `${feat.color}80`,
        }}
      >
        {feat.num}
      </div>

      {/* Title */}
      <h3
        ref={titleRef}
        style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#ffffff',
          lineHeight: 1.2,
        }}
      >
        {feat.title}
      </h3>

      {/* Divider */}
      <div
        ref={lineRef}
        style={{
          width: '32px',
          height: '1px',
          background: feat.color,
          opacity: 0.5,
        }}
      />

      {/* Description */}
      <p
        style={{
          fontSize: '0.875rem',
          color: 'rgba(160,160,200,0.65)',
          lineHeight: 1.75,
          flex: 1,
        }}
      >
        {feat.desc}
      </p>

      {/* Stat */}
      <div
        ref={detailRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: feat.color,
          }}
        >
          {feat.detail}
        </div>
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(160,160,200,0.4)',
          }}
        >
          {feat.detailLabel}
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ScrollTrigger.create({
      trigger: headRef.current,
      start: 'top 80%',
      once: true,
      onEnter() {
        const h2 = headRef.current?.querySelector('h2');
        const p  = headRef.current?.querySelector('p');
        if (!h2) return;

        const split = new SplitText(h2, { type: 'words' });
        gsap.fromTo(
          split.words,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', onComplete: () => split.revert() }
        );
        if (p) {
          gsap.fromTo(p, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.3, ease: 'power3.out' });
        }
      },
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
      <div ref={headRef} style={{ textAlign: 'center', marginBottom: '72px' }}>
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
          Core Protocol
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
          Built for the on-chain economy
        </h2>
        <p
          style={{
            fontSize: '1rem',
            color: 'rgba(160,160,200,0.55)',
            maxWidth: '480px',
            margin: '0 auto',
            lineHeight: 1.7,
          }}
        >
          Four interlocking systems that continuously monitor, classify, and respond to market conditions.
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.num} feat={f} index={i} />
        ))}
      </div>
    </section>
  );
}
