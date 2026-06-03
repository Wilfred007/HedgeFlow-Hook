'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function FooterSection() {
  const sectionRef  = useRef<HTMLElement>(null);
  const bigTextRef  = useRef<HTMLDivElement>(null);
  const ctaRef      = useRef<HTMLDivElement>(null);
  const linksRef    = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLCanvasElement>(null);

  // Particle canvas
  useEffect(() => {
    const canvas = particlesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles: {
      x: number; y: number; vx: number; vy: number;
      size: number; opacity: number; color: string;
    }[] = [];

    const colors = ['#7c3aed', '#a855f7', '#22d3ee', '#5b21b6'];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x:       Math.random() * canvas.width,
        y:       Math.random() * canvas.height,
        vx:      (Math.random() - 0.5) * 0.3,
        vy:      (Math.random() - 0.5) * 0.3,
        size:    Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        color:   colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let rafId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.opacity * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }
      rafId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Scroll animation
  useEffect(() => {
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 75%',
      once: true,
      onEnter() {
        if (!bigTextRef.current) return;

        const split = new SplitText(bigTextRef.current, { type: 'chars' });
        gsap.fromTo(
          split.chars,
          { opacity: 0, y: 80, rotateX: -60 },
          {
            opacity: 1, y: 0, rotateX: 0,
            duration: 0.8,
            stagger: 0.025,
            ease: 'power3.out',
            onComplete: () => split.revert(),
          }
        );

        const targets = [ctaRef.current, linksRef.current].filter(Boolean);
        if (targets.length > 0) {
          gsap.fromTo(
            targets,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out', delay: 0.5 }
          );
        }
      },
    });
  }, []);

  const NAV = [
    { href: '/dashboard',  label: 'Dashboard'  },
    { href: '/analytics',  label: 'Analytics'  },
    { href: '/lp',         label: 'Positions'  },
    { href: '/test-pool',  label: 'Test Pool'  },
    { href: '/chat',       label: 'AI Advisor' },
    { href: '/ai-test',    label: 'AI Lab'     },
  ];

  return (
    <footer
      ref={sectionRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: '#010108',
        padding: '100px 24px 48px',
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={particlesRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          bottom: '-100px', left: '50%',
          transform: 'translateX(-50%)',
          width: '800px', height: '400px',
          background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Big CTA text */}
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(168,85,247,0.5)',
              marginBottom: '32px',
            }}
          >
            Start Protecting
          </div>
          <div
            ref={bigTextRef}
            style={{
              fontSize: 'clamp(3rem, 10vw, 9rem)',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
              color: 'transparent',
              WebkitTextStroke: '1px rgba(255,255,255,0.12)',
              marginBottom: '48px',
              perspective: '800px',
            }}
          >
            HedgeFlow
          </div>

          <div ref={ctaRef} style={{ opacity: 0 }}>
            <Link
              href="/dashboard"
              data-cursor
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 48px',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                borderRadius: '12px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '1rem',
                textDecoration: 'none',
                border: '1px solid rgba(168,85,247,0.3)',
                boxShadow: '0 0 48px rgba(124,58,237,0.5)',
                transition: 'all 0.3s ease',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 64px rgba(124,58,237,0.7)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 48px rgba(124,58,237,0.5)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              Enter Protocol
              <span style={{ fontSize: '1.2em' }}>→</span>
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          ref={linksRef}
          style={{
            opacity: 0,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px', height: '28px',
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                borderRadius: '7px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px',
                boxShadow: '0 0 16px rgba(124,58,237,0.4)',
              }}
            >
              ⬡
            </div>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #c084fc, #7c3aed)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              HedgeFlow
            </span>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: '0.8rem',
                  color: 'rgba(160,160,200,0.4)',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c084fc'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(160,160,200,0.4)'; }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['Uniswap v4', 'Unichain Sepolia', 'Reactive Network'].map(tag => (
              <span
                key={tag}
                style={{
                  padding: '3px 10px',
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.15)',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  color: 'rgba(168,85,247,0.6)',
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            marginTop: '32px',
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'rgba(160,160,200,0.2)',
            letterSpacing: '0.04em',
          }}
        >
          © 2026 HedgeFlow Protocol · Built on Unichain Sepolia · Not audited — for testing only
        </div>
      </div>
    </footer>
  );
}
