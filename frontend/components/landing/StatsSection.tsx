'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: 50,    suffix: '%',  label: 'Max IL Coverage',       desc: 'Maximum impermanent loss compensation per position'      },
  { value: 4,     suffix: '',   label: 'Risk Modes',            desc: 'Adaptive protocol states driven by real-time AI scoring' },
  { value: 100,   suffix: 'K', label: 'Blocks Indexed',        desc: 'Continuous on-chain monitoring since deployment'         },
  { value: 0,     suffix: 's', label: 'Keeper Latency',        desc: 'Fully autonomous — Reactive Network fires instantly'     },
];

function StatItem({ stat, index }: { stat: typeof STATS[number]; index: number }) {
  const numRef   = useRef<HTMLSpanElement>(null);
  const itemRef  = useRef<HTMLDivElement>(null);
  const lineRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const counter = { val: 0 };

    ScrollTrigger.create({
      trigger: itemRef.current,
      start: 'top 80%',
      once: true,
      onEnter() {
        gsap.fromTo(
          itemRef.current,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: index * 0.1 }
        );
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 1.2, ease: 'power3.out', delay: index * 0.1 + 0.3, transformOrigin: 'left' }
        );
        gsap.to(counter, {
          val: stat.value,
          duration: 1.8,
          ease: 'power2.out',
          delay: index * 0.1 + 0.2,
          onUpdate() {
            if (numRef.current) {
              numRef.current.textContent = Math.round(counter.val) + stat.suffix;
            }
          },
        });
      },
    });
  }, [stat, index]);

  return (
    <div
      ref={itemRef}
      style={{
        opacity: 0,
        padding: '40px 32px',
        borderRight: index < STATS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
      }}
    >
      <span
        ref={numRef}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: 300,
          letterSpacing: '-0.04em',
          color: '#ffffff',
          lineHeight: 1,
        }}
      >
        0{stat.suffix}
      </span>
      <div>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#c084fc',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '8px',
          }}
        >
          {stat.label}
        </div>
        <div
          ref={lineRef}
          style={{
            width: '40px',
            height: '1px',
            background: 'linear-gradient(90deg, #7c3aed, transparent)',
            marginBottom: '10px',
          }}
        />
        <div
          style={{
            fontSize: '0.8rem',
            color: 'rgba(160,160,200,0.55)',
            lineHeight: 1.6,
            maxWidth: '220px',
          }}
        >
          {stat.desc}
        </div>
      </div>
    </div>
  );
}

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 75%',
      once: true,
      onEnter() {
        gsap.fromTo(
          labelRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
        );
      },
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      {/* Top accent */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)',
        }}
      />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
        {/* Section label */}
        <div
          ref={labelRef}
          style={{
            opacity: 0,
            padding: '48px 32px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(124,58,237,0.6)',
            }}
          >
            Protocol Metrics
          </div>
          <div
            style={{
              flex: 1,
              height: '1px',
              background: 'rgba(124,58,237,0.15)',
              maxWidth: '80px',
            }}
          />
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          }}
        >
          {STATS.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
