// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {IRiskManager} from "../interfaces/IRiskManager.sol";

/// @title RiskManager
/// @notice Stores and manages the current risk mode and score for HedgeFlow pools.
///
///         Callers:
///         - Off-chain automation keeper  → setRiskMode(RiskMode, uint256)
///         - Reactive Network RSC callback → setRiskMode(uint8, uint256)
///           The RSC (HedgeFlowReactive.sol) lives on Reactive Network and
///           automatically dispatches a callback tx here whenever a subscribed
///           on-chain event (SwapExecuted, RiskScoreUpdated) fires on the origin
///           chain. No off-chain server or private key is required for this path.
contract RiskManager is IRiskManager, Ownable {
    // ─── State ─────────────────────────────────────────────────────────────────

    RiskMode public currentMode;
    uint256 public currentRiskScore;

    /// @notice Addresses authorised to update the risk mode.
    ///         Includes:
    ///         - The Reactive Network callback proxy (SERVICE_ADDR = 0x...fffFfF)
    ///         - The off-chain automation keeper (fallback)
    ///         - The owner (governance)
    mapping(address => bool) public authorised;

    /// @notice Reactive Network system contract address — the address that
    ///         dispatches callback transactions from the RSC.
    ///         On Reactive Network testnets this is 0x0000000000000000000000000000000000fffFfF.
    address public reactiveCallbackSender;

    // ─── Fee table (in Uniswap v4 fee units: 1e6 = 100%) ──────────────────────
    // NORMAL    = 0.30% = 3_000
    // ELEVATED  = 0.60% = 6_000
    // DEFENSIVE = 1.20% = 12_000
    // CRISIS    = 2.50% = 25_000

    // ─── Protection ratio table (bps, 10_000 = 100%) ──────────────────────────
    // NORMAL    = 20%  = 2_000
    // ELEVATED  = 30%  = 3_000
    // DEFENSIVE = 40%  = 4_000
    // CRISIS    = 50%  = 5_000

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) Ownable(_owner) {
        currentMode = RiskMode.NORMAL;
        currentRiskScore = 0;
        // Pre-authorise the Reactive Network callback sender
        reactiveCallbackSender = 0x0000000000000000000000000000000000fffFfF;
        authorised[reactiveCallbackSender] = true;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAuthorised() {
        if (!authorised[msg.sender] && msg.sender != owner()) revert Unauthorized();
        _;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    /// @notice Grant or revoke automation authority
    function setAuthorised(address account, bool status) external onlyOwner {
        authorised[account] = status;
    }

    /// @notice Update the Reactive Network callback sender address
    function setReactiveCallbackSender(address sender) external onlyOwner {
        // Revoke old
        authorised[reactiveCallbackSender] = false;
        reactiveCallbackSender = sender;
        // Authorise new
        authorised[sender] = true;
    }

    // ─── IRiskManager ──────────────────────────────────────────────────────────

    /// @inheritdoc IRiskManager
    function getMode() external view returns (RiskMode) {
        return currentMode;
    }

    /// @inheritdoc IRiskManager
    function getRiskScore() external view returns (uint256) {
        return currentRiskScore;
    }

    /// @inheritdoc IRiskManager
    function setRiskMode(RiskMode mode, uint256 riskScore) external onlyAuthorised {
        _setRiskMode(mode, riskScore);
    }

    /// @dev Shared internal implementation
    function _setRiskMode(RiskMode mode, uint256 riskScore) internal {
        if (riskScore > 100) revert InvalidRiskScore(riskScore);

        RiskMode oldMode = currentMode;
        currentMode      = mode;
        currentRiskScore = riskScore;

        emit RiskModeUpdated(oldMode, mode, riskScore, block.timestamp);
        emit RiskScoreUpdated(riskScore, block.timestamp);
    }

    /// @inheritdoc IRiskManager
    function getCurrentFeeBps() external view returns (uint24) {
        return getFeeBpsForMode(currentMode);
    }

    /// @inheritdoc IRiskManager
    function getProtectionRatioBps() external view returns (uint256) {
        return getProtectionRatioBpsForMode(currentMode);
    }

    /// @inheritdoc IRiskManager
    function getFeeBpsForMode(RiskMode mode) public pure returns (uint24) {
        if (mode == RiskMode.NORMAL)    return 3_000;
        if (mode == RiskMode.ELEVATED)  return 6_000;
        if (mode == RiskMode.DEFENSIVE) return 12_000;
        /* CRISIS */                    return 25_000;
    }

    /// @inheritdoc IRiskManager
    function getProtectionRatioBpsForMode(RiskMode mode) public pure returns (uint256) {
        if (mode == RiskMode.NORMAL)    return 2_000;
        if (mode == RiskMode.ELEVATED)  return 3_000;
        if (mode == RiskMode.DEFENSIVE) return 4_000;
        /* CRISIS */                    return 5_000;
    }
}
