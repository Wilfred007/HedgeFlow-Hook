// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IReserveVault
/// @notice Interface for the HedgeFlow insurance reserve vault
interface IReserveVault {
    // ─── Events ────────────────────────────────────────────────────────────────

    event ReserveDeposited(address indexed token, uint256 amount, uint256 newBalance);
    event CompensationPaid(address indexed lp, address indexed token, uint256 amount);
    event ReserveHealthUpdated(uint256 reserveBalance, uint256 estimatedLiabilities, uint256 healthBps);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error InsufficientReserve(uint256 requested, uint256 available);
    error PayoutExceedsCap(uint256 requested, uint256 cap);
    error MinimumDurationNotMet(uint256 depositTimestamp, uint256 minDuration);
    error CooldownActive(uint256 nextAllowedTime);
    error Unauthorized();
    error ZeroAmount();

    // ─── Functions ─────────────────────────────────────────────────────────────

    /// @notice Deposit tokens into the reserve
    function deposit(address token, uint256 amount) external;

    /// @notice Pay IL compensation to an LP
    function payCompensation(address lp, address token, uint256 amount, uint256 depositTimestamp) external;

    /// @notice Returns the current reserve balance for a token
    function reserveBalance(address token) external view returns (uint256);

    /// @notice Returns total compensations paid for a token
    function totalCompensationsPaid(address token) external view returns (uint256);

    /// @notice Returns reserve health in basis points (10000 = 100%)
    function reserveHealth(address token) external view returns (uint256);

    /// @notice Returns whether the vault is solvent enough to pay a given amount
    function canPay(address token, uint256 amount) external view returns (bool);
}
