'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HeroCanvas = dynamic(
  () => import('./HeroCanvas').then((m) => ({ default: m.HeroCanvas })),
  { ssr: false }
);

// ─── Noise grain overlay (inline SVG data URI) ────────────────────────────────

const GRAIN_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

// ─── Stat item ────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <span
        style={{
          fontSize: 'clamp(1.6rem, 2.8vw, 2.6rem)',
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          color: '#ffffff',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '0.58rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'rgba(140, 110, 230, 0.4)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

export function HeroSection() {
  const sectionRef    = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const topBarRef     = useRef<HTMLDivElement>(null);
  const labelRef      = useRef<HTMLDivElement>(null);
  const line1Ref      = useRef<HTMLHeadingElement>(null);
  const line2aRef     = useRef<HTMLSpanElement>(null);
  const line2bRef     = useRef<HTMLSpanElement>(null);
  const line3Ref      = useRef<HTMLHeadingElement>(null);
  const subRef        = useRef<HTMLDivElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const sideTextRef   = useRef<HTMLDivElement>(null);
  const mouseRef      = useRef({ x: 0, y: 0 });

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Entrance + scroll animations
  useEffect(() => {
    const delay = 4.2; // after loader curtain fully clears

    // Initial states
    gsap.set(
      [topBarRef.current, labelRef.current, subRef.current, scrollRef.current, sideTextRef.current],
      { opacity: 0, y: 18 }
    );
    gsap.set(
      [line1Ref.current, line2aRef.current, line2bRef.current, line3Ref.current],
      { yPercent: 110 }
    );

    // Entrance timeline
    const tl = gsap.timeline({ delay });

    tl.to(topBarRef.current,  { opacity: 1, y: 0, duration: 1,   ease: 'power3.out' })
      .to(labelRef.current,   { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, '-=0.55')
      .to(
        [line1Ref.current, line2aRef.current, line2bRef.current, line3Ref.current],
        { yPercent: 0, duration: 1.3, stagger: 0.1, ease: 'expo.out' },
        '-=0.5'
      )
      .to(subRef.current,    { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.65')
      .to(scrollRef.current, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.4')
      .to(sideTextRef.current, { opacity: 1, y: 0, duration: 0.6 }, '-=0.5');

    // Scroll parallax on canvas
    if (canvasWrapRef.current) {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.2,
        onUpdate: (self) => {
          if (canvasWrapRef.current) {
            gsap.to(canvasWrapRef.current, {
              y: self.progress * 100,
              opacity: 1 - self.progress * 1.4,
              duration: 0,
            });
          }
        },
      });
    }

    return () => { tl.kill(); ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflow: 'hidden',
        background: '#030310',
      }}
    >
      {/* ── Canvas layer ── */}
      <div
        ref={canvasWrapRef}
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      >
        <HeroCanvas mouseRef={mouseRef} />
      </div>

      {/* ── Vignette — darkens centre outward to make text readable ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 75% 85% at 50% 50%, transparent 25%, rgba(3,3,16,0.6) 65%, #030310 88%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* ── Bottom gradient ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '38vh',
          background: 'linear-gradient(to top, #030310 0%, transparent 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* ── Grain texture ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${GRAIN_URL}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
          opacity: 0.028,
          pointerEvents: 'none',
          zIndex: 2,
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Content ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          padding: '0 clamp(28px, 5.5vw, 88px)',
        }}
      >
        {/* Top bar */}
        <div
          ref={topBarRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '36px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                letterSpacing: '0.2em',
                color: 'rgba(140,110,230,0.4)',
              }}
            >
              01
            </span>
            <div
              style={{
                width: '36px', height: '1px',
                background: 'rgba(140,110,230,0.18)',
              }}
            />
            <span
              style={{
                fontSize: '0.58rem',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(140,110,230,0.35)',
              }}
            >
              Hedgeflow
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span
              style={{
                fontSize: '0.58rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(140,110,230,0.28)',
              }}
            >
              Adaptive Liquidity Protection
            </span>
            <div
              style={{ width: '1px', height: '12px', background: 'rgba(140,110,230,0.15)' }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.58rem',
                letterSpacing: '0.12em',
                color: 'rgba(140,110,230,0.28)',
              }}
            >
              2026
            </span>
          </div>
        </div>

        {/* Spacer — pushes content toward lower half */}
        <div style={{ flex: 1 }} />

        {/* ── Main content block ── */}
        <div style={{ paddingBottom: 'clamp(72px, 9vh, 110px)' }}>

          {/* Pre-label */}
          <div
            ref={labelRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '28px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '7px', height: '7px',
                borderRadius: '50%',
                background: '#7c3aed',
                boxShadow: '0 0 12px rgba(124,58,237,0.8), 0 0 24px rgba(124,58,237,0.4)',
              }}
            />
            <span
              style={{
                fontSize: '0.62rem',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(168,130,255,0.5)',
              }}
            >
              Uniswap V4 Hook Protocol
            </span>
          </div>

          {/* ── Headline ── */}
          <div
            style={{
              marginBottom: '44px',
              userSelect: 'none',
            }}
          >
            {/* Line 1: PROTECT */}
            <div style={{ overflow: 'hidden', lineHeight: 0.88 }}>
              <h1
                ref={line1Ref}
                style={{
                  fontSize: 'clamp(3.8rem, 11vw, 11.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  lineHeight: 0.88,
                  margin: 0,
                  display: 'block',
                }}
              >
                PROTECT
              </h1>
            </div>

            {/* Line 2: EVERY LP — two styled words */}
            <div
              style={{
                overflow: 'hidden',
                lineHeight: 0.88,
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.22em',
              }}
            >
              {/* EVERY — outlined / stroke text */}
              <span
                ref={line2aRef}
                style={{
                  display: 'inline-block',
                  fontSize: 'clamp(3.8rem, 11vw, 11.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 0.88,
                  WebkitTextStroke: '1.5px rgba(160,100,255,0.55)',
                  color: 'transparent',
                }}
              >
                EVERY
              </span>
              {/* LP — gradient fill */}
              <span
                ref={line2bRef}
                style={{
                  display: 'inline-block',
                  fontSize: 'clamp(3.8rem, 11vw, 11.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 0.88,
                  background: 'linear-gradient(135deg, #c084fc 0%, #7c3aed 60%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                LP
              </span>
            </div>

            {/* Line 3: POSITION. */}
            <div style={{ overflow: 'hidden', lineHeight: 0.88 }}>
              <h1
                ref={line3Ref}
                style={{
                  fontSize: 'clamp(3.8rem, 11vw, 11.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: 'rgba(210,195,255,0.22)',
                  lineHeight: 0.88,
                  margin: 0,
                  display: 'block',
                }}
              >
                POSITION.
              </h1>
            </div>
          </div>

          {/* ── Footer row: subtext + stats ── */}
          <div
            ref={subRef}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '40px',
              flexWrap: 'wrap',
            }}
          >
            {/* Left: descriptor + CTA */}
            <div>
              {/* Horizontal rule */}
              <div
                style={{
                  width: '48px',
                  height: '1px',
                  background: 'rgba(140,110,230,0.25)',
                  marginBottom: '20px',
                }}
              />

              <p
                style={{
                  fontSize: 'clamp(0.78rem, 1.3vw, 0.96rem)',
                  color: 'rgba(190,170,255,0.45)',
                  lineHeight: 1.75,
                  maxWidth: '360px',
                  margin: '0 0 28px',
                  fontWeight: 300,
                  letterSpacing: '0.01em',
                }}
              >
                Dynamic fees. Reserve-backed compensation.
                <br />
                AI-enhanced risk classification — all on-chain.
              </p>

              {/* CTA */}
              <Link
                href="/dashboard"
                data-cursor
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '13px 28px',
                  background: 'transparent',
                  border: '1px solid rgba(140,80,255,0.32)',
                  borderRadius: '4px',
                  color: 'rgba(210,185,255,0.85)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.35s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(124,58,237,0.12)';
                  el.style.borderColor = 'rgba(168,85,247,0.55)';
                  el.style.color = '#ffffff';
                  el.style.boxShadow = '0 0 28px rgba(124,58,237,0.25), inset 0 0 28px rgba(124,58,237,0.06)';
                  el.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'transparent';
                  el.style.borderColor = 'rgba(140,80,255,0.32)';
                  el.style.color = 'rgba(210,185,255,0.85)';
                  el.style.boxShadow = 'none';
                  el.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>↗</span>
                Launch App
              </Link>
            </div>

            {/* Right: stats */}
            <div
              style={{
                display: 'flex',
                gap: 'clamp(24px, 4vw, 52px)',
                alignItems: 'flex-end',
              }}
            >
              <Stat value="4"   label="Risk modes"    />
              <Stat value="V4"  label="Uniswap hook"  />
              <Stat value="AI"  label="Risk engine"   />
            </div>
          </div>
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <div
        ref={scrollRef}
        style={{
          position: 'absolute',
          bottom: '36px',
          left: 'clamp(28px, 5.5vw, 88px)',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div
          style={{
            width: '1px',
            height: '52px',
            background: 'linear-gradient(180deg, rgba(124,58,237,0) 0%, rgba(124,58,237,0.5) 100%)',
            animation: 'scrollPulse 2.2s ease-in-out infinite',
          }}
        />
        <span
          style={{
            fontSize: '0.55rem',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'rgba(140,110,230,0.28)',
            writingMode: 'horizontal-tb',
          }}
        >
          Scroll to explore
        </span>
      </div>

      {/* ── Left edge vertical label ── */}
      <div
        ref={sideTextRef}
        style={{
          position: 'absolute',
          left: '18px',
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          zIndex: 3,
          fontSize: '0.52rem',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(130,100,210,0.2)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        Hedgeflow Protocol — Unichain Sepolia
      </div>

      {/* ── Right edge version tag ── */}
      <div
        style={{
          position: 'absolute',
          right: '18px',
          top: '50%',
          transform: 'translateY(-50%) rotate(90deg)',
          zIndex: 3,
          fontSize: '0.52rem',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(130,100,210,0.18)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        v 1.0 — 2026
      </div>
    </section>
  );
}
