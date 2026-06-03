// Contract addresses from environment (set after running SetupTestPool.s.sol)
export const TOKEN0        = (process.env.NEXT_PUBLIC_TOKEN0        ?? '0x') as `0x${string}`;
export const TOKEN0_SYMBOL =  process.env.NEXT_PUBLIC_TOKEN0_SYMBOL ?? 'TOKEN0';
export const TOKEN1        = (process.env.NEXT_PUBLIC_TOKEN1        ?? '0x') as `0x${string}`;
export const TOKEN1_SYMBOL =  process.env.NEXT_PUBLIC_TOKEN1_SYMBOL ?? 'TOKEN1';
export const TEST_ROUTER   = (process.env.NEXT_PUBLIC_TEST_ROUTER   ?? '0x') as `0x${string}`;
export const POOL_MANAGER  = (process.env.NEXT_PUBLIC_POOL_MANAGER  ?? '0x') as `0x${string}`;
export const HEDGEFLOW_HOOK = (process.env.NEXT_PUBLIC_HEDGEFLOW_HOOK ?? '0x') as `0x${string}`;

// Pool parameters
export const DYNAMIC_FEE_FLAG = 8388608; // 0x800000
export const TICK_SPACING     = 60;
export const TICK_LOWER       = -887220;
export const TICK_UPPER       =  887220;

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ name: '',        type: 'uint256'  }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '',      type: 'uint256'  }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs:  [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '',        type: 'bool'    }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs:  [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const;

const POOL_KEY_COMPONENTS = [
  { name: 'currency0',   type: 'address' },
  { name: 'currency1',   type: 'address' },
  { name: 'fee',         type: 'uint24'  },
  { name: 'tickSpacing', type: 'int24'   },
  { name: 'hooks',       type: 'address' },
] as const;

const LP_PARAMS_COMPONENTS = [
  { name: 'tickLower',      type: 'int24'   },
  { name: 'tickUpper',      type: 'int24'   },
  { name: 'liquidityDelta', type: 'int256'  },
  { name: 'salt',           type: 'bytes32' },
] as const;

export const TEST_ROUTER_ABI = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'key',        type: 'tuple', components: POOL_KEY_COMPONENTS },
      { name: 'zeroForOne', type: 'bool'    },
      { name: 'amountIn',   type: 'uint256' },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'key',    type: 'tuple', components: POOL_KEY_COMPONENTS },
      { name: 'params', type: 'tuple', components: LP_PARAMS_COMPONENTS },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'key',    type: 'tuple', components: POOL_KEY_COMPONENTS },
      { name: 'params', type: 'tuple', components: LP_PARAMS_COMPONENTS },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
] as const;
