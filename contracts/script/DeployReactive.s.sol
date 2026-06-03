// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {HedgeFlowReactive} from "../src/reactive/HedgeFlowReactive.sol";

/// @title DeployReactive
/// @notice Deploys HedgeFlowReactive to the Reactive Network (Lasna Testnet, chain ID 5318007).
///
///         The RSC subscribes to HedgeFlowHook and RiskManager events on the origin
///         chain and automatically dispatches callbacks to RiskManager.setRiskMode().
///
///         Required env vars (all already set in .env):
///           REACTIVE_PRIVATE_KEY        — funded deployer on Reactive Network
///           ORIGIN_CHAIN_ID             — chain ID of the origin chain (e.g. 1301 for Unichain Sepolia)
///           HEDGEFLOW_HOOK              — HedgeFlowHook address on origin chain
///           RISK_MANAGER                — RiskManager address on origin chain (callback target)
///
///         Usage:
///           source .env && forge script script/DeployReactive.s.sol \
///             --rpc-url $REACTIVE_RPC_URL \
///             --broadcast \
///             -vvvv
contract DeployReactive is Script {
    /// @dev Initial funding sent to the RSC to cover callback gas on Reactive Network.
    ///      0.1 REACT is more than enough for testnet; increase for mainnet.
    uint256 constant INITIAL_FUNDING = 0.1 ether;

    function run() external {
        uint256 deployerKey   = vm.envUint("REACTIVE_PRIVATE_KEY");
        address deployer      = vm.addr(deployerKey);
        uint256 originChainId = vm.envUint("ORIGIN_CHAIN_ID");
        address hedgeflowHook = vm.envAddress("HEDGEFLOW_HOOK");
        address riskManager   = vm.envAddress("RISK_MANAGER");

        console2.log("=== HedgeFlowReactive Deployment ===");
        console2.log("Deployer:        ", deployer);
        console2.log("Balance:          %s wei", deployer.balance);
        console2.log("Chain ID:        ", block.chainid);
        console2.log("Origin Chain ID: ", originChainId);
        console2.log("HedgeFlowHook:   ", hedgeflowHook);
        console2.log("RiskManager:     ", riskManager);
        console2.log("Initial funding:  %s wei", INITIAL_FUNDING);
        console2.log("");

        require(block.chainid == 5318007, "Wrong chain: deploy to Reactive Network (chain ID 5318007)");
        require(deployer.balance >= INITIAL_FUNDING + 0.01 ether,
            "Deployer needs >= 0.11 REACT on Reactive Network. Bridge at https://dev.reactive.network/faucet");

        vm.startBroadcast(deployerKey);

        // Deploy (constructor is not payable — fund separately below)
        HedgeFlowReactive reactive = new HedgeFlowReactive(
            originChainId,
            hedgeflowHook,
            riskManager
        );

        // Fund the RSC so it can pay for callback gas on Reactive Network.
        // AbstractPayer has a receive() fallback — a plain ETH transfer is all we need.
        (bool ok,) = address(reactive).call{value: INITIAL_FUNDING}("");
        require(ok, "Funding transfer failed");

        vm.stopBroadcast();

        console2.log("\n============================================================");
        console2.log("  DEPLOYMENT COMPLETE");
        console2.log("============================================================");
        console2.log("HEDGEFLOW_REACTIVE=", address(reactive));
        console2.log("");
        console2.log("Subscriptions registered:");
        console2.log("  SwapExecuted      <- HedgeFlowHook  (origin chain", originChainId, ")");
        console2.log("  RiskScoreUpdated  <- RiskManager    (origin chain", originChainId, ")");
        console2.log("");
        console2.log("Callback target:");
        console2.log("  RiskManager.setRiskMode() @", riskManager);
        console2.log("============================================================");
        console2.log("\nPaste into your .env:");
        console2.log("HEDGEFLOW_REACTIVE=", address(reactive));
    }
}
