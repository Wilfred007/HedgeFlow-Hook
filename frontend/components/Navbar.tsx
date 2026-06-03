'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const NAV_LINKS = [
  { href: '/dashboard',  label: 'Dashboard'  },
  { href: '/analytics',  label: 'Analytics'  },
  { href: '/lp',         label: 'Positions'  },
  { href: '/test-pool',  label: 'Test Pool'  },
  { href: '/chat',       label: 'AI Advisor' },
  { href: '/ai-test',    label: 'AI Lab'     },
];

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Navbar() {
  const pathname = usePathname();
  // usePrivy will throw if called outside PrivyProvider (e.g. when appId is missing).
  // Wrap in try/catch so the navbar degrades gracefully during SSR / no-appId state.
  let privyHook = { ready: false, authenticated: false, login: () => {}, logout: () => {}, user: null as ReturnType<typeof usePrivy>['user'] };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    privyHook = usePrivy();
  } catch {
    // Privy not yet initialised
  }
  const { ready, authenticated, login, logout, user } = privyHook;
  const walletAddr = user?.wallet?.address;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        background: 'rgba(7, 7, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '32px',
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
          <div
            style={{
              width: '34px', height: '34px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0 0 16px rgba(124,58,237,0.5)',
              flexShrink: 0,
            }}
          >
            ⬡
          </div>
          <span
            style={{
              fontSize: '1.125rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #c084fc, #7c3aed)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            HedgeFlow
          </span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  color: active ? '#a855f7' : 'var(--text-secondary)',
                  background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
                  border: active ? '1px solid rgba(124,58,237,0.2)' : '1px solid transparent',
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* Live indicator */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '999px',
              fontSize: '0.7rem', fontWeight: 600,
              color: '#34d399', letterSpacing: '0.05em',
            }}
          >
            <span
              style={{
                width: '6px', height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
                display: 'inline-block',
                animation: 'glow-pulse 2s ease-in-out infinite',
              }}
            />
            LIVE
          </div>

          {/* Wallet button */}
          {!ready ? (
            // Loading skeleton
            <div
              style={{
                width: '120px', height: '36px',
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.2)',
                borderRadius: '10px',
                animation: 'glow-pulse 1.5s ease-in-out infinite',
              }}
            />
          ) : authenticated && walletAddr ? (
            // Connected state
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Address chip */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '6px 12px',
                  background: 'rgba(124,58,237,0.1)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  borderRadius: '10px',
                  fontSize: '0.78rem', fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color: '#c084fc',
                }}
              >
                <span
                  style={{
                    width: '7px', height: '7px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 6px #10b981',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                {shortAddr(walletAddr)}
              </div>

              {/* Disconnect */}
              <button
                onClick={logout}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-space-grotesk)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = '#f87171';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            // Connect button
            <button
              onClick={login}
              className="btn-primary"
              style={{ fontSize: '0.875rem', padding: '8px 20px', cursor: 'pointer', border: 'none' }}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
