'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { usePrivy } from '@privy-io/react-auth';

function shortAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

export function LandingNav() {
  const navRef    = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  let privyHook = {
    ready: false, authenticated: false,
    login: () => {}, logout: () => {},
    user: null as ReturnType<typeof usePrivy>['user'],
  };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    privyHook = usePrivy();
  } catch {}

  const { ready, authenticated, login, logout, user } = privyHook;
  const walletAddr = user?.wallet?.address;

  // Entrance animation
  useEffect(() => {
    gsap.fromTo(
      navRef.current,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 4.2 }
    );
  }, []);

  // Scroll handler
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        opacity: 0,
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease, border-color 0.4s ease',
        background: scrolled ? 'rgba(2,2,9,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 32px',
          height: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            textDecoration: 'none', flexShrink: 0,
          }}
          data-cursor
        >
          <div
            style={{
              width: '32px', height: '32px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px',
              boxShadow: '0 0 20px rgba(124,58,237,0.5)',
            }}
          >
            ⬡
          </div>
          <span
            style={{
              fontSize: '1rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #e0d7ff, #c084fc)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            HedgeFlow
          </span>
        </Link>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/dashboard"
            data-cursor
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: 'rgba(220,220,255,0.6)',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.07)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#ffffff';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'rgba(220,220,255,0.6)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
            }}
          >
            Dashboard
          </Link>

          {!ready ? null : authenticated && walletAddr ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  padding: '7px 14px',
                  background: 'rgba(124,58,237,0.1)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  color: '#c084fc',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 6px #10b981', display: 'inline-block' }} />
                {shortAddr(walletAddr)}
              </div>
              <button
                onClick={logout}
                style={{
                  padding: '7px 12px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'rgba(160,160,200,0.4)',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              data-cursor
              style={{
                padding: '8px 22px',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: '1px solid rgba(168,85,247,0.3)',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#ffffff',
                fontFamily: 'inherit',
                boxShadow: '0 0 24px rgba(124,58,237,0.35)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(124,58,237,0.55)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(124,58,237,0.35)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
