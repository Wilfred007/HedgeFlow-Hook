// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {IOracleManager} from "../interfaces/IOracleManager.sol";

/// @title OracleManager
/// @notice Aggregates price feeds from multiple sources (Chainlink-style + secondary).
///         For the MVP the owner can push prices directly; production would wire real
///         Chainlink / Pyth adapters.
contract OracleManager is IOracleManager, Ownable {
    // ─── Types ─────────────────────────────────────────────────────────────────

    struct PriceFeed {
        uint256 primaryPrice;    // 18-decimal USD price from primary feed
        uint256 secondaryPrice;  // 18-decimal USD price from secondary feed
        uint256 updatedAt;       // last update timestamp
    }

    // ─── State ─────────────────────────────────────────────────────────────────

    mapping(address => PriceFeed) private _feeds;

    /// @notice Maximum allowed age of a price (seconds)
    uint256 public maxPriceAge = 3600; // 1 hour

    /// @notice Maximum allowed deviation between primary and secondary (bps)
    uint256 public maxDeviationBps = 200; // 2%

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) Ownable(_owner) {}

    // ─── Admin ─────────────────────────────────────────────────────────────────

    /// @notice Push a price update (owner / authorised oracle adapter)
    function updatePrice(address token, uint256 primaryPrice, uint256 secondaryPrice) external onlyOwner {
        if (primaryPrice == 0) revert InvalidPrice(token);

        // Validate deviation between feeds
        if (secondaryPrice != 0) {
            uint256 diff = primaryPrice > secondaryPrice
                ? primaryPrice - secondaryPrice
                : secondaryPrice - primaryPrice;
            uint256 deviationBps = (diff * 10_000) / primaryPrice;
            if (deviationBps > maxDeviationBps) {
                revert PriceDeviationTooHigh(primaryPrice, secondaryPrice, deviationBps);
            }
        }

        _feeds[token] = PriceFeed({
            primaryPrice: primaryPrice,
            secondaryPrice: secondaryPrice,
            updatedAt: block.timestamp
        });

        emit PriceUpdated(token, primaryPrice, block.timestamp);
    }

    function setMaxPriceAge(uint256 age) external onlyOwner {
        maxPriceAge = age;
    }

    function setMaxDeviationBps(uint256 bps) external onlyOwner {
        maxDeviationBps = bps;
    }

    // ─── IOracleManager ────────────────────────────────────────────────────────

    /// @inheritdoc IOracleManager
    function getPrice(address token) external view returns (uint256 price) {
        PriceFeed storage feed = _feeds[token];
        if (feed.primaryPrice == 0) revert InvalidPrice(token);
        if (block.timestamp - feed.updatedAt > maxPriceAge) {
            revert StalePrice(token, feed.updatedAt, maxPriceAge);
        }
        return feed.primaryPrice;
    }

    /// @inheritdoc IOracleManager
    function getPriceWithTimestamp(address token) external view returns (uint256 price, uint256 updatedAt) {
        PriceFeed storage feed = _feeds[token];
        if (feed.primaryPrice == 0) revert InvalidPrice(token);
        return (feed.primaryPrice, feed.updatedAt);
    }

    /// @inheritdoc IOracleManager
    function isPriceFresh(address token) external view returns (bool) {
        PriceFeed storage feed = _feeds[token];
        if (feed.primaryPrice == 0) return false;
        return block.timestamp - feed.updatedAt <= maxPriceAge;
    }
}
