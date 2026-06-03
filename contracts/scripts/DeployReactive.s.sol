// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HedgeFlowReactive} from "../src/reactive/HedgeFlowReactive.sol";

/// @title DeployReactive
/// @notice Deploys HedgeFlowReactive to Reactive Network (Kopli testnet or mainnet).
///
///         This is a SEPARATE deployment from Deploy.s.sol — the RSC lives on
///         Reactive Network, not on Base/Arbitrum.  Run AFTER the origin-chain
///         contracts are deployed and their addresses are in the environment.
///
///         Required env vars:
///           DEPLOYER_PRIVATE_KEY   — deployer private key (funded on Reactive Network)
///           ORIGIN_CHAIN_ID        — EIP-155 chain ID of the origin chain (e.g. 84532 for Base Sepolia)
///           HEDGEFLOW_HOOK         — HedgeFlowHook address on the origin chain
///           RISK_MANAGER           — RiskManager address on the origin chain (callback target)
///
///         Usage:
///           forge script scripts/DeployReactive.s.sol \
///             --rpc-url $REACTIVE_NETWORK_RPC_URL \
///             --broadcast \
///             -vvv
///
///         After deployment, fund the contract with a small amount of Reactive Network native
///         token so it can pay for subscription gas:
///           cast send <HEDGEFLOW_REACTIVE> --value 0.1ether --rpc-url $REACTIVE_NETWORK_RPC_URL \
///             --private-key $DEPLOYER_PRIVATE_KEY
///
///         Then update .env:
///           HEDGEFLOW_REACTIVE=<printed address>
contract DeployReactive is Script {
    function run() external {
        uint256 deployerKey   = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 originChainId = vm.envUint("ORIGIN_CHAIN_ID");
        address hedgeflowHook = vm.envAddress("HEDGEFLOW_HOOK");
        address riskManager   = vm.envAddress("RISK_MANAGER");

        address deployer = vm.addr(deployerKey);

        console2.log("=== HedgeFlowReactive Deployment (Reactive Network) ===");
        console2.log("Deployer:         ", deployer);
        console2.log("Origin Chain ID:  ", originChainId);
        console2.log("HedgeFlowHook:    ", hedgeflowHook);
        console2.log("RiskManager:      ", riskManager);
        console2.log("Target network:    Reactive Network");

        vm.startBroadcast(deployerKey);

        HedgeFlowReactive reactive = new HedgeFlowReactive(
            originChainId,
            hedgeflowHook,
            riskManager
        );

        vm.stopBroadcast();

        console2.log("\n=== Deployment Complete ===");
        console2.log("HedgeFlowReactive:", address(reactive));
        console2.log("\n--- Update .env ---");
        console2.log("HEDGEFLOW_REACTIVE=", address(reactive));
        console2.log("\n--- Next steps ---");
        console2.log("1. Fund the RSC with native token for subscription gas:");
        console2.log("   cast send", address(reactive), "--value 0.1ether --rpc-url $REACTIVE_NETWORK_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY");
        console2.log("2. Verify RiskManager on origin chain has reactive callback sender authorised:");
        console2.log("   0x0000000000000000000000000000000000fffFfF is pre-authorised in constructor");
    }
}
