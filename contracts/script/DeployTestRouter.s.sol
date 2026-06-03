// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager}     from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {TestRouter}       from "../src/test/TestRouter.sol";

contract DeployTestRouter is Script {
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        TestRouter router = new TestRouter(IPoolManager(POOL_MANAGER));
        console2.log("New TestRouter:", address(router));
        console2.log("Update NEXT_PUBLIC_TEST_ROUTER=%s", address(router));

        vm.stopBroadcast();
    }
}
