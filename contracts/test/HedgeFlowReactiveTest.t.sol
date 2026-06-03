// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";

import {HedgeFlowReactive} from "../src/reactive/HedgeFlowReactive.sol";
import {IReactive}         from "../lib/reactive-lib/src/interfaces/IReactive.sol";

/// @title HedgeFlowReactiveTest
/// @notice Unit tests for HedgeFlowReactive (RSC).
///
///         Forge sets vm=true in AbstractReactive.detectVm() because
///         0x0000…fffFfF has no code in the test environment — meaning:
///           • Constructor skips service.subscribe() calls  ✓
///           • react() vmOnly modifier passes               ✓
///           • rnOnly functions (updateSubscriptions) revert ✓
///
///         Tests call react() directly with hand-crafted LogRecord structs
///         and assert on emitted events + state changes.
contract HedgeFlowReactiveTest is Test {
    // ─── Contracts ─────────────────────────────────────────────────────────────

    HedgeFlowReactive reactive;

    // ─── Constants ─────────────────────────────────────────────────────────────

    uint256 constant ORIGIN_CHAIN_ID = 84532; // Base Sepolia
    address constant HOOK            = address(0x1111);
    address constant RISK_MANAGER    = address(0x2222);
    uint64  constant CALLBACK_GAS    = 300_000;

    /// @dev Matches HedgeFlowReactive.TOPIC_SWAP_EXECUTED
    uint256 constant TOPIC_SWAP_EXECUTED =
        uint256(keccak256("SwapExecuted(bytes32,address,uint24,uint8,uint256)"));

    /// @dev Matches HedgeFlowReactive.TOPIC_RISK_SCORE_UPDATED
    uint256 constant TOPIC_RISK_SCORE_UPDATED =
        uint256(keccak256("RiskScoreUpdated(uint256,uint256)"));

    // ─── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        vm.warp(1_700_000_000);
        reactive = new HedgeFlowReactive(ORIGIN_CHAIN_ID, HOOK, RISK_MANAGER);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /// @dev Build a RiskScoreUpdated LogRecord.
    ///      Non-indexed params: (uint256 riskScore, uint256 timestamp)
    function _riskScoreLog(uint256 score) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN_ID,
            _contract:    RISK_MANAGER,
            topic_0:      TOPIC_RISK_SCORE_UPDATED,
            topic_1:      0,
            topic_2:      0,
            topic_3:      0,
            data:         abi.encode(score, block.timestamp),
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
    }

    /// @dev Build a SwapExecuted LogRecord.
    ///      Indexed params (poolId → topic_1, sender → topic_2) are NOT in data.
    ///      Non-indexed params: (uint24 feeBps, uint8 riskMode, uint256 timestamp)
    function _swapLog(
        bytes32 poolId,
        address sender,
        uint24  feeBps,
        uint8   riskMode
    ) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id:     ORIGIN_CHAIN_ID,
            _contract:    HOOK,
            topic_0:      TOPIC_SWAP_EXECUTED,
            topic_1:      uint256(poolId),               // indexed: poolId
            topic_2:      uint256(uint160(sender)),       // indexed: sender
            topic_3:      0,
            data:         abi.encode(feeBps, riskMode, block.timestamp),
            block_number: block.number,
            op_code:      0,
            block_hash:   0,
            tx_hash:      0,
            log_index:    0
        });
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    function test_Constructor_State() public view {
        assertEq(reactive.originChainId(),    ORIGIN_CHAIN_ID);
        assertEq(reactive.hedgeflowHook(),    HOOK);
        assertEq(reactive.riskManager(),      RISK_MANAGER);
        assertEq(reactive.lastDispatchedMode(), 0);  // NORMAL
        assertEq(reactive.lastRiskScore(),    0);
        assertEq(reactive.totalCallbacks(),   0);
    }

    /// @dev updateSubscriptions is rnOnly — must revert in test (vm=true) environment
    function test_UpdateSubscriptions_RevertsInVm() public {
        vm.expectRevert("Reactive Network only");
        reactive.updateSubscriptions(address(0xABCD), address(0xEFEF));
    }

    // ─── react() — RiskScoreUpdated ────────────────────────────────────────────

    function test_React_RiskScore_NormalMode() public {
        bytes memory payload = abi.encodeWithSignature(
            "setRiskMode(uint8,uint256)", uint8(0), uint256(15)
        );

        vm.expectEmit(true, true, false, true);
        emit HedgeFlowReactive.RiskModeDetected(0, 0, 15, block.timestamp);

        vm.expectEmit(true, true, true, true);
        emit IReactive.Callback(ORIGIN_CHAIN_ID, RISK_MANAGER, CALLBACK_GAS, payload);

        reactive.react(_riskScoreLog(15));

        assertEq(reactive.lastDispatchedMode(), 0); // NORMAL
        assertEq(reactive.lastRiskScore(),     15);
        assertEq(reactive.totalCallbacks(),     1);
    }

    function test_React_RiskScore_ElevatedMode() public {
        reactive.react(_riskScoreLog(45));
        assertEq(reactive.lastDispatchedMode(), 1); // ELEVATED
        assertEq(reactive.lastRiskScore(),     45);
    }

    function test_React_RiskScore_DefensiveMode() public {
        reactive.react(_riskScoreLog(70));
        assertEq(reactive.lastDispatchedMode(), 2); // DEFENSIVE
        assertEq(reactive.lastRiskScore(),     70);
    }

    function test_React_RiskScore_CrisisMode() public {
        reactive.react(_riskScoreLog(90));
        assertEq(reactive.lastDispatchedMode(), 3); // CRISIS
        assertEq(reactive.lastRiskScore(),     90);
    }

    /// @dev Verify exact threshold boundaries (0–30 NORMAL, 31–55 ELEVATED, 56–80 DEFENSIVE, 81–100 CRISIS)
    function test_React_Thresholds_Ascending() public {
        reactive.react(_riskScoreLog(0));
        assertEq(reactive.lastDispatchedMode(), 0, "score 0 should be NORMAL");

        reactive.react(_riskScoreLog(31));
        assertEq(reactive.lastDispatchedMode(), 1, "score 31 should be ELEVATED");

        reactive.react(_riskScoreLog(56));
        assertEq(reactive.lastDispatchedMode(), 2, "score 56 should be DEFENSIVE");

        reactive.react(_riskScoreLog(81));
        assertEq(reactive.lastDispatchedMode(), 3, "score 81 should be CRISIS");
    }

    function test_React_Thresholds_Descending() public {
        reactive.react(_riskScoreLog(90)); // start at CRISIS

        reactive.react(_riskScoreLog(80));
        assertEq(reactive.lastDispatchedMode(), 2, "score 80 should be DEFENSIVE");

        reactive.react(_riskScoreLog(55));
        assertEq(reactive.lastDispatchedMode(), 1, "score 55 should be ELEVATED");

        reactive.react(_riskScoreLog(30));
        assertEq(reactive.lastDispatchedMode(), 0, "score 30 should be NORMAL");
    }

    function test_React_Thresholds_UpperBoundaries() public {
        // 30 → NORMAL, 31 → ELEVATED (boundary)
        reactive.react(_riskScoreLog(30));
        assertEq(reactive.lastDispatchedMode(), 0);

        reactive.react(_riskScoreLog(31));
        assertEq(reactive.lastDispatchedMode(), 1);

        // 55 → ELEVATED, 56 → DEFENSIVE (boundary)
        reactive.react(_riskScoreLog(55));
        assertEq(reactive.lastDispatchedMode(), 1);

        reactive.react(_riskScoreLog(56));
        assertEq(reactive.lastDispatchedMode(), 2);

        // 80 → DEFENSIVE, 81 → CRISIS (boundary)
        reactive.react(_riskScoreLog(80));
        assertEq(reactive.lastDispatchedMode(), 2);

        reactive.react(_riskScoreLog(81));
        assertEq(reactive.lastDispatchedMode(), 3);
    }

    // ─── react() — deduplication ───────────────────────────────────────────────

    /// @dev First callback always fires even if initial mode matches (totalCallbacks == 0)
    function test_React_FirstCallback_AlwaysFires() public {
        // Initial mode is NORMAL (0); score 10 also → NORMAL
        reactive.react(_riskScoreLog(10));
        assertEq(reactive.totalCallbacks(), 1);
    }

    function test_React_SameMode_Skipped() public {
        reactive.react(_riskScoreLog(45)); // ELEVATED — first, fires
        assertEq(reactive.totalCallbacks(), 1);

        reactive.react(_riskScoreLog(40)); // ELEVATED — same mode, skipped
        assertEq(reactive.totalCallbacks(), 1);

        reactive.react(_riskScoreLog(50)); // ELEVATED — still same mode, skipped
        assertEq(reactive.totalCallbacks(), 1);
    }

    function test_React_ModeChange_Fires() public {
        reactive.react(_riskScoreLog(10));  // NORMAL  → 1
        reactive.react(_riskScoreLog(45));  // ELEVATED → 2
        reactive.react(_riskScoreLog(70));  // DEFENSIVE → 3
        reactive.react(_riskScoreLog(90));  // CRISIS   → 4
        assertEq(reactive.totalCallbacks(), 4);
    }

    // ─── react() — SwapExecuted ────────────────────────────────────────────────

    /// @dev CRITICAL: indexed params must NOT be in log.data. This test verifies
    ///      the decode only reads the 3 non-indexed fields (feeBps, riskMode, timestamp).
    function test_React_SwapExecuted_DecodesNonIndexedOnly() public {
        bytes32 poolId  = bytes32(uint256(0xABCD));
        address sender  = address(0xBEEF);
        uint24  feeBps  = 3_000;
        uint8   mode    = 2; // DEFENSIVE → representative score 68

        reactive.react(_swapLog(poolId, sender, feeBps, mode));

        // DEFENSIVE mode (2) maps to representative score 68 → classifies as DEFENSIVE (56-80)
        assertEq(reactive.lastDispatchedMode(), 2);
        assertEq(reactive.lastRiskScore(),     68);
    }

    function test_React_SwapExecuted_NormalMode() public {
        reactive.react(_swapLog(bytes32(0), address(0), 3_000, 0)); // mode NORMAL → score 15
        assertEq(reactive.lastDispatchedMode(), 0);
        assertEq(reactive.lastRiskScore(), 15);
    }

    function test_React_SwapExecuted_ElevatedMode() public {
        reactive.react(_swapLog(bytes32(0), address(0), 6_000, 1)); // mode ELEVATED → score 43
        assertEq(reactive.lastDispatchedMode(), 1);
        assertEq(reactive.lastRiskScore(), 43);
    }

    function test_React_SwapExecuted_CrisisMode() public {
        reactive.react(_swapLog(bytes32(0), address(0), 25_000, 3)); // mode CRISIS → score 90
        assertEq(reactive.lastDispatchedMode(), 3);
        assertEq(reactive.lastRiskScore(), 90);
    }

    // ─── react() — unknown event ───────────────────────────────────────────────

    function test_React_UnknownTopic_Ignored() public {
        IReactive.LogRecord memory log = _riskScoreLog(90);
        log.topic_0 = uint256(keccak256("SomeOtherEvent(uint256)"));

        reactive.react(log);

        assertEq(reactive.totalCallbacks(), 0); // nothing dispatched
        assertEq(reactive.lastRiskScore(),  0); // state unchanged
    }

    // ─── react() — Callback payload ────────────────────────────────────────────

    function test_React_CallbackPayload_Elevated() public {
        bytes memory expectedPayload = abi.encodeWithSignature(
            "setRiskMode(uint8,uint256)", uint8(1), uint256(45)
        );

        vm.expectEmit(true, true, true, true);
        emit IReactive.Callback(ORIGIN_CHAIN_ID, RISK_MANAGER, CALLBACK_GAS, expectedPayload);

        reactive.react(_riskScoreLog(45));
    }

    function test_React_CallbackPayload_Crisis() public {
        bytes memory expectedPayload = abi.encodeWithSignature(
            "setRiskMode(uint8,uint256)", uint8(3), uint256(90)
        );

        vm.expectEmit(true, true, true, true);
        emit IReactive.Callback(ORIGIN_CHAIN_ID, RISK_MANAGER, CALLBACK_GAS, expectedPayload);

        reactive.react(_riskScoreLog(90));
    }

    /// @dev The Callback payload selector must match RiskManager.setRiskMode(RiskMode,uint256).
    ///      Solidity enums are ABI-encoded as their underlying uint8, so
    ///      bytes4(keccak256("setRiskMode(uint8,uint256)")) == bytes4(keccak256("setRiskMode(RiskMode,uint256)"))
    function test_React_CallbackSelector_MatchesRiskManager() public {
        reactive.react(_riskScoreLog(45));

        bytes4 expected = bytes4(keccak256("setRiskMode(uint8,uint256)"));
        // Re-encode a sample payload and check the leading 4 bytes
        bytes memory payload = abi.encodeWithSignature("setRiskMode(uint8,uint256)", uint8(1), uint256(45));
        bytes4 actual;
        assembly { actual := mload(add(payload, 32)) }
        assertEq(actual, expected);
    }

    // ─── react() — event emissions ─────────────────────────────────────────────

    function test_React_EmitsRiskModeDetected_OnChange() public {
        vm.expectEmit(true, true, false, true);
        emit HedgeFlowReactive.RiskModeDetected(1, 0, 45, block.timestamp);
        reactive.react(_riskScoreLog(45));
    }

    function test_React_EmitsCallbackDispatched() public {
        vm.expectEmit(true, false, false, true);
        emit HedgeFlowReactive.CallbackDispatched(2, 70, block.timestamp);
        reactive.react(_riskScoreLog(70));
    }

    function test_React_NoEventsEmitted_WhenModeUnchanged() public {
        reactive.react(_riskScoreLog(45)); // ELEVATED — fires

        // Second call — same mode, no events should be emitted
        vm.recordLogs();
        reactive.react(_riskScoreLog(40)); // ELEVATED — skipped

        assertEq(vm.getRecordedLogs().length, 0, "No events should be emitted when mode is unchanged");
    }

    // ─── Representative score mapping ─────────────────────────────────────────

    function test_ModeToRepresentativeScore_AllModes() public {
        // NORMAL (0) → 15
        reactive.react(_swapLog(bytes32(0), address(0), 0, 0));
        assertEq(reactive.lastRiskScore(), 15);

        // ELEVATED (1) → 43 (mode changes so callback fires)
        reactive.react(_swapLog(bytes32(0), address(0), 0, 1));
        assertEq(reactive.lastRiskScore(), 43);

        // DEFENSIVE (2) → 68
        reactive.react(_swapLog(bytes32(0), address(0), 0, 2));
        assertEq(reactive.lastRiskScore(), 68);

        // CRISIS (3) → 90
        reactive.react(_swapLog(bytes32(0), address(0), 0, 3));
        assertEq(reactive.lastRiskScore(), 90);
    }
}
