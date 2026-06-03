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

import {IPoolManager}   from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {IRiskManager}   from "../src/interfaces/IRiskManager.sol";
import {IReserveVault}  from "../src/interfaces/IReserveVault.sol";
import {IILCalculator}  from "../src/interfaces/IILCalculator.sol";
import {IOracleManager} from "../src/interfaces/IOracleManager.sol";
import {Hooks}          from "../lib/v4-core/src/libraries/Hooks.sol";

/// @title DeployUnichain
/// @notice End-to-end deployment for Unichain Sepolia (chain ID 1301).
///
///         Flow:
///           1. Deploy RiskManager, ILCalculator, OracleManager, ReserveVault,
///              FeeRouter, EmergencyController (regular CREATE).
///           2. Mine a CREATE2 salt inline (pure computation, no tx) so the
///              HedgeFlowHook address ends in the required Uniswap v4 flag bits 0x09C1.
///           3. Deploy HedgeFlowHook via CREATE2 through the ARACHNID factory
///              (0x4e59…956C) - the same factory Foundry uses for `new{salt:…}`.
///           4. Wire authorisations.
///
///         Required env vars:
///           DEPLOYER_PRIVATE_KEY   - funded deployer (needs >= 0.01 ETH on Unichain Sepolia)
///           TREASURY_ADDRESS       - protocol treasury address
///
///         Optional env vars:
///           POOL_MANAGER_ADDRESS   - default: 0x00B036B58a818B1BC34d502D3fE730Db729e62AC
///           AUTOMATION_ADDRESS     - keeper address to pre-authorise (can be set post-deploy)
///
///         Usage:
///           forge script script/DeployUnichain.s.sol \
///             --rpc-url https://sepolia.unichain.org \
///             --broadcast \
///             -vvvv
contract DeployUnichain is Script {
    // ─── Constants ─────────────────────────────────────────────────────────────

    // CREATE2_FACTORY (0x4e59...956C) is inherited from forge-std/Base.sol.
    // Foundry routes `new Contract{salt:...}(...)` through it in broadcast mode.

    /// @dev Uniswap v4 PoolManager on Unichain Sepolia (chain ID 1301)
    address constant DEFAULT_POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

    /// @dev Required hook permission bits (see HedgeFlowHook.getHookPermissions)
    ///      BEFORE_ADD_LIQUIDITY | AFTER_REMOVE_LIQUIDITY | BEFORE_SWAP | AFTER_SWAP
    ///      | AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA  ->  0x09C1
    uint160 constant REQUIRED_FLAGS =
        Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
        Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
        Hooks.BEFORE_SWAP_FLAG |
        Hooks.AFTER_SWAP_FLAG |
        Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

    /// @dev Only the 14 LSBs of the hook address encode permissions
    uint160 constant HOOK_MASK = uint160((1 << 14) - 1);

    // ─── Entry point ───────────────────────────────────────────────────────────

    function run() external {
        require(block.chainid == 1301, "Wrong chain: use Unichain Sepolia (chain ID 1301)");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);
        address poolManager = vm.envOr("POOL_MANAGER_ADDRESS", DEFAULT_POOL_MANAGER);
        address treasury    = vm.envAddress("TREASURY_ADDRESS");

        console2.log("=== HedgeFlow - Unichain Sepolia Deployment ===");
        console2.log("Deployer:        ", deployer);
        console2.log("Balance:          %s wei", deployer.balance);
        console2.log("PoolManager:     ", poolManager);
        console2.log("Treasury:        ", treasury);
        console2.log("Chain ID:        ", block.chainid);
        console2.log("CREATE2 factory: ", CREATE2_FACTORY);
        console2.log("");

        require(deployer.balance >= 0.01 ether,
            "Deployer needs >= 0.01 ETH on Unichain Sepolia. Bridge from https://superbridge.app/unichain-sepolia");

        vm.startBroadcast(deployerKey);

        // ── 1. Supporting contracts ────────────────────────────────────────────
        console2.log("[1/7] RiskManager...");
        RiskManager riskManager = new RiskManager(deployer);
        console2.log("      ->", address(riskManager));

        console2.log("[2/7] ILCalculator...");
        ILCalculator ilCalculator = new ILCalculator();
        console2.log("      ->", address(ilCalculator));

        console2.log("[3/7] OracleManager...");
        OracleManager oracleManager = new OracleManager(deployer);
        console2.log("      ->", address(oracleManager));

        console2.log("[4/7] ReserveVault...");
        ReserveVault reserveVault = new ReserveVault(deployer);
        console2.log("      ->", address(reserveVault));

        console2.log("[5/7] FeeRouter...");
        FeeRouter feeRouter = new FeeRouter(deployer, address(reserveVault), treasury);
        console2.log("      ->", address(feeRouter));

        console2.log("[6/7] EmergencyController...");
        EmergencyController emergencyController = new EmergencyController(deployer);
        console2.log("      ->", address(emergencyController));

        // ── 2. Mine hook salt (pure computation - zero gas, zero txs) ──────────
        //
        //  _mineHookSalt is a pure function: it only does keccak256 arithmetic.
        //  Forge does NOT broadcast pure calls - this runs client-side only.
        //
        console2.log("[7/7] Mining hook address (need suffix 0x09C1, may take a few seconds)...");
        (bytes32 hookSalt, address hookAddr) = _mineHookSalt(
            poolManager,
            address(riskManager),
            address(reserveVault),
            address(ilCalculator),
            address(oracleManager),
            treasury,
            deployer
        );
        console2.log("      salt ->  ");
        console2.logBytes32(hookSalt);
        console2.log("      addr -> ", hookAddr);

        // ── 3. Deploy HedgeFlowHook via CREATE2 ───────────────────────────────
        //
        //  `new{salt:…}` in Foundry broadcast is routed through CREATE2_FACTORY
        //  (0x4e59…956C). The address is predictable because we mined against
        //  the same factory. We shadow the local simulation address with the
        //  mined address so wiring is always correct.
        //
        new HedgeFlowHook{salt: hookSalt}(
            IPoolManager(poolManager),
            IRiskManager(address(riskManager)),
            IReserveVault(address(reserveVault)),
            IILCalculator(address(ilCalculator)),
            IOracleManager(address(oracleManager)),
            treasury,
            deployer
        );
        // Use the mined address directly - avoids simulation/broadcast address discrepancy
        HedgeFlowHook hook = HedgeFlowHook(hookAddr);
        console2.log("      deployed (CREATE2) OK");

        // ── 4. Wire authorisations ─────────────────────────────────────────────
        reserveVault.setAuthorised(address(hook), true);
        feeRouter.setAuthorised(address(hook), true);

        address automation = vm.envOr("AUTOMATION_ADDRESS", address(0));
        if (automation != address(0)) {
            riskManager.setAuthorised(automation, true);
            console2.log("Automation keeper authorised: ", automation);
        }

        vm.stopBroadcast();

        // ── 5. Print .env block ────────────────────────────────────────────────
        _printEnvBlock(
            address(riskManager),
            address(ilCalculator),
            address(oracleManager),
            address(reserveVault),
            address(feeRouter),
            address(emergencyController),
            address(hook)
        );
    }

    // ─── Hook salt miner ───────────────────────────────────────────────────────

    /// @notice Iterate salts 0, 1, 2… until the CREATE2 address LSBs match
    ///         REQUIRED_FLAGS.  Typically finds a match within ~16 000 iterations
    ///         (~0.5 s).  Hard-caps at 300 000 to avoid infinite loops.
    function _mineHookSalt(
        address poolManager,
        address riskManager,
        address reserveVault,
        address ilCalculator,
        address oracleManager,
        address treasury,
        address owner
    ) internal view returns (bytes32 salt, address hookAddr) {
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(HedgeFlowHook).creationCode,
            abi.encode(
                IPoolManager(poolManager),
                IRiskManager(riskManager),
                IReserveVault(reserveVault),
                IILCalculator(ilCalculator),
                IOracleManager(oracleManager),
                treasury,
                owner
            )
        ));

        for (uint256 i = 0; i < 300_000; i++) {
            bytes32 s         = bytes32(i);
            address candidate = _create2Addr(CREATE2_FACTORY, s, initCodeHash);
            if (uint160(candidate) & HOOK_MASK == REQUIRED_FLAGS) {
                return (s, candidate);
            }
        }
        revert("HookMiner: no valid salt found in 300k iterations");
    }

    function _create2Addr(
        address factory,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return address(uint160(uint256(
            keccak256(abi.encodePacked(bytes1(0xff), factory, salt, initCodeHash))
        )));
    }

    // ─── Output helper ─────────────────────────────────────────────────────────

    function _printEnvBlock(
        address rm, address ilc, address om,
        address rv, address fr, address ec,
        address hook
    ) internal pure {
        console2.log("\n============================================================");
        console2.log("  DEPLOYMENT COMPLETE - paste these into your .env");
        console2.log("============================================================");
        console2.log("CHAIN_ID=1301");
        console2.log("ORIGIN_CHAIN_ID=1301");
        console2.log("RPC_URL=https://sepolia.unichain.org");
        console2.log("POOL_MANAGER_ADDRESS=0x00B036B58a818B1BC34d502D3fE730Db729e62AC");
        console2.log("");
        console2.log("HEDGEFLOW_HOOK=",        hook);
        console2.log("RISK_MANAGER=",          rm);
        console2.log("RESERVE_VAULT=",         rv);
        console2.log("ORACLE_MANAGER=",        om);
        console2.log("FEE_ROUTER=",            fr);
        console2.log("");
        console2.log("# informational");
        console2.log("IL_CALCULATOR=",         ilc);
        console2.log("EMERGENCY_CONTROLLER=",  ec);
        console2.log("============================================================");
        console2.log("\nNext: deploy HedgeFlowReactive to Reactive Network:");
        console2.log("  forge script scripts/DeployReactive.s.sol \\");
        console2.log("    --rpc-url $REACTIVE_NETWORK_RPC_URL --broadcast -vvv");
    }
}
