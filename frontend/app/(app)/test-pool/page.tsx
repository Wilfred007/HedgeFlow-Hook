'use client';

import { useState, useEffect } from 'react';
import {
  useAccount, useChainId, useSwitchChain,
  useReadContracts, useWriteContract, useWaitForTransactionReceipt,
} from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import {
  TOKEN0, TOKEN0_SYMBOL, TOKEN1, TOKEN1_SYMBOL,
  TEST_ROUTER, HEDGEFLOW_HOOK,
  DYNAMIC_FEE_FLAG, TICK_SPACING, TICK_LOWER, TICK_UPPER,
  ERC20_ABI, TEST_ROUTER_ABI,
} from '@/lib/contracts';

const UNICHAIN_SEPOLIA = 1301;
const MINT_AMOUNT  = parseUnits('1000', 18);
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const EXPLORER     = 'https://sepolia.uniscan.xyz/tx/';

const POOL_KEY = {
  currency0:   TOKEN0,
  currency1:   TOKEN1,
  fee:         DYNAMIC_FEE_FLAG,
  tickSpacing: TICK_SPACING,
  hooks:       HEDGEFLOW_HOOK,
} as const;

type OpKey = 'mint0' | 'mint1' | 'approve0' | 'approve1' | 'add' | 'remove' | 'swap';

function fmt(val: bigint | undefined) {
  if (val === undefined) return '…';
  return Number(formatUnits(val, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function shortAddr(addr: string) { return `${addr.slice(0, 8)}…${addr.slice(-6)}`; }

// ─── Token Row ────────────────────────────────────────────────────────────────

function TokenRow({ symbol, balance, allowance, mintBusy, approveBusy, onMint, onApprove }: {
  symbol: string;
  balance: bigint | undefined;
  allowance: bigint | undefined;
  mintBusy: boolean;
  approveBusy: boolean;
  onMint: () => void;
  onApprove: () => void;
}) {
  const approved = allowance !== undefined && allowance > BigInt(0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a855f7' }}>{symbol}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Balance: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmt(balance)}</span>
          {' '}· Allowance:{' '}
          <span style={{ color: approved ? '#10b981' : '#f59e0b', fontFamily: 'var(--font-mono)' }}>
            {approved ? 'max' : fmt(allowance)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onMint}
          disabled={mintBusy}
          style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
            cursor: mintBusy ? 'not-allowed' : 'pointer',
            background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#c084fc',
            opacity: mintBusy ? 0.5 : 1,
          }}
        >
          {mintBusy ? 'Minting…' : 'Mint 1,000'}
        </button>
        <button
          onClick={onApprove}
          disabled={approveBusy || approved}
          style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
            cursor: (approveBusy || approved) ? 'not-allowed' : 'pointer',
            background: approved ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            border: approved ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
            color: approved ? '#34d399' : '#f59e0b',
            opacity: approveBusy ? 0.5 : 1,
          }}
        >
          {approveBusy ? 'Approving…' : approved ? 'Approved ✓' : 'Approve Router'}
        </button>
      </div>
    </div>
  );
}

// ─── Tx Status Banner ─────────────────────────────────────────────────────────

function TxStatus({ hash, isConfirming, isSuccess, error, onDismiss }: {
  hash: `0x${string}` | undefined;
  isConfirming: boolean;
  isSuccess: boolean;
  error: string | null;
  onDismiss: () => void;
}) {
  if (!hash && !error) return null;
  const bg     = error ? 'rgba(239,68,68,0.06)'  : isSuccess ? 'rgba(16,185,129,0.06)'  : 'rgba(124,58,237,0.06)';
  const border = error ? 'rgba(239,68,68,0.2)'   : isSuccess ? 'rgba(16,185,129,0.2)'   : 'rgba(124,58,237,0.2)';
  return (
    <div style={{ padding: '14px 16px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '12px', background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: '1rem', flexShrink: 0 }}>{error ? '❌' : isSuccess ? '✅' : '⏳'}</div>
      <div style={{ flex: 1, fontSize: '0.8rem' }}>
        {error ? (
          <span style={{ color: '#f87171' }}>{error.slice(0, 160)}{error.length > 160 ? '…' : ''}</span>
        ) : isSuccess ? (
          <span style={{ color: '#34d399' }}>
            Confirmed!{' '}
            <a href={`${EXPLORER}${hash}`} target="_blank" rel="noreferrer" style={{ color: '#34d399' }}>View on explorer</a>
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>
            {isConfirming ? 'Confirming' : 'Submitted'}…{' '}
            <a href={`${EXPLORER}${hash}`} target="_blank" rel="noreferrer" style={{ color: '#a855f7' }}>{shortAddr(hash!)}</a>
          </span>
        )}
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestPoolPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  let login: () => void = () => {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const privy = usePrivy();
    login = privy.login;
  } catch { /* PrivyProvider not initialised */ }

  const [pendingOp, setPendingOp] = useState<OpKey | null>(null);
  const [txHash,    setTxHash]    = useState<`0x${string}` | undefined>();
  const [txError,   setTxError]   = useState<string | null>(null);
  const [addAmt,    setAddAmt]    = useState('1000');
  const [removeAmt, setRemoveAmt] = useState('100');
  const [swapAmt,   setSwapAmt]   = useState('100');
  const [swapDir,   setSwapDir]   = useState<'0for1' | '1for0'>('0for1');

  // ── Reads ────────────────────────────────────────────────────────────────────
  const { data: reads, refetch } = useReadContracts({
    contracts: address ? [
      { address: TOKEN0, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] },
      { address: TOKEN1, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] },
      { address: TOKEN0, abi: ERC20_ABI, functionName: 'allowance', args: [address, TEST_ROUTER] },
      { address: TOKEN1, abi: ERC20_ABI, functionName: 'allowance', args: [address, TEST_ROUTER] },
    ] : [],
    query: { enabled: !!address && chainId === UNICHAIN_SEPOLIA },
  });

  const token0Balance   = reads?.[0]?.result as bigint | undefined;
  const token1Balance   = reads?.[1]?.result as bigint | undefined;
  const token0Allowance = reads?.[2]?.result as bigint | undefined;
  const token1Allowance = reads?.[3]?.result as bigint | undefined;

  // ── Writes ───────────────────────────────────────────────────────────────────
  const { writeContract, isPending: isWritePending, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Only the active operation is "busy" — other buttons stay enabled
  const opBusy = (key: OpKey) => pendingOp === key && (isWritePending || isConfirming);

  useEffect(() => {
    if (isTxSuccess) { refetch(); setPendingOp(null); }
  }, [isTxSuccess, refetch]);

  function exec(op: OpKey, addr: `0x${string}`, abi: unknown, fn: string, args: unknown[]) {
    setPendingOp(op);
    setTxError(null);
    setTxHash(undefined);
    writeContract(
      { address: addr, abi: abi as never, functionName: fn, args } as never,
      {
        onSuccess: (hash: `0x${string}`) => setTxHash(hash),
        onError: (e: Error) => {
          setTxError(e.message);
          setPendingOp(null);
          resetWrite(); // clear wagmi's pending state so buttons re-enable
        },
      },
    );
  }

  const lpParams = (delta: bigint) => ({
    tickLower: TICK_LOWER, tickUpper: TICK_UPPER, liquidityDelta: delta, salt: ZERO_BYTES32,
  });

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', boxShadow: '0 0 40px rgba(124,58,237,0.2)' }}>🧪</div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Connect your wallet</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>Connect on Unichain Sepolia to test LP operations.</p>
        </div>
        <button onClick={login} className="btn-primary" style={{ fontSize: '0.9rem', padding: '10px 28px', border: 'none', cursor: 'pointer' }}>Connect Wallet</button>
      </div>
    );
  }

  // ── Wrong chain ──────────────────────────────────────────────────────────────
  if (chainId !== UNICHAIN_SEPOLIA) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '55vh', gap: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>⛓️</div>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Switch to Unichain Sepolia</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>The test pool lives on Unichain Sepolia (chain ID 1301).</p>
        </div>
        <button onClick={() => switchChain({ chainId: UNICHAIN_SEPOLIA })} disabled={isSwitching} className="btn-primary"
          style={{ fontSize: '0.9rem', padding: '10px 28px', border: 'none', cursor: 'pointer', opacity: isSwitching ? 0.6 : 1 }}>
          {isSwitching ? 'Switching…' : 'Switch Network'}
        </button>
      </div>
    );
  }

  // ── Full UI ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div>
        <div className="section-label" style={{ marginBottom: '6px' }}>Unichain Sepolia</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Test Pool</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.875rem' }}>
          Mint test tokens, add / remove liquidity on HedgeFlow&apos;s live testnet pool.
        </p>
      </div>

      {/* Pool info */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #7c3aed, #22d3ee, transparent)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px' }}>Pool Info</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '0.78rem' }}>
          {[
            { label: 'Pair',         value: `${TOKEN0_SYMBOL} / ${TOKEN1_SYMBOL}` },
            { label: 'Fee',          value: 'Dynamic (0x800000)' },
            { label: 'Tick Spacing', value: '60' },
            { label: 'Tick Range',   value: '-887220 → 887220 (full)' },
            { label: TOKEN0_SYMBOL,  value: shortAddr(TOKEN0) },
            { label: TOKEN1_SYMBOL,  value: shortAddr(TOKEN1) },
            { label: 'TestRouter',   value: shortAddr(TEST_ROUTER) },
            { label: 'Hook',         value: shortAddr(HEDGEFLOW_HOOK) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: '#c084fc' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tokens + approvals */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #10b981, transparent)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>Your Tokens</h2>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
          Mint free test tokens, then approve the TestRouter to spend them.
        </p>
        <TokenRow
          symbol={TOKEN0_SYMBOL}
          balance={token0Balance}
          allowance={token0Allowance}
          mintBusy={opBusy('mint0')}
          approveBusy={opBusy('approve0')}
          onMint={() => exec('mint0', TOKEN0, ERC20_ABI, 'mint', [address, MINT_AMOUNT])}
          onApprove={() => exec('approve0', TOKEN0, ERC20_ABI, 'approve', [TEST_ROUTER, maxUint256])}
        />
        <TokenRow
          symbol={TOKEN1_SYMBOL}
          balance={token1Balance}
          allowance={token1Allowance}
          mintBusy={opBusy('mint1')}
          approveBusy={opBusy('approve1')}
          onMint={() => exec('mint1', TOKEN1, ERC20_ABI, 'mint', [address, MINT_AMOUNT])}
          onApprove={() => exec('approve1', TOKEN1, ERC20_ABI, 'approve', [TEST_ROUTER, maxUint256])}
        />
      </div>

      {/* Tx status */}
      <TxStatus
        hash={txHash} isConfirming={isConfirming} isSuccess={isTxSuccess} error={txError}
        onDismiss={() => { setTxHash(undefined); setTxError(null); }}
      />

      {/* Swap */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee, transparent)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>Swap</h2>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Swap tokens to generate real volume and trigger risk scoring. Approve both tokens first.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Direction
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['0for1', '1for0'] as const).map(dir => (
                <button
                  key={dir}
                  onClick={() => setSwapDir(dir)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: swapDir === dir ? 'rgba(34,211,238,0.15)' : 'rgba(0,0,0,0.3)',
                    border: swapDir === dir ? '1px solid rgba(34,211,238,0.4)' : '1px solid var(--border)',
                    color: swapDir === dir ? '#22d3ee' : 'var(--text-secondary)',
                  }}
                >
                  {dir === '0for1' ? `${TOKEN0_SYMBOL} → ${TOKEN1_SYMBOL}` : `${TOKEN1_SYMBOL} → ${TOKEN0_SYMBOL}`}
                </button>
              ))}
            </div>
          </div>
          <div style={{ minWidth: '130px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Amount In
            </label>
            <input
              type="number" min="1" value={swapAmt} onChange={e => setSwapAmt(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', outline: 'none' }}
            />
          </div>
          <button
            onClick={() => exec('swap', TEST_ROUTER, TEST_ROUTER_ABI, 'swap', [POOL_KEY, swapDir === '0for1', parseUnits(swapAmt || '0', 18)])}
            disabled={opBusy('swap') || !swapAmt || Number(swapAmt) <= 0}
            style={{
              padding: '10px 24px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
              background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.3)',
              color: '#22d3ee', cursor: opBusy('swap') ? 'not-allowed' : 'pointer',
              opacity: opBusy('swap') ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            {opBusy('swap') ? 'Swapping…' : 'Swap'}
          </button>
        </div>
      </div>

      {/* Add liquidity */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #a855f7, transparent)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>Add Liquidity</h2>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Approve both tokens first, then provide liquidity to the full-range position.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Liquidity Amount
            </label>
            <input
              type="number" min="1" value={addAmt} onChange={e => setAddAmt(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', outline: 'none' }}
            />
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '5px' }}>
              Equal USD value of each token pulled from wallet
            </div>
          </div>
          <button
            onClick={() => exec('add', TEST_ROUTER, TEST_ROUTER_ABI, 'addLiquidity', [POOL_KEY, lpParams(parseUnits(addAmt || '0', 18))])}
            disabled={opBusy('add') || !addAmt || Number(addAmt) <= 0}
            style={{
              padding: '10px 24px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', color: '#fff',
              cursor: opBusy('add') ? 'not-allowed' : 'pointer', opacity: opBusy('add') ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            {opBusy('add') ? 'Adding…' : 'Add Liquidity'}
          </button>
        </div>
      </div>

      {/* Remove liquidity */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>Remove Liquidity</h2>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Withdraw your liquidity. Must have an existing position in this tick range.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Liquidity to Remove
            </label>
            <input
              type="number" min="1" value={removeAmt} onChange={e => setRemoveAmt(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', outline: 'none' }}
            />
          </div>
          <button
            onClick={() => exec('remove', TEST_ROUTER, TEST_ROUTER_ABI, 'removeLiquidity', [POOL_KEY, lpParams(-parseUnits(removeAmt || '0', 18))])}
            disabled={opBusy('remove') || !removeAmt || Number(removeAmt) <= 0}
            style={{
              padding: '10px 24px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#f59e0b', cursor: opBusy('remove') ? 'not-allowed' : 'pointer',
              opacity: opBusy('remove') ? 0.5 : 1, whiteSpace: 'nowrap',
            }}
          >
            {opBusy('remove') ? 'Removing…' : 'Remove Liquidity'}
          </button>
        </div>
      </div>

      {/* Guide */}
      <div className="glass-card" style={{ borderRadius: '14px', padding: '22px 24px' }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '14px' }}>Quick Start</h2>
        <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>Mint 1,000 {TOKEN0_SYMBOL} and 1,000 {TOKEN1_SYMBOL} — each is a separate tx.</li>
          <li>Approve the TestRouter for both tokens — each is a separate tx.</li>
          <li>Enter a liquidity amount (e.g. <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(124,58,237,0.1)', padding: '1px 5px', borderRadius: '4px' }}>1000</code>) and click <strong>Add Liquidity</strong>.</li>
          <li>Once confirmed, your position appears on the <strong>Positions</strong> page when the indexer picks it up.</li>
          <li>To exit, enter the same amount and click <strong>Remove Liquidity</strong>.</li>
        </ol>
      </div>

    </div>
  );
}
