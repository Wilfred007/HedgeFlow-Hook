import { ethers } from 'ethers';
import { config, HEDGEFLOW_HOOK_ABI, RISK_MANAGER_ABI, RESERVE_VAULT_ABI } from '@hedgeflow/shared';
import {
  db,
  runMigrations,
  getLastIndexedBlock,
  setLastIndexedBlock,
} from './db';
import {
  handleSwapExecuted,
  handleLiquidityAdded,
  handleLiquidityRemoved,
  handleReserveAllocated,
  handleRiskModeUpdated,
} from './handlers';

const POLL_INTERVAL_MS = 5_000;
const BLOCK_BATCH_SIZE = 500;

async function main() {
  console.log('[Indexer] Starting HedgeFlow indexer...');
  console.log(`[Indexer] RPC: ${config.rpcUrl}`);
  console.log(`[Indexer] Hook: ${config.hedgeflowHook}`);

  // ── DB setup ────────────────────────────────────────────────────────────────
  await runMigrations();

  // ── Provider ────────────────────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  // ── Contract interfaces ─────────────────────────────────────────────────────
  const hookIface = new ethers.Interface(HEDGEFLOW_HOOK_ABI as unknown as string[]);
  const riskIface = new ethers.Interface(RISK_MANAGER_ABI as unknown as string[]);
  const reserveVault = config.reserveVault
    ? new ethers.Contract(config.reserveVault, RESERVE_VAULT_ABI as unknown as string[], provider)
    : null;

  // Build topic → handler map
  const topicHandlers: Record<
    string,
    (log: ethers.Log, parsed: ethers.LogDescription, blockNumber: number) => Promise<void>
  > = {};

  const swapTopic = hookIface.getEvent('SwapExecuted')!.topicHash;
  topicHandlers[swapTopic] = async (log, parsed, bn) =>
    handleSwapExecuted(db, log, parsed, bn, provider, config.poolManager);

  const addLiqTopic = hookIface.getEvent('LiquidityAdded')!.topicHash;
  topicHandlers[addLiqTopic] = async (log, parsed, _bn) => {
    // The hook sees the router as `lp`; use the tx `from` to get the real wallet.
    const tx   = await provider.getTransaction(log.transactionHash);
    const from = tx?.from ?? parsed.args.lp;
    return handleLiquidityAdded(db, log, parsed, from);
  };

  const removeLiqTopic = hookIface.getEvent('LiquidityRemoved')!.topicHash;
  topicHandlers[removeLiqTopic] = async (log, parsed, _bn) => {
    const tx   = await provider.getTransaction(log.transactionHash);
    const from = tx?.from ?? parsed.args.lp;
    return handleLiquidityRemoved(db, log, parsed, from);
  };

  const reserveTopic = hookIface.getEvent('ReserveAllocated')!.topicHash;
  topicHandlers[reserveTopic] = async (log, parsed, bn) =>
    handleReserveAllocated(db, log, parsed, bn, reserveVault!);

  const riskTopic = riskIface.getEvent('RiskModeUpdated')!.topicHash;
  topicHandlers[riskTopic] = async (_log, parsed, _bn) =>
    handleRiskModeUpdated(db, parsed);

  const allTopics = Object.keys(topicHandlers);
  const addresses = [config.hedgeflowHook, config.riskManager].filter(Boolean);

  // ── Poll loop ───────────────────────────────────────────────────────────────
  let lastBlock = await getLastIndexedBlock();
  if (lastBlock === 0 && config.startBlock > 0) {
    lastBlock = config.startBlock - 1;
  }

  console.log(`[Indexer] Starting from block ${lastBlock + 1}`);

  while (true) {
    try {
      const latestBlock = await provider.getBlockNumber();

      if (lastBlock >= latestBlock) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const fromBlock = lastBlock + 1;
      const toBlock   = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, latestBlock);

      console.log(`[Indexer] Processing blocks ${fromBlock}–${toBlock}`);

      const logs = await provider.getLogs({
        fromBlock,
        toBlock,
        address: addresses.length > 0 ? addresses : undefined,
        topics: [allTopics],
      });

      for (const log of logs) {
        const topic = log.topics[0];
        const handler = topicHandlers[topic];
        if (!handler) continue;

        // Try to parse with hook iface first, then risk iface
        let parsed: ethers.LogDescription | null = null;
        try { parsed = hookIface.parseLog(log); } catch {}
        if (!parsed) {
          try { parsed = riskIface.parseLog(log); } catch {}
        }
        if (!parsed) continue;

        try {
          await handler(log, parsed, log.blockNumber);
        } catch (err) {
          console.error(`[Indexer] Handler error for ${parsed.name}:`, err);
        }
      }

      lastBlock = toBlock;
      await setLastIndexedBlock(lastBlock);
    } catch (err) {
      console.error('[Indexer] Poll error:', err);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('[Indexer] Fatal error:', err);
  process.exit(1);
});
