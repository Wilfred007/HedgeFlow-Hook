import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'HedgeFlow — Adaptive Liquidity Protection',
  description:
    'Protect your LP positions against impermanent loss with AI-enhanced risk scoring and reserve-backed compensation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
        style={{ fontFamily: 'var(--font-space-grotesk), system-ui, sans-serif' }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
