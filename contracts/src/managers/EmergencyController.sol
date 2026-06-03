// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title EmergencyController
/// @notice Global pause / resume switch for the HedgeFlow protocol.
///         The hook checks isPaused() before executing any logic.
contract EmergencyController is Ownable {
    // ─── Events ────────────────────────────────────────────────────────────────

    event ProtocolPaused(address indexed by, string reason);
    event ProtocolResumed(address indexed by);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error AlreadyPaused();
    error NotPaused();
    error Unauthorized();

    // ─── State ─────────────────────────────────────────────────────────────────

    bool public paused;
    mapping(address => bool) public guardians;

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address _owner) Ownable(_owner) {}

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function setGuardian(address account, bool status) external onlyOwner {
        guardians[account] = status;
    }

    // ─── Core ──────────────────────────────────────────────────────────────────

    /// @notice Pause the protocol
    function pauseProtocol(string calldata reason) external {
        if (!guardians[msg.sender] && msg.sender != owner()) revert Unauthorized();
        if (paused) revert AlreadyPaused();
        paused = true;
        emit ProtocolPaused(msg.sender, reason);
    }

    /// @notice Resume the protocol
    function resumeProtocol() external onlyOwner {
        if (!paused) revert NotPaused();
        paused = false;
        emit ProtocolResumed(msg.sender);
    }

    /// @notice Returns true if the protocol is active (not paused)
    function isActive() external view returns (bool) {
        return !paused;
    }
}
