// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeRouter
/// @notice Splits collected swap fees between LP rewards, reserve vault, and treasury.
///
///         Default allocation:
///           LP Rewards  70%  (7_000 bps)
///           Reserve     20%  (2_000 bps)
///           Treasury    10%  (1_000 bps)
contract FeeRouter is Ownable {
    using SafeERC20 for IERC20;

    // ─── Events ────────────────────────────────────────────────────────────────

    event FeeDistributed(
        address indexed token,
        uint256 totalAmount,
        uint256 lpAmount,
        uint256 reserveAmount,
        uint256 treasuryAmount
    );
    event AllocationUpdated(uint256 lpBps, uint256 reserveBps, uint256 treasuryBps);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error InvalidAllocation();
    error Unauthorized();

    // ─── State ─────────────────────────────────────────────────────────────────

    uint256 public lpAllocationBps      = 7_000; // 70%
    uint256 public reserveAllocationBps = 2_000; // 20%
    uint256 public treasuryAllocationBps = 1_000; // 10%

    address public reserveVault;
    address public treasury;

    /// @notice Addresses authorised to call distribute (the hook)
    mapping(address => bool) public authorised;

    uint256 private constant BPS = 10_000;

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner, address _reserveVault, address _treasury) Ownable(_owner) {
        reserveVault = _reserveVault;
        treasury = _treasury;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function setAuthorised(address account, bool status) external onlyOwner {
        authorised[account] = status;
    }

    function setAllocation(uint256 lpBps, uint256 reserveBps, uint256 treasuryBps) external onlyOwner {
        if (lpBps + reserveBps + treasuryBps != BPS) revert InvalidAllocation();
        lpAllocationBps = lpBps;
        reserveAllocationBps = reserveBps;
        treasuryAllocationBps = treasuryBps;
        emit AllocationUpdated(lpBps, reserveBps, treasuryBps);
    }

    function setReserveVault(address _vault) external onlyOwner {
        reserveVault = _vault;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    // ─── Core ──────────────────────────────────────────────────────────────────

    /// @notice Distribute collected fees.
    ///         The caller (hook) must have already transferred `amount` tokens here.
    /// @param token   The fee token address
    /// @param amount  Total fee amount to distribute
    /// @param lpRecipient  Address to receive LP share (pool manager / LP reward contract)
    function distribute(address token, uint256 amount, address lpRecipient) external {
        if (!authorised[msg.sender] && msg.sender != owner()) revert Unauthorized();
        if (amount == 0) return;

        uint256 reserveAmount  = (amount * reserveAllocationBps)  / BPS;
        uint256 treasuryAmount = (amount * treasuryAllocationBps) / BPS;
        uint256 lpAmount       = amount - reserveAmount - treasuryAmount;

        if (reserveAmount > 0 && reserveVault != address(0)) {
            IERC20(token).safeTransfer(reserveVault, reserveAmount);
        }
        if (treasuryAmount > 0 && treasury != address(0)) {
            IERC20(token).safeTransfer(treasury, treasuryAmount);
        }
        if (lpAmount > 0 && lpRecipient != address(0)) {
            IERC20(token).safeTransfer(lpRecipient, lpAmount);
        }

        emit FeeDistributed(token, amount, lpAmount, reserveAmount, treasuryAmount);
    }
}
