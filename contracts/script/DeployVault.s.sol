// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ReserveVault} from "../src/vaults/ReserveVault.sol";

contract DeployVault is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Deploying ReserveVault (MIN_DEPOSIT_DURATION=5min)...");

        vm.startBroadcast(deployerKey);
        ReserveVault vault = new ReserveVault(deployer);
        vm.stopBroadcast();

        console2.log("ReserveVault:", address(vault));
    }
}
