// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {RiskManager}         from "../src/managers/RiskManager.sol";
import {ILCalculator}        from "../src/managers/ILCalculator.sol";
import {OracleManager}       from "../src/managers/OracleManager.sol";
import {FeeRouter}           from "../src/managers/FeeRouter.sol";
import {EmergencyController} from "../src/managers/EmergencyController.sol";
import {ReserveVault}        from "../src/vaults/ReserveVault.sol";
import {HedgeFlowHook}       from "../src/hooks/HedgeFlowHook.sol";

import {IPoolManager}  from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {IRiskManager}  from "../src/interfaces/IRiskManager.sol";
import {IReserveVault} from "../src/interfaces/IReserveVault.sol";
import {IILCalculator} from "../src/interfaces/IILCalculator.sol";
import {IOracleManager} from "../src/interfaces/IOracleManager.sol";

/// @title HedgeFlow Deploy Script
/// @notice Deploys the full HedgeFlow protocol stack.
///
///         Required env vars:
///           DEPLOYER_PRIVATE_KEY  — deployer private key
///           POOL_MANAGER_ADDRESS  — Uniswap v4 PoolManager on target network
///           TREASURY_ADDRESS      — treasury multisig address
///
///         Optional:
///           AUTOMATION_ADDRESS    — automation contract address (can be set post-deploy)
contract Deploy is Script {
    function run() external {
        uint256 deployerKey  = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address poolManager  = vm.envAddress("POOL_MANAGER_ADDRESS");
        address treasury     = vm.envAddress("TREASURY_ADDRESS");
        address deployer     = vm.addr(deployerKey);

        console2.log("=== HedgeFlow Deployment ===");
        console2.log("Deployer:     ", deployer);
        console2.log("PoolManager:  ", poolManager);
        console2.log("Treasury:     ", treasury);
        console2.log("Chain ID:     ", block.chainid);

        vm.startBroadcast(deployerKey);

        // ── 1. Risk Manager ──────────────────────────────────────────────────
        RiskManager riskManager = new RiskManager(deployer);
        console2.log("RiskManager:  ", address(riskManager));

        // ── 2. IL Calculator ─────────────────────────────────────────────────
        ILCalculator ilCalculator = new ILCalculator();
        console2.log("ILCalculator: ", address(ilCalculator));

        // ── 3. Oracle Manager ────────────────────────────────────────────────
        OracleManager oracleManager = new OracleManager(deployer);
        console2.log("OracleManager:", address(oracleManager));

        // ── 4. Reserve Vault ─────────────────────────────────────────────────
        ReserveVault reserveVault = new ReserveVault(deployer);
        console2.log("ReserveVault: ", address(reserveVault));

        // ── 5. Fee Router ────────────────────────────────────────────────────
        FeeRouter feeRouter = new FeeRouter(deployer, address(reserveVault), treasury);
        console2.log("FeeRouter:    ", address(feeRouter));

        // ── 6. Emergency Controller ──────────────────────────────────────────
        EmergencyController emergencyController = new EmergencyController(deployer);
        console2.log("EmergencyCtrl:", address(emergencyController));

        // ── 7. HedgeFlow Hook ────────────────────────────────────────────────
        //
        //  NOTE: In production the hook address must be mined so that the
        //  least-significant bits match the required hook flags:
        //    BEFORE_ADD_LIQUIDITY_FLAG        (1 << 11) = 0x0800
        //    AFTER_REMOVE_LIQUIDITY_FLAG      (1 << 8)  = 0x0100
        //    BEFORE_SWAP_FLAG                 (1 << 7)  = 0x0080
        //    AFTER_SWAP_FLAG                  (1 << 6)  = 0x0040
        //    AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG (1 << 0) = 0x0001
        //  Required address suffix: 0x09C1
        //
        //  Use scripts/MineHookAddress.s.sol or HookMiner from v4-periphery.
        HedgeFlowHook hook = new HedgeFlowHook(
            IPoolManager(poolManager),
            IRiskManager(address(riskManager)),
            IReserveVault(address(reserveVault)),
            IILCalculator(address(ilCalculator)),
            IOracleManager(address(oracleManager)),
            treasury,
            deployer
        );
        console2.log("HedgeFlowHook:", address(hook));

        // ── 8. Wire authorisations ───────────────────────────────────────────
        reserveVault.setAuthorised(address(hook), true);
        feeRouter.setAuthorised(address(hook), true);

        // Optionally wire automation address if provided
        address automation = vm.envOr("AUTOMATION_ADDRESS", address(0));
        if (automation != address(0)) {
            riskManager.setAuthorised(automation, true);
            console2.log("Automation:   ", automation);
        }

        vm.stopBroadcast();

        console2.log("=== Deployment Complete ===");
        _printAddresses(
            address(riskManager),
            address(ilCalculator),
            address(oracleManager),
            address(reserveVault),
            address(feeRouter),
            address(emergencyController),
            address(hook)
        );
    }

    function _printAddresses(
        address rm, address ilc, address om, address rv, address fr, address ec, address hook
    ) internal pure {
        console2.log("\n--- Contract Addresses ---");
        console2.log("RISK_MANAGER=",          rm);
        console2.log("IL_CALCULATOR=",         ilc);
        console2.log("ORACLE_MANAGER=",        om);
        console2.log("RESERVE_VAULT=",         rv);
        console2.log("FEE_ROUTER=",            fr);
        console2.log("EMERGENCY_CONTROLLER=",  ec);
        console2.log("HEDGEFLOW_HOOK=",        hook);
    }
}
