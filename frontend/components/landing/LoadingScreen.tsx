'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  onComplete: () => void;
}

const STATUSES = [
  'Connecting to Unichain Sepolia...',
  'Loading protocol state...',
  'Initializing risk engine...',
  'Calibrating fee curves...',
  'System ready.',
];

export function LoadingScreen({ onComplete }: Props) {
  // Panels (split-screen curtain)
  const panelTopRef = useRef<HTMLDivElement>(null);
  const panelBotRef = useRef<HTMLDivElement>(null);

  // Content (sits above both panels)
  const logoRef     = useRef<HTMLDivElement>(null);
  const counterRef  = useRef<HTMLDivElement>(null);
  const statusRef   = useRef<HTMLDivElement>(null);
  const tlRef       = useRef<HTMLDivElement>(null);
  const trRef       = useRef<HTMLDivElement>(null);
  const blRef       = useRef<HTMLDivElement>(null);
  const brRef       = useRef<HTMLDivElement>(null);
  const line1Ref    = useRef<HTMLDivElement>(null);
  const line2Ref    = useRef<HTMLDivElement>(null);
  const line3Ref    = useRef<HTMLDivElement>(null);
  const dividerRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = [
      tlRef.current, trRef.current, blRef.current, brRef.current,
      logoRef.current, counterRef.current, statusRef.current, dividerRef.current,
    ];

    gsap.set(els, { opacity: 0 });
    gsap.set(logoRef.current, { scale: 0.75, y: 8 });
    gsap.set([line1Ref.current, line2Ref.current, line3Ref.current], {
      scaleX: 0, transformOrigin: 'left center',
    });

    const progress  = { val: 0 };
    let statusIdx   = 0;

    const tl = gsap.timeline();

    // ── Phase 1: Environment appears ───────────────────────────────────────────
    tl
      .to([tlRef.current, trRef.current, blRef.current, brRef.current], {
        opacity: 1, duration: 0.55, stagger: 0.07, ease: 'power2.out',
      })
      .to(logoRef.current, {
        opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'expo.out',
      }, '-=0.25')
      .to(dividerRef.current, { opacity: 1, duration: 0.4 }, '-=0.3')

      // Scanning lines sweep left→right
      .to(line1Ref.current, { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, 0.3)
      .to(line2Ref.current, { scaleX: 1, duration: 1.4, ease: 'power2.inOut' }, 0.55)
      .to(line3Ref.current, { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, 0.8)

      .to(counterRef.current, { opacity: 1, duration: 0.35 }, 0.6)
      .to(statusRef.current,  { opacity: 1, duration: 0.35 }, 0.7)

    // ── Phase 2: Counter runs 000 → 100 ────────────────────────────────────────
      .to(progress, {
        val: 100,
        duration: 2.1,
        ease: 'power1.inOut',
        onUpdate() {
          const v = Math.round(progress.val);
          if (counterRef.current) {
            counterRef.current.textContent = String(v).padStart(3, '0');
          }
          const idx = Math.min(Math.floor(v / 22), STATUSES.length - 1);
          if (idx !== statusIdx && statusRef.current) {
            statusIdx = idx;
            gsap.to(statusRef.current, {
              opacity: 0, duration: 0.12,
              onComplete() {
                if (statusRef.current) statusRef.current.textContent = STATUSES[idx];
                gsap.to(statusRef.current, { opacity: 1, duration: 0.18 });
              },
            });
          }
        },
      }, 0.8)

    // ── Phase 3: Flash + hold ───────────────────────────────────────────────────
      .to(counterRef.current, { color: '#ffffff', textShadow: '0 0 40px rgba(168,85,247,0.9)', duration: 0.08 })
      .to(counterRef.current, { color: 'rgba(168,85,247,0.75)', textShadow: 'none', duration: 0.25 })
      .to({}, { duration: 0.2 })

    // ── Phase 4: Call onComplete, then split the curtain ───────────────────────
      .call(() => onComplete())

      // Fade out the content layer first
      .to(
        [logoRef.current, counterRef.current, statusRef.current, dividerRef.current,
         tlRef.current, trRef.current, blRef.current, brRef.current,
         line1Ref.current, line2Ref.current, line3Ref.current],
        { opacity: 0, duration: 0.35, ease: 'power2.in' },
        '+=0.04'
      )

      // Panels split apart
      .to(panelTopRef.current, {
        yPercent: -100, duration: 1.0, ease: 'expo.inOut',
      }, '-=0.15')
      .to(panelBotRef.current, {
        yPercent: 100, duration: 1.0, ease: 'expo.inOut',
      }, '<');

    return () => { tl.kill(); };
  }, [onComplete]);

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const panelBase: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    background: '#030310',
    zIndex: 9998,
  };

  const cornerBase: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    fontSize: '0.56rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.7,
    color: 'rgba(140,110,230,0.38)',
    pointerEvents: 'none',
  };

  const scanLine: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: '1px',
    zIndex: 10000,
    background:
      'linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.25) 15%, rgba(124,58,237,0.12) 85%, transparent 100%)',
    pointerEvents: 'none',
  };

  return (
    <>
      {/* ── Curtain panels ── */}
      <div ref={panelTopRef} style={{ ...panelBase, top: 0, height: '50vh' }} />
      <div ref={panelBotRef} style={{ ...panelBase, top: '50vh', bottom: 0 }} />

      {/* ── Corner labels ── */}
      <div ref={tlRef} style={{ ...cornerBase, top: '28px', left: '32px' }}>
        HedgeFlow<br />
        <span style={{ color: 'rgba(140,110,230,0.2)' }}>Protocol v1.0</span>
      </div>
      <div ref={trRef} style={{ ...cornerBase, top: '28px', right: '32px', textAlign: 'right' }}>
        Chain 1301<br />
        <span style={{ color: 'rgba(140,110,230,0.2)' }}>Unichain Sepolia</span>
      </div>
      <div ref={blRef} style={{ ...cornerBase, bottom: '28px', left: '32px' }}>
        Uniswap V4 Hook<br />
        <span style={{ color: 'rgba(140,110,230,0.2)' }}>2026</span>
      </div>
      <div ref={brRef} style={{ ...cornerBase, bottom: '28px', right: '32px', textAlign: 'right' }}>
        Adaptive Liquidity<br />
        <span style={{ color: 'rgba(140,110,230,0.2)' }}>Protection</span>
      </div>

      {/* ── Scanning lines ── */}
      <div ref={line1Ref} style={{ ...scanLine, top: '22vh' }} />
      <div ref={line2Ref} style={{ ...scanLine, top: '50vh' }} />
      <div ref={line3Ref} style={{ ...scanLine, top: '78vh' }} />

      {/* ── Central content (above both panels) ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          gap: 0,
        }}
      >
        {/* Logo mark */}
        <div ref={logoRef} style={{ marginBottom: '20px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              borderRadius: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 0 48px rgba(124,58,237,0.5), 0 0 100px rgba(124,58,237,0.18)',
            }}
          >
            ⬡
          </div>
        </div>

        {/* Thin divider */}
        <div
          ref={dividerRef}
          style={{
            width: '1px',
            height: '28px',
            background: 'linear-gradient(180deg, rgba(124,58,237,0.4) 0%, rgba(124,58,237,0.08) 100%)',
            marginBottom: '12px',
          }}
        />

        {/* Giant counter */}
        <div
          ref={counterRef}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(5.5rem, 19vw, 17rem)',
            fontWeight: 200,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            color: 'rgba(168,85,247,0.72)',
          }}
        >
          000
        </div>

        {/* Status text */}
        <div
          ref={statusRef}
          style={{
            marginTop: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(140,110,230,0.35)',
          }}
        >
          {STATUSES[0]}
        </div>
      </div>
    </>
  );
}
