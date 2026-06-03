'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num:    '01',
    title:  'Swap Executed',
    desc:   'A trader swaps tokens through the HedgeFlow-hooked Uniswap v4 pool on Unichain Sepolia. The hook fires SwapExecuted and ReserveAllocated events — 0.20% of the swap value routes to the Reserve Vault.',
    color:  '#7c3aed',
    glyph:  '⇄',
  },
  {
    num:    '02',
    title:  'Reactive Network Detects',
    desc:   'Reactive Network\'s event listener picks up the on-chain event in under a block. No keeper, no cron job, no human in the loop — just pure reactive automation firing instantly.',
    color:  '#22d3ee',
    glyph:  '⚡',
  },
  {
    num:    '03',
    title:  'AI Scores the Risk',
    desc:   'The HedgeFlow risk engine computes a composite 0–100 score from volatility, liquidity stress, whale activity, and reserve pressure — enhanced with xAI Grok sentiment data.',
    color:  '#a855f7',
    glyph:  '🧠',
  },
  {
    num:    '04',
    title:  'Mode Transitions On-Chain',
    desc:   'If the score crosses a threshold, RiskManager.setRiskMode() is called autonomously. Fees and IL coverage update instantly — NORMAL → ELEVATED → DEFENSIVE → CRISIS.',
    color:  '#10b981',
    glyph:  '⬡',
  },
];

export function HowItWorksSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const lineRef     = useRef<HTMLDivElement>(null);
  const stepsRef    = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Animate the vertical timeline line
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 60%',
      end: 'bottom 60%',
      scrub: 1,
      onUpdate(self) {
        if (lineRef.current) {
          lineRef.current.style.transform = `scaleY(${self.progress})`;
        }
      },
    });

    // Animate each step
    stepsRef.current.forEach((el, i) => {
      if (!el) return;
      ScrollTrigger.create({
        trigger: el,
        start: 'top 78%',
        once: true,
        onEnter() {
          gsap.fromTo(
            el,
            { opacity: 0, x: i % 2 === 0 ? -40 : 40 },
            { opacity: 1, x: 0, duration: 0.9, ease: 'power3.out' }
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
        background: 'rgba(0,0,0,0.2)',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '400px',
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '80px' }}>
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
            On-Chain Architecture
          </div>
          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              lineHeight: 1.1,
            }}
          >
            How HedgeFlow works
          </h2>
        </div>

        {/* Steps with vertical timeline */}
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0, bottom: 0,
              width: '1px',
              background: 'rgba(124,58,237,0.1)',
              transform: 'translateX(-50%)',
            }}
          >
            <div
              ref={lineRef}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '100%',
                background: 'linear-gradient(180deg, #7c3aed, #22d3ee)',
                transformOrigin: 'top',
                transform: 'scaleY(0)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                ref={el => { stepsRef.current[i] = el; }}
                style={{
                  opacity: 0,
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 1fr',
                  gap: '0',
                  alignItems: 'center',
                  marginBottom: '40px',
                }}
              >
                {/* Left content (odd steps) */}
                <div style={{ padding: '0 40px 0 0', textAlign: 'right' }}>
                  {i % 2 === 0 ? <StepContent step={step} /> : null}
                </div>

                {/* Center node */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      background: `${step.color}15`,
                      border: `1px solid ${step.color}50`,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      boxShadow: `0 0 20px ${step.color}25`,
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {step.glyph}
                  </div>
                </div>

                {/* Right content (even steps) */}
                <div style={{ padding: '0 0 0 40px', textAlign: 'left' }}>
                  {i % 2 === 1 ? <StepContent step={step} /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepContent({ step }: { step: typeof STEPS[number] }) {
  return (
    <div
      style={{
        padding: '28px',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${step.color}20`,
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: `${step.color}80`,
        }}
      >
        STEP {step.num}
      </div>
      <h3
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#ffffff',
        }}
      >
        {step.title}
      </h3>
      <p
        style={{
          fontSize: '0.82rem',
          color: 'rgba(160,160,200,0.6)',
          lineHeight: 1.7,
        }}
      >
        {step.desc}
      </p>
    </div>
  );
}
