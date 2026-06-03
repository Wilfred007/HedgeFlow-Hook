'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi';
import { WagmiProvider }                        from 'wagmi';
import { PrivyProvider }                        from '@privy-io/react-auth';
import { wagmiConfig, unichainSepolia }         from '@/lib/wagmi';
import { useEffect, useState }                  from 'react';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

  // ── Without Privy (SSR pre-render OR appId not yet configured) ──────────────
  // Still provide WagmiProvider so hooks like useAccount don't throw.
  if (!mounted || !appId) {
    return (
      <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  // ── With Privy ───────────────────────────────────────────────────────────────
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#7c3aed',
          landingHeader: 'Connect to HedgeFlow',
          loginMessage: 'Protect your LP positions with AI-enhanced risk scoring.',
          walletChainType: 'ethereum-only',
        },
        defaultChain: unichainSepolia,
        supportedChains: [unichainSepolia],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        loginMethods: ['wallet', 'email', 'google'],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig} reconnectOnMount={false}>
          {children}
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
