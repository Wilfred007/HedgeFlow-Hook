// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IOracleManager
/// @notice Interface for the HedgeFlow oracle aggregator
interface IOracleManager {
    // ─── Events ────────────────────────────────────────────────────────────────

    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error StalePrice(address token, uint256 updatedAt, uint256 maxAge);
    error PriceDeviationTooHigh(uint256 price0, uint256 price1, uint256 deviationBps);
    error InvalidPrice(address token);
    error Unauthorized();

    // ─── Functions ─────────────────────────────────────────────────────────────

    /// @notice Returns the validated USD price of a token (18 decimals)
    function getPrice(address token) external view returns (uint256 price);

    /// @notice Returns the price with timestamp for freshness checks
    function getPriceWithTimestamp(address token) external view returns (uint256 price, uint256 updatedAt);

    /// @notice Returns whether a price is fresh (within maxAge seconds)
    function isPriceFresh(address token) external view returns (bool);
}
