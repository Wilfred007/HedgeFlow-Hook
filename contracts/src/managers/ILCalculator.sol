// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IILCalculator} from "../interfaces/IILCalculator.sol";
import {HedgeFlowMath} from "../libraries/HedgeFlowMath.sol";

/// @title ILCalculator
/// @notice Computes impermanent loss and compensation for LP positions.
///
///         IL = max(0, HoldValue - LPValue)
///         Compensation = IL * protectionRatio
///
///         HoldValue  = depositAmount0 * currentPrice0 + depositAmount1 * currentPrice1
///         LPValue    = withdrawAmount0 * currentPrice0 + withdrawAmount1 * currentPrice1
contract ILCalculator is IILCalculator {
    using HedgeFlowMath for uint256;

    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 10_000;

    /// @inheritdoc IILCalculator
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
    ) external pure returns (ILResult memory result) {
        // ── Hold value: what the LP would have if they simply held ──────────────
        // All amounts are assumed to be 18-decimal normalised before calling.
        uint256 holdValue = (depositAmount0 * currentPrice0USD) / WAD
            + (depositAmount1 * currentPrice1USD) / WAD;

        // ── LP withdrawal value ─────────────────────────────────────────────────
        uint256 lpValue = (withdrawAmount0 * currentPrice0USD) / WAD
            + (withdrawAmount1 * currentPrice1USD) / WAD;

        // ── IL = max(0, holdValue - lpValue) ────────────────────────────────────
        uint256 il = holdValue > lpValue ? holdValue - lpValue : 0;

        // ── Compensation = IL * protectionRatio ─────────────────────────────────
        uint256 compensation = (il * protectionRatioBps) / BPS;

        result = ILResult({
            holdValueUSD: holdValue,
            lpValueUSD: lpValue,
            ilAmountUSD: il,
            compensationUSD: compensation
        });
    }
}
