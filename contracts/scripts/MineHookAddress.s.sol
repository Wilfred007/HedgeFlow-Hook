// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager}  from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {IRiskManager}  from "../src/interfaces/IRiskManager.sol";
import {IReserveVault} from "../src/interfaces/IReserveVault.sol";
import {IILCalculator} from "../src/interfaces/IILCalculator.sol";
import {IOracleManager} from "../src/interfaces/IOracleManager.sol";
import {HedgeFlowHook} from "../src/hooks/HedgeFlowHook.sol";
import {Hooks}         from "../lib/v4-core/src/libraries/Hooks.sol";

/// @title MineHookAddress
/// @notice Standalone salt-miner for HedgeFlowHook.
///         Finds a CREATE2 salt so the hook address LSBs match Uniswap v4's
///         required permission flags.
///
///         Factory address: Foundry's `new{salt:…}` broadcast routes through
///         the ARACHNID CREATE2 factory (0x4e59…956C).  This script uses the
///         same factory by default so the mined salt is directly usable in
///         DeployUnichain.s.sol.  Override with CREATE2_FACTORY env var if needed.
///
///         Required flags (see HedgeFlowHook.getHookPermissions()):
///           BEFORE_ADD_LIQUIDITY_FLAG                (1 << 11) = 0x0800
///           AFTER_REMOVE_LIQUIDITY_FLAG              (1 << 8)  = 0x0100
///           BEFORE_SWAP_FLAG                         (1 << 7)  = 0x0080
///           AFTER_SWAP_FLAG                          (1 << 6)  = 0x0040
///           AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG (1 << 0) = 0x0001
///
///         Required address suffix bits: 0x09C1
///           0000 1001 1100 0001
///
///         Usage:
///           forge script scripts/MineHookAddress.s.sol \
///             --rpc-url $RPC_URL \
///             -vvv
contract MineHookAddress is Script {
    // ─── Required hook flags ───────────────────────────────────────────────────
    uint160 constant REQUIRED_FLAGS =
        Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
        Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
        Hooks.BEFORE_SWAP_FLAG |
        Hooks.AFTER_SWAP_FLAG |
        Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

    // ─── Mask: only check the 14 LSBs ─────────────────────────────────────────
    uint160 constant HOOK_MASK = uint160((1 << 14) - 1);

    /// @dev ARACHNID factory — same address Foundry uses for `new{salt:…}` in broadcast
    address constant DEFAULT_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external view {
        // Factory: default to ARACHNID (matches Foundry broadcast behaviour).
        // Override with CREATE2_FACTORY env var if using a custom factory.
        address factory      = vm.envOr("CREATE2_FACTORY", DEFAULT_CREATE2_FACTORY);
        address deployer     = vm.envAddress("DEPLOYER_ADDRESS"); // owner arg in constructor
        address poolManager  = vm.envAddress("POOL_MANAGER_ADDRESS");
        address treasury     = vm.envAddress("TREASURY_ADDRESS");

        // Placeholder addresses for constructor args (real ones set post-deploy)
        address riskManager  = vm.envOr("RISK_MANAGER",  address(0xdead));
        address reserveVault = vm.envOr("RESERVE_VAULT", address(0xdead));
        address ilCalc       = vm.envOr("IL_CALCULATOR",  address(0xdead));
        address oracleMgr    = vm.envOr("ORACLE_MANAGER", address(0xdead));

        bytes memory creationCode = abi.encodePacked(
            type(HedgeFlowHook).creationCode,
            abi.encode(
                IPoolManager(poolManager),
                IRiskManager(riskManager),
                IReserveVault(reserveVault),
                IILCalculator(ilCalc),
                IOracleManager(oracleMgr),
                treasury,
                deployer
            )
        );

        bytes32 initCodeHash = keccak256(creationCode);

        console2.log("=== HedgeFlow Hook Address Miner ===");
        console2.log("CREATE2 factory:", factory);
        console2.log("Owner (deployer):", deployer);
        console2.log("Required flags: ", REQUIRED_FLAGS);
        console2.log("Required bits:   0x09C1");
        console2.log("Mining...");

        uint256 found = 0;
        for (uint256 salt = 0; salt < 1_000_000; salt++) {
            bytes32 saltBytes = bytes32(salt);
            address predicted = _computeCreate2Address(factory, saltBytes, initCodeHash);
            uint160 addrBits  = uint160(predicted) & HOOK_MASK;

            if (addrBits == REQUIRED_FLAGS) {
                console2.log("\n✓ Found valid salt!");
                console2.log("  Salt (uint256):", salt);
                console2.log("  Salt (bytes32): ");
                console2.logBytes32(saltBytes);
                console2.log("  Hook address:  ", predicted);
                console2.log("  Address bits:   0x%x", addrBits);
                found++;
                if (found >= 3) break; // show 3 candidates
            }
        }

        if (found == 0) {
            console2.log("No valid salt found in first 1M iterations.");
            console2.log("Try increasing the search range.");
        }
    }

    function _computeCreate2Address(
        address deployer,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            deployer,
            salt,
            initCodeHash
        )))));
    }
}
