// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IILCalculator
/// @notice Interface for impermanent loss calculation
interface IILCalculator {
    // ─── Types ─────────────────────────────────────────────────────────────────

    struct ILResult {
        uint256 holdValueUSD;   // value if LP had simply held tokens
        uint256 lpValueUSD;     // actual LP withdrawal value
        uint256 ilAmountUSD;    // IL = max(0, holdValue - lpValue)
        uint256 compensationUSD; // IL * protectionRatio
    }

    // ─── Functions ─────────────────────────────────────────────────────────────

    /// @notice Calculate IL and compensation for an LP position
    /// @param depositAmount0   Amount of token0 deposited
    /// @param depositAmount1   Amount of token1 deposited
    /// @param depositPrice0USD Price of token0 at deposit (18 dec)
    /// @param depositPrice1USD Price of token1 at deposit (18 dec)
    /// @param currentPrice0USD Current price of token0 (18 dec)
    /// @param currentPrice1USD Current price of token1 (18 dec)
    /// @param withdrawAmount0  Amount of token0 received on withdrawal
    /// @param withdrawAmount1  Amount of token1 received on withdrawal
    /// @param protectionRatioBps Protection ratio in bps (e.g. 4000 = 40%)
    function calculateIL(
        uint256 depositAmount0,
        uint256 depositAmount1,
        uint256 depositPrice0USD,
        uint256 depositPrice1USD,
        uint256 currentPrice0USD,
        uint256 currentPrice1USD,
        uint256 withdrawAmount0,
        uint256 withdrawAmount1,
        uint256 protectionRatioBps
    ) external pure returns (ILResult memory result);
}
