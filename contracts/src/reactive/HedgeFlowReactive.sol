// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─── Reactive Network ──────────────────────────────────────────────────────────
import {AbstractReactive} from "../../lib/reactive-lib/src/abstract-base/AbstractReactive.sol";

/// @title HedgeFlowReactive
/// @notice Reactive Smart Contract (RSC) deployed on Reactive Network.
///
///         This contract replaces the off-chain keeper/polling loop entirely.
///         It lives on the Reactive chain and:
///
///         1. SUBSCRIBES to two on-chain events on the origin chain (Base/Arbitrum):
///            - HedgeFlowHook.SwapExecuted  → triggers risk re-evaluation on every swap
///            - RiskManager.RiskScoreUpdated → confirms mode transitions
///
///         2. REACTS via react() — called automatically by Reactive Network
///            whenever a subscribed event fires:
///            - Decodes the risk score from the log
///            - Classifies the new risk mode using the same thresholds as the Python engine
///            - If the mode has changed, emits a Callback event
///
///         3. DISPATCHES a callback transaction back to RiskManager.setRiskMode()
///            on the origin chain — no off-chain server, no private key, no polling.
///
///         Architecture:
///
///           HedgeFlowHook (Base Sepolia)
///             │ emits SwapExecuted(poolId, sender, feeBps, riskMode, timestamp)
///             │ emits RiskScoreUpdated(score, timestamp)  [via RiskManager]
///             ▼
///           Reactive Network
///             │ HedgeFlowReactive.react(log) fires automatically
///             │ → classifies mode from score
///             │ → emits Callback(chainId, riskManager, gas, payload)
///             ▼
///           RiskManager.setRiskMode(mode, score) (Base Sepolia)
///             ← callback tx dispatched by Reactive Network
///
contract HedgeFlowReactive is AbstractReactive {
    // ─── Constants ─────────────────────────────────────────────────────────────

    /// @notice Reactive Network REACTIVE_IGNORE sentinel
    uint256 private constant IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;

    /// @notice Gas limit for the callback transaction on the origin chain
    uint64 private constant CALLBACK_GAS_LIMIT = 300_000;

    // ─── Risk thresholds (mirrors Python scoring.py) ───────────────────────────
    uint256 private constant THRESHOLD_ELEVATED  = 31;
    uint256 private constant THRESHOLD_DEFENSIVE = 56;
    uint256 private constant THRESHOLD_CRISIS    = 81;

    // ─── Event topic hashes ────────────────────────────────────────────────────
    // keccak256("SwapExecuted(bytes32,address,uint24,uint8,uint256)")
    uint256 private constant TOPIC_SWAP_EXECUTED =
        uint256(keccak256("SwapExecuted(bytes32,address,uint24,uint8,uint256)"));

    // keccak256("RiskScoreUpdated(uint256,uint256)")
    uint256 private constant TOPIC_RISK_SCORE_UPDATED =
        uint256(keccak256("RiskScoreUpdated(uint256,uint256)"));

    // ─── State ─────────────────────────────────────────────────────────────────

    /// @notice Origin chain ID (e.g. 84532 for Base Sepolia)
    uint256 public immutable originChainId;

    /// @notice HedgeFlowHook address on the origin chain
    address public immutable hedgeflowHook;

    /// @notice RiskManager address on the origin chain (callback target)
    address public immutable riskManager;

    /// @notice Last risk mode dispatched (0=NORMAL, 1=ELEVATED, 2=DEFENSIVE, 3=CRISIS)
    uint8 public lastDispatchedMode;

    /// @notice Last risk score seen
    uint256 public lastRiskScore;

    /// @notice Total callbacks dispatched
    uint256 public totalCallbacks;

    // ─── Events ────────────────────────────────────────────────────────────────

    event RiskModeDetected(
        uint8 indexed newMode,
        uint8 indexed oldMode,
        uint256 riskScore,
        uint256 timestamp
    );

    event CallbackDispatched(
        uint8 indexed mode,
        uint256 riskScore,
        uint256 timestamp
    );

    // ─── Constructor ───────────────────────────────────────────────────────────

    /// @param _originChainId  EIP-155 chain ID of the origin chain
    /// @param _hedgeflowHook  HedgeFlowHook address on origin chain
    /// @param _riskManager    RiskManager address on origin chain (callback target)
    constructor(
        uint256 _originChainId,
        address _hedgeflowHook,
        address _riskManager
    ) {
        originChainId = _originChainId;
        hedgeflowHook = _hedgeflowHook;
        riskManager   = _riskManager;

        // ── Subscribe to events on the origin chain ──────────────────────────
        // Only subscribe when deployed to Reactive Network (not ReactVM).
        // The vm flag from AbstractReactive.detectVm() tells us which context we're in.
        if (!vm) {
            // Subscribe to SwapExecuted from HedgeFlowHook
            service.subscribe(
                _originChainId,
                _hedgeflowHook,
                TOPIC_SWAP_EXECUTED,
                IGNORE,
                IGNORE,
                IGNORE
            );

            // Subscribe to RiskScoreUpdated from RiskManager
            service.subscribe(
                _originChainId,
                _riskManager,
                TOPIC_RISK_SCORE_UPDATED,
                IGNORE,
                IGNORE,
                IGNORE
            );
        }
    }

    // ─── IReactive ─────────────────────────────────────────────────────────────

    /// @notice Called automatically by Reactive Network when a subscribed event fires.
    ///         Runs inside the ReactVM — no external calls allowed, only emit Callback.
    function react(LogRecord calldata log) external vmOnly {
        uint256 riskScore;

        if (log.topic_0 == TOPIC_RISK_SCORE_UPDATED) {
            // RiskScoreUpdated(uint256 riskScore, uint256 timestamp)
            // riskScore is the first word of data
            riskScore = abi.decode(log.data, (uint256));

        } else if (log.topic_0 == TOPIC_SWAP_EXECUTED) {
            // SwapExecuted(bytes32 indexed poolId, address indexed sender, uint24 feeBps, uint8 riskMode, uint256 timestamp)
            // poolId and sender are INDEXED — they live in log.topic_1 / log.topic_2, NOT in log.data.
            // log.data holds only the 3 non-indexed fields: (uint24 feeBps, uint8 riskMode, uint256 timestamp).
            (, uint8 encodedMode, ) = abi.decode(
                log.data,
                (uint24, uint8, uint256)
            );
            // Map mode back to a representative score midpoint
            riskScore = _modeToRepresentativeScore(encodedMode);
        } else {
            return; // unknown event — ignore
        }

        // ── Classify new mode ────────────────────────────────────────────────
        uint8 newMode = _classifyMode(riskScore);

        // ── Only dispatch callback if mode changed ───────────────────────────
        if (newMode == lastDispatchedMode && totalCallbacks > 0) {
            return;
        }

        uint8 oldMode = lastDispatchedMode;
        lastDispatchedMode = newMode;
        lastRiskScore      = riskScore;
        totalCallbacks++;

        emit RiskModeDetected(newMode, oldMode, riskScore, block.timestamp);

        // ── Build callback payload: RiskManager.setRiskMode(uint8, uint256) ──
        bytes memory payload = abi.encodeWithSignature(
            "setRiskMode(uint8,uint256)",
            newMode,
            riskScore
        );

        // ── Emit Callback — Reactive Network dispatches this as a tx ─────────
        emit Callback(originChainId, riskManager, CALLBACK_GAS_LIMIT, payload);
        emit CallbackDispatched(newMode, riskScore, block.timestamp);
    }

    // ─── Admin (Reactive Network only) ─────────────────────────────────────────

    /// @notice Update subscriptions — callable only on Reactive Network (not ReactVM)
    function updateSubscriptions(
        address newHook,
        address newRiskManager
    ) external rnOnly {
        // Unsubscribe old
        service.unsubscribe(originChainId, hedgeflowHook,  TOPIC_SWAP_EXECUTED,    IGNORE, IGNORE, IGNORE);
        service.unsubscribe(originChainId, riskManager,    TOPIC_RISK_SCORE_UPDATED, IGNORE, IGNORE, IGNORE);

        // Subscribe new
        service.subscribe(originChainId, newHook,          TOPIC_SWAP_EXECUTED,    IGNORE, IGNORE, IGNORE);
        service.subscribe(originChainId, newRiskManager,   TOPIC_RISK_SCORE_UPDATED, IGNORE, IGNORE, IGNORE);
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    /// @notice Classify a 0–100 risk score into a RiskMode uint8
    function _classifyMode(uint256 score) internal pure returns (uint8) {
        if (score >= THRESHOLD_CRISIS)    return 3; // CRISIS
        if (score >= THRESHOLD_DEFENSIVE) return 2; // DEFENSIVE
        if (score >= THRESHOLD_ELEVATED)  return 1; // ELEVATED
        return 0;                                    // NORMAL
    }

    /// @notice Map a RiskMode uint8 back to a representative score midpoint
    ///         Used when reacting to SwapExecuted (which carries mode, not score)
    function _modeToRepresentativeScore(uint8 mode) internal pure returns (uint256) {
        if (mode == 3) return 90; // CRISIS    midpoint
        if (mode == 2) return 68; // DEFENSIVE midpoint
        if (mode == 1) return 43; // ELEVATED  midpoint
        return 15;                // NORMAL    midpoint
    }
}
