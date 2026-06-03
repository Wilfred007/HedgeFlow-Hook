import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';
import { baseSepolia, arbitrumSepolia } from 'viem/chains';
import type { Chain } from 'viem';

// Unichain Sepolia custom chain
const unichainSepolia = {
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
    public:  { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://sepolia.uniscan.xyz' },
  },
  testnet: true,
} as const satisfies Chain;

export { unichainSepolia };

export const wagmiConfig = createConfig({
  chains: [unichainSepolia, baseSepolia, arbitrumSepolia],
  transports: {
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
    [baseSepolia.id]:     http(),
    [arbitrumSepolia.id]: http(),
  },
});
