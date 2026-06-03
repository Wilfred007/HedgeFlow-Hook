// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HedgeFlowMath
/// @notice Pure math helpers for HedgeFlow protocol
library HedgeFlowMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    /// @notice Multiply two WAD-scaled values
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / WAD;
    }

    /// @notice Divide two WAD-scaled values
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, "HedgeFlowMath: div by zero");
        return (a * WAD) / b;
    }

    /// @notice Apply a basis-point ratio to an amount
    /// @param amount  The base amount
    /// @param bps     Basis points (e.g. 2000 = 20%)
    function applyBps(uint256 amount, uint256 bps) internal pure returns (uint256) {
        return (amount * bps) / BPS_DENOMINATOR;
    }

    /// @notice Absolute difference between two uint256 values
    function absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }

    /// @notice Returns the minimum of two values
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @notice Returns the maximum of two values
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /// @notice Convert token amount to USD value
    /// @param amount     Token amount (token decimals)
    /// @param priceUSD   Price in USD with 18 decimals
    /// @param decimals   Token decimals
    function toUSD(uint256 amount, uint256 priceUSD, uint8 decimals) internal pure returns (uint256) {
        // Normalise to 18 decimals then multiply by price
        uint256 normalised = amount * (10 ** (18 - decimals));
        return wadMul(normalised, priceUSD);
    }
}
