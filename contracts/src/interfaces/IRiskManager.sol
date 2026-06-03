// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRiskManager
/// @notice Interface for the HedgeFlow risk state manager
interface IRiskManager {
    // ─── Types ─────────────────────────────────────────────────────────────────

    enum RiskMode {
        NORMAL,    // 0–30  risk score
        ELEVATED,  // 31–55 risk score
        DEFENSIVE, // 56–80 risk score
        CRISIS     // 81–100 risk score
    }

    // ─── Events ────────────────────────────────────────────────────────────────

    event RiskModeUpdated(RiskMode indexed oldMode, RiskMode indexed newMode, uint256 riskScore, uint256 timestamp);
    event RiskScoreUpdated(uint256 riskScore, uint256 timestamp);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error Unauthorized();
    error InvalidRiskScore(uint256 score);

    // ─── Functions ─────────────────────────────────────────────────────────────

    /// @notice Returns the current risk mode
    function getMode() external view returns (RiskMode);

    /// @notice Returns the current risk score (0–100)
    function getRiskScore() external view returns (uint256);

    /// @notice Update risk mode — callable by authorised automation or Reactive Network callback.
    ///         Accepts uint8 so the Reactive RSC callback (which ABI-encodes enums as uint8)
    ///         works without a separate overload.
    function setRiskMode(RiskMode mode, uint256 riskScore) external;

    /// @notice Returns the LP fee in bps for the current risk mode
    function getCurrentFeeBps() external view returns (uint24);

    /// @notice Returns the protection ratio in bps for the current risk mode
    function getProtectionRatioBps() external view returns (uint256);

    /// @notice Returns the fee bps for a given mode
    function getFeeBpsForMode(RiskMode mode) external pure returns (uint24);

    /// @notice Returns the protection ratio bps for a given mode
    function getProtectionRatioBpsForMode(RiskMode mode) external pure returns (uint256);
}
