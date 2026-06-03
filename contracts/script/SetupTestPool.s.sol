// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {IPoolManager} from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey}      from "../lib/v4-core/src/types/PoolKey.sol";
import {Currency}     from "../lib/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "../lib/v4-core/src/libraries/LPFeeLibrary.sol";
import {IHooks}       from "../lib/v4-core/src/interfaces/IHooks.sol";
import {ModifyLiquidityParams} from "../lib/v4-core/src/types/PoolOperation.sol";

import {OracleManager} from "../src/managers/OracleManager.sol";
import {TestRouter}    from "../src/test/TestRouter.sol";
import {ERC20Mock}     from "../test/mocks/ERC20Mock.sol";

/// @notice One-time setup script for frontend LP testing on Unichain Sepolia.
///
///  What it does:
///    1. Deploys tUSDC and tWETH (publicly mintable ERC20Mock tokens)
///    2. Sets $1 oracle prices for both tokens in OracleManager
///    3. Deploys a TestRouter (simple unlock-callback liquidity router)
///    4. Initializes a Uniswap v4 pool with the HedgeFlow hook
///    5. Mints 100 000 of each token to the deployer
///    6. Adds initial liquidity so the pool is active
///    7. Prints env vars to paste into frontend/.env.local
///
///  Usage:
///    forge script script/SetupTestPool.s.sol \
///      --rpc-url https://sepolia.unichain.org \
///      --broadcast -vvvv
contract SetupTestPool is Script {

    // ─── Deployed contracts ────────────────────────────────────────────────────

    address constant POOL_MANAGER   = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    address constant HEDGEFLOW_HOOK = 0x3A3d97eBC316426B0f94DF5fD22352EA3Cf489C1;
    address constant ORACLE_MANAGER = 0x7F084b3245b1FCFC44B2f55c2a2047ae33e9d5a8;

    // sqrtPriceX96 for a 1:1 price ratio = sqrt(1) * 2^96
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    // Full-range ticks for tickSpacing = 60
    int24 constant TICK_LOWER    = -887220;
    int24 constant TICK_UPPER    =  887220;
    int24 constant TICK_SPACING  =  60;

    // Initial liquidity to seed the pool
    int256 constant INITIAL_LIQUIDITY = 10_000e18;

    // Tokens minted to deployer for manual testing
    uint256 constant MINT_AMOUNT = 100_000e18;

    // ─── Run ──────────────────────────────────────────────────────────────────

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console2.log("=== HedgeFlow Test Pool Setup ===");
        console2.log("Deployer:", deployer);
        console2.log("Balance: %s wei", deployer.balance);

        require(deployer.balance >= 0.01 ether,
            "Need >= 0.01 ETH on Unichain Sepolia. Bridge at superbridge.app/unichain-sepolia");

        vm.startBroadcast(deployerKey);

        // 1. Deploy test tokens
        ERC20Mock tUSDC = new ERC20Mock("Test USDC", "tUSDC", 18);
        ERC20Mock tWETH = new ERC20Mock("Test WETH", "tWETH", 18);
        console2.log("[1/6] tUSDC:", address(tUSDC));
        console2.log("      tWETH:", address(tWETH));

        // Sort tokens: Uniswap v4 requires currency0 < currency1
        (address addr0, address addr1) = address(tUSDC) < address(tWETH)
            ? (address(tUSDC), address(tWETH))
            : (address(tWETH), address(tUSDC));
        ERC20Mock token0 = ERC20Mock(addr0);
        ERC20Mock token1 = ERC20Mock(addr1);

        // 2. Set oracle prices ($1 each)
        OracleManager oracle = OracleManager(ORACLE_MANAGER);
        oracle.updatePrice(addr0, 1e18, 1e18);
        oracle.updatePrice(addr1, 1e18, 1e18);
        console2.log("[2/6] Oracle prices set: $1 each");

        // 3. Deploy TestRouter
        TestRouter router = new TestRouter(IPoolManager(POOL_MANAGER));
        console2.log("[3/6] TestRouter:", address(router));

        // 4. Initialize pool
        PoolKey memory key = PoolKey({
            currency0:   Currency.wrap(addr0),
            currency1:   Currency.wrap(addr1),
            fee:         LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks:       IHooks(HEDGEFLOW_HOOK)
        });
        IPoolManager(POOL_MANAGER).initialize(key, SQRT_PRICE_1_1);
        console2.log("[4/6] Pool initialized (1:1 price)");

        // 5. Mint tokens to deployer
        token0.mint(deployer, MINT_AMOUNT);
        token1.mint(deployer, MINT_AMOUNT);
        console2.log("[5/6] Minted %s of each token to deployer", MINT_AMOUNT);

        // 6. Add initial liquidity via TestRouter
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);

        router.addLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower:      TICK_LOWER,
                tickUpper:      TICK_UPPER,
                liquidityDelta: INITIAL_LIQUIDITY,
                salt:           bytes32(0)
            })
        );
        console2.log("[6/6] Initial liquidity added");

        vm.stopBroadcast();

        // Output env block
        console2.log("\n============================================================");
        console2.log("  SETUP COMPLETE - paste into hedgeflow/frontend/.env.local");
        console2.log("============================================================");
        console2.log("NEXT_PUBLIC_TOKEN0=%s", addr0);
        console2.log("NEXT_PUBLIC_TOKEN1=%s", addr1);
        console2.log("NEXT_PUBLIC_TOKEN0_SYMBOL=%s", addr0 == address(tUSDC) ? "tUSDC" : "tWETH");
        console2.log("NEXT_PUBLIC_TOKEN1_SYMBOL=%s", addr1 == address(tUSDC) ? "tUSDC" : "tWETH");
        console2.log("NEXT_PUBLIC_TEST_ROUTER=%s", address(router));
        console2.log("NEXT_PUBLIC_POOL_MANAGER=%s", POOL_MANAGER);
        console2.log("NEXT_PUBLIC_HEDGEFLOW_HOOK=%s", HEDGEFLOW_HOOK);
        console2.log("============================================================");
        console2.log("\nPool Key:");
        console2.log("  currency0:   %s", addr0);
        console2.log("  currency1:   %s", addr1);
        console2.log("  fee:         0x800000 (dynamic)");
        console2.log("  tickSpacing: 60");
        console2.log("  hooks:       %s", HEDGEFLOW_HOOK);
    }
}
