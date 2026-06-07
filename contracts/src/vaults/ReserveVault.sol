// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "../../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IReserveVault} from "../interfaces/IReserveVault.sol";

/// @title ReserveVault
/// @notice Holds insurance reserves and executes IL compensation payouts.
///
///         Payout protections:
///         - Single payout capped at 5% of reserve balance
///         - LP must have been deposited for at least MIN_DEPOSIT_DURATION
///         - Per-LP cooldown between claims
contract ReserveVault is IReserveVault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ─────────────────────────────────────────────────────────────

    /// @notice Minimum LP deposit duration before compensation is eligible (5 min for testnet)
    uint256 public constant MIN_DEPOSIT_DURATION = 5 minutes;

    /// @notice Maximum single payout as a fraction of reserve (5% = 500 bps)
    uint256 public constant MAX_SINGLE_PAYOUT_BPS = 500;

    /// @notice Cooldown between claims per LP (5 min for testnet)
    uint256 public constant CLAIM_COOLDOWN = 5 minutes;

    uint256 private constant BPS = 10_000;

    // ─── State ─────────────────────────────────────────────────────────────────

    /// @notice token => reserve balance
    mapping(address => uint256) private _reserveBalance;

    /// @notice token => total compensations paid
    mapping(address => uint256) private _totalCompensationsPaid;

    /// @notice lp => token => last claim timestamp
    mapping(address => mapping(address => uint256)) private _lastClaimTime;

    /// @notice Addresses authorised to call payCompensation (the hook)
    mapping(address => bool) public authorised;

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) Ownable(_owner) {}

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function setAuthorised(address account, bool status) external onlyOwner {
        authorised[account] = status;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAuthorised() {
        if (!authorised[msg.sender] && msg.sender != owner()) revert Unauthorized();
        _;
    }

    // ─── IReserveVault ─────────────────────────────────────────────────────────

    /// @inheritdoc IReserveVault
    function deposit(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _reserveBalance[token] += amount;
        emit ReserveDeposited(token, amount, _reserveBalance[token]);
    }

    /// @inheritdoc IReserveVault
    function payCompensation(
        address lp,
        address token,
        uint256 amount,
        uint256 depositTimestamp
    ) external nonReentrant onlyAuthorised {
        if (amount == 0) revert ZeroAmount();

        // ── Minimum duration check ───────────────────────────────────────────
        if (block.timestamp < depositTimestamp + MIN_DEPOSIT_DURATION) {
            revert MinimumDurationNotMet(depositTimestamp, MIN_DEPOSIT_DURATION);
        }

        // ── Cooldown check ───────────────────────────────────────────────────
        uint256 nextAllowed = _lastClaimTime[lp][token] + CLAIM_COOLDOWN;
        if (block.timestamp < nextAllowed) {
            revert CooldownActive(nextAllowed);
        }

        // ── Solvency check ───────────────────────────────────────────────────
        uint256 balance = _reserveBalance[token];
        if (amount > balance) revert InsufficientReserve(amount, balance);

        // ── Single payout cap: 5% of reserve ────────────────────────────────
        uint256 cap = (balance * MAX_SINGLE_PAYOUT_BPS) / BPS;
        if (amount > cap) revert PayoutExceedsCap(amount, cap);

        // ── Execute payout ───────────────────────────────────────────────────
        _reserveBalance[token] -= amount;
        _totalCompensationsPaid[token] += amount;
        _lastClaimTime[lp][token] = block.timestamp;

        IERC20(token).safeTransfer(lp, amount);

        emit CompensationPaid(lp, token, amount);
        emit ReserveHealthUpdated(_reserveBalance[token], _totalCompensationsPaid[token], reserveHealth(token));
    }

    // ─── View functions ────────────────────────────────────────────────────────

    /// @inheritdoc IReserveVault
    function reserveBalance(address token) external view returns (uint256) {
        return _reserveBalance[token];
    }

    /// @inheritdoc IReserveVault
    function totalCompensationsPaid(address token) external view returns (uint256) {
        return _totalCompensationsPaid[token];
    }

    /// @inheritdoc IReserveVault
    function reserveHealth(address token) public view returns (uint256) {
        uint256 liabilities = _totalCompensationsPaid[token];
        if (liabilities == 0) return BPS; // 100% healthy
        uint256 balance = _reserveBalance[token];
        return (balance * BPS) / liabilities;
    }

    /// @inheritdoc IReserveVault
    function canPay(address token, uint256 amount) external view returns (bool) {
        uint256 balance = _reserveBalance[token];
        if (amount > balance) return false;
        uint256 cap = (balance * MAX_SINGLE_PAYOUT_BPS) / BPS;
        return amount <= cap;
    }

    // ─── Emergency ─────────────────────────────────────────────────────────────

    /// @notice Emergency withdrawal by owner (governance / multisig)
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        _reserveBalance[token] = _reserveBalance[token] > amount
            ? _reserveBalance[token] - amount
            : 0;
    }
}
