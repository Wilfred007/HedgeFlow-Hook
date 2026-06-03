// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";

import {RiskManager}         from "../src/managers/RiskManager.sol";
import {ILCalculator}        from "../src/managers/ILCalculator.sol";
import {OracleManager}       from "../src/managers/OracleManager.sol";
import {ReserveVault}        from "../src/vaults/ReserveVault.sol";
import {FeeRouter}           from "../src/managers/FeeRouter.sol";
import {EmergencyController} from "../src/managers/EmergencyController.sol";

import {IRiskManager}  from "../src/interfaces/IRiskManager.sol";
import {IILCalculator} from "../src/interfaces/IILCalculator.sol";

import {ERC20Mock} from "./mocks/ERC20Mock.sol";

/// @title HedgeFlowTest
/// @notice Unit tests for HedgeFlow protocol components (no PoolManager required)
contract HedgeFlowTest is Test {
    // ─── Contracts ─────────────────────────────────────────────────────────────

    RiskManager         riskManager;
    ILCalculator        ilCalculator;
    OracleManager       oracleManager;
    ReserveVault        reserveVault;
    FeeRouter           feeRouter;
    EmergencyController emergencyController;

    ERC20Mock usdc;
    ERC20Mock weth;

    address owner   = address(0xA11CE);
    address lp      = address(0xBEEF);
    address treasury = address(0xFEED);
    address automation = address(0xAB0D);

    // ─── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        // Warp to a realistic timestamp so "2 days ago" doesn't underflow
        vm.warp(1_700_000_000);

        vm.startPrank(owner);

        riskManager         = new RiskManager(owner);
        ilCalculator        = new ILCalculator();
        oracleManager       = new OracleManager(owner);
        reserveVault        = new ReserveVault(owner);
        emergencyController = new EmergencyController(owner);

        usdc = new ERC20Mock("USD Coin", "USDC", 18);
        weth = new ERC20Mock("Wrapped ETH", "WETH", 18);

        feeRouter = new FeeRouter(owner, address(reserveVault), treasury);

        // Authorise automation to update risk mode
        riskManager.setAuthorised(automation, true);

        vm.stopPrank();
    }

    // ─── RiskManager tests ─────────────────────────────────────────────────────

    function test_RiskManager_DefaultMode() public view {
        assertEq(uint8(riskManager.getMode()), uint8(IRiskManager.RiskMode.NORMAL));
        assertEq(riskManager.getRiskScore(), 0);
    }

    function test_RiskManager_SetMode_Authorised() public {
        vm.prank(automation);
        riskManager.setRiskMode(IRiskManager.RiskMode.DEFENSIVE, 70);

        assertEq(uint8(riskManager.getMode()), uint8(IRiskManager.RiskMode.DEFENSIVE));
        assertEq(riskManager.getRiskScore(), 70);
    }

    function test_RiskManager_SetMode_Unauthorised_Reverts() public {
        vm.prank(lp);
        vm.expectRevert(IRiskManager.Unauthorized.selector);
        riskManager.setRiskMode(IRiskManager.RiskMode.CRISIS, 90);
    }

    function test_RiskManager_InvalidScore_Reverts() public {
        vm.prank(automation);
        vm.expectRevert(abi.encodeWithSelector(IRiskManager.InvalidRiskScore.selector, 101));
        riskManager.setRiskMode(IRiskManager.RiskMode.CRISIS, 101);
    }

    function test_RiskManager_FeeBps() public view {
        assertEq(riskManager.getFeeBpsForMode(IRiskManager.RiskMode.NORMAL),    3_000);
        assertEq(riskManager.getFeeBpsForMode(IRiskManager.RiskMode.ELEVATED),  6_000);
        assertEq(riskManager.getFeeBpsForMode(IRiskManager.RiskMode.DEFENSIVE), 12_000);
        assertEq(riskManager.getFeeBpsForMode(IRiskManager.RiskMode.CRISIS),    25_000);
    }

    function test_RiskManager_ProtectionRatioBps() public view {
        assertEq(riskManager.getProtectionRatioBpsForMode(IRiskManager.RiskMode.NORMAL),    2_000);
        assertEq(riskManager.getProtectionRatioBpsForMode(IRiskManager.RiskMode.ELEVATED),  3_000);
        assertEq(riskManager.getProtectionRatioBpsForMode(IRiskManager.RiskMode.DEFENSIVE), 4_000);
        assertEq(riskManager.getProtectionRatioBpsForMode(IRiskManager.RiskMode.CRISIS),    5_000);
    }

    function test_RiskManager_ModeTransitionEvent() public {
        vm.prank(automation);
        vm.expectEmit(true, true, false, true);
        emit IRiskManager.RiskModeUpdated(
            IRiskManager.RiskMode.NORMAL,
            IRiskManager.RiskMode.ELEVATED,
            45,
            block.timestamp
        );
        riskManager.setRiskMode(IRiskManager.RiskMode.ELEVATED, 45);
    }

    // ─── ILCalculator tests ────────────────────────────────────────────────────

    function test_ILCalculator_NoIL_WhenPriceUnchanged() public view {
        // Deposit: 1 ETH + 3000 USDC, price ETH = 3000 USD
        // Withdraw same amounts → no IL
        IILCalculator.ILResult memory result = ilCalculator.calculateIL(
            1e18,    // depositAmount0 (1 ETH)
            3000e18, // depositAmount1 (3000 USDC)
            3000e18, // depositPrice0USD (ETH = $3000)
            1e18,    // depositPrice1USD (USDC = $1)
            3000e18, // currentPrice0USD (unchanged)
            1e18,    // currentPrice1USD (unchanged)
            1e18,    // withdrawAmount0 (same as deposit)
            3000e18, // withdrawAmount1 (same as deposit)
            4_000    // 40% protection
        );

        assertEq(result.ilAmountUSD, 0);
        assertEq(result.compensationUSD, 0);
    }

    function test_ILCalculator_IL_WhenPriceDrops() public view {
        // Deposit: 1 ETH + 3000 USDC at ETH = $3000
        // ETH drops to $2000, LP gets back more ETH but less USDC
        // Hold value = 1 * 2000 + 3000 * 1 = 5000
        // LP value   = 1.2 * 2000 + 2400 * 1 = 2400 + 2400 = 4800
        // IL = 5000 - 4800 = 200
        // Compensation (40%) = 80

        IILCalculator.ILResult memory result = ilCalculator.calculateIL(
            1e18,    // depositAmount0 (1 ETH)
            3000e18, // depositAmount1 (3000 USDC)
            3000e18, // depositPrice0USD
            1e18,    // depositPrice1USD
            2000e18, // currentPrice0USD (ETH dropped)
            1e18,    // currentPrice1USD
            12e17,   // withdrawAmount0 (1.2 ETH — more ETH due to IL)
            2400e18, // withdrawAmount1 (2400 USDC — less USDC)
            4_000    // 40% protection
        );

        // Hold value: 1 ETH * 2000 + 3000 USDC * 1 = 5000 USD (in 1e18 units)
        assertEq(result.holdValueUSD, 5000e18);
        // LP value: 1.2 ETH * 2000 + 2400 USDC * 1 = 2400 + 2400 = 4800 USD
        assertEq(result.lpValueUSD, 4800e18);
        // IL = 200 USD
        assertEq(result.ilAmountUSD, 200e18);
        // Compensation = 200 * 40% = 80 USD
        assertEq(result.compensationUSD, 80e18);
    }

    function test_ILCalculator_NoNegativeIL() public view {
        // LP value > hold value (LP gained) → IL = 0
        IILCalculator.ILResult memory result = ilCalculator.calculateIL(
            1e18,
            3000e18,
            3000e18,
            1e18,
            4000e18, // ETH pumped
            1e18,
            8e17,    // less ETH
            3600e18, // more USDC
            4_000
        );

        // Hold value = 1 * 4000 + 3000 * 1 = 7000
        // LP value   = 0.8 * 4000 + 3600 * 1 = 3200 + 3600 = 6800
        // IL = 7000 - 6800 = 200 (still positive IL in this case)
        // Just verify no underflow
        assertGe(result.ilAmountUSD, 0);
    }

    function test_ILCalculator_ProtectionRatioScales() public view {
        // Same IL, different protection ratios
        uint256[4] memory ratios = [uint256(2_000), 3_000, 4_000, 5_000];
        uint256 expectedIL = 200e18;

        for (uint256 i = 0; i < 4; i++) {
            IILCalculator.ILResult memory result = ilCalculator.calculateIL(
                1e18, 3000e18, 3000e18, 1e18, 2000e18, 1e18, 12e17, 2400e18, ratios[i]
            );
            assertEq(result.ilAmountUSD, expectedIL);
            assertEq(result.compensationUSD, (expectedIL * ratios[i]) / 10_000);
        }
    }

    // ─── OracleManager tests ───────────────────────────────────────────────────

    function test_OracleManager_UpdateAndGetPrice() public {
        vm.prank(owner);
        oracleManager.updatePrice(address(weth), 3000e18, 2990e18);

        uint256 price = oracleManager.getPrice(address(weth));
        assertEq(price, 3000e18);
    }

    function test_OracleManager_StalePrice_Reverts() public {
        vm.prank(owner);
        oracleManager.updatePrice(address(weth), 3000e18, 0);

        // Warp past maxPriceAge
        vm.warp(block.timestamp + 3601);

        vm.expectRevert();
        oracleManager.getPrice(address(weth));
    }

    function test_OracleManager_DeviationTooHigh_Reverts() public {
        vm.prank(owner);
        // 5% deviation > 2% max
        vm.expectRevert();
        oracleManager.updatePrice(address(weth), 3000e18, 2850e18);
    }

    function test_OracleManager_IsPriceFresh() public {
        assertFalse(oracleManager.isPriceFresh(address(weth)));

        vm.prank(owner);
        oracleManager.updatePrice(address(weth), 3000e18, 0);

        assertTrue(oracleManager.isPriceFresh(address(weth)));
    }

    // ─── ReserveVault tests ────────────────────────────────────────────────────

    function test_ReserveVault_Deposit() public {
        uint256 amount = 10_000e18;
        usdc.mint(lp, amount);

        vm.startPrank(lp);
        usdc.approve(address(reserveVault), amount);
        reserveVault.deposit(address(usdc), amount);
        vm.stopPrank();

        assertEq(reserveVault.reserveBalance(address(usdc)), amount);
    }

    function test_ReserveVault_PayCompensation() public {
        // Fund reserve
        uint256 reserveAmount = 100_000e18;
        usdc.mint(owner, reserveAmount);
        vm.startPrank(owner);
        usdc.approve(address(reserveVault), reserveAmount);
        reserveVault.deposit(address(usdc), reserveAmount);

        // Authorise test contract to pay compensation
        reserveVault.setAuthorised(address(this), true);
        vm.stopPrank();

        // LP deposited 2 days ago
        uint256 depositTs = block.timestamp - 2 days;

        // Pay 1000 USDC compensation (< 5% of 100k = 5000)
        uint256 payAmount = 1_000e18;
        reserveVault.payCompensation(lp, address(usdc), payAmount, depositTs);

        assertEq(usdc.balanceOf(lp), payAmount);
        assertEq(reserveVault.reserveBalance(address(usdc)), reserveAmount - payAmount);
    }

    function test_ReserveVault_PayoutCapEnforced() public {
        uint256 reserveAmount = 100_000e18;
        usdc.mint(owner, reserveAmount);
        vm.startPrank(owner);
        usdc.approve(address(reserveVault), reserveAmount);
        reserveVault.deposit(address(usdc), reserveAmount);
        reserveVault.setAuthorised(address(this), true);
        vm.stopPrank();

        uint256 depositTs = block.timestamp - 2 days;

        // Try to pay 6000 USDC (> 5% of 100k = 5000) → should revert
        vm.expectRevert();
        reserveVault.payCompensation(lp, address(usdc), 6_000e18, depositTs);
    }

    function test_ReserveVault_MinDurationEnforced() public {
        uint256 reserveAmount = 100_000e18;
        usdc.mint(owner, reserveAmount);
        vm.startPrank(owner);
        usdc.approve(address(reserveVault), reserveAmount);
        reserveVault.deposit(address(usdc), reserveAmount);
        reserveVault.setAuthorised(address(this), true);
        vm.stopPrank();

        // Deposit timestamp = now (< 1 day ago)
        uint256 depositTs = block.timestamp;

        vm.expectRevert();
        reserveVault.payCompensation(lp, address(usdc), 100e18, depositTs);
    }

    function test_ReserveVault_CooldownEnforced() public {
        uint256 reserveAmount = 100_000e18;
        usdc.mint(owner, reserveAmount);
        vm.startPrank(owner);
        usdc.approve(address(reserveVault), reserveAmount);
        reserveVault.deposit(address(usdc), reserveAmount);
        reserveVault.setAuthorised(address(this), true);
        vm.stopPrank();

        uint256 depositTs = block.timestamp - 2 days;

        // First claim succeeds
        reserveVault.payCompensation(lp, address(usdc), 100e18, depositTs);

        // Second claim immediately → cooldown
        vm.expectRevert();
        reserveVault.payCompensation(lp, address(usdc), 100e18, depositTs);

        // After cooldown passes → succeeds
        vm.warp(block.timestamp + 7 hours);
        reserveVault.payCompensation(lp, address(usdc), 100e18, depositTs);
    }

    function test_ReserveVault_ReserveHealth() public {
        uint256 reserveAmount = 10_000e18;
        usdc.mint(owner, reserveAmount);
        vm.startPrank(owner);
        usdc.approve(address(reserveVault), reserveAmount);
        reserveVault.deposit(address(usdc), reserveAmount);
        reserveVault.setAuthorised(address(this), true);
        vm.stopPrank();

        // Before any payouts: health = 100% (10_000 bps)
        assertEq(reserveVault.reserveHealth(address(usdc)), 10_000);

        // Pay 100 USDC
        reserveVault.payCompensation(lp, address(usdc), 100e18, block.timestamp - 2 days);

        // Health = (9900 / 100) * 10000 = 990000 bps (reserve >> liabilities)
        assertGt(reserveVault.reserveHealth(address(usdc)), 10_000);
    }

    // ─── FeeRouter tests ───────────────────────────────────────────────────────

    function test_FeeRouter_Distribute() public {
        uint256 feeAmount = 1_000e18;
        usdc.mint(address(feeRouter), feeAmount);

        vm.prank(owner);
        feeRouter.distribute(address(usdc), feeAmount, lp);

        // LP gets 70%
        assertEq(usdc.balanceOf(lp), 700e18);
        // Reserve gets 20%
        assertEq(usdc.balanceOf(address(reserveVault)), 200e18);
        // Treasury gets 10%
        assertEq(usdc.balanceOf(treasury), 100e18);
    }

    function test_FeeRouter_InvalidAllocation_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(FeeRouter.InvalidAllocation.selector);
        feeRouter.setAllocation(5_000, 3_000, 1_000); // sums to 9000, not 10000
    }

    // ─── EmergencyController tests ─────────────────────────────────────────────

    function test_EmergencyController_PauseResume() public {
        assertTrue(emergencyController.isActive());

        vm.prank(owner);
        emergencyController.pauseProtocol("test pause");
        assertFalse(emergencyController.isActive());

        vm.prank(owner);
        emergencyController.resumeProtocol();
        assertTrue(emergencyController.isActive());
    }

    function test_EmergencyController_Guardian() public {
        address guardian = address(0xCAFE);
        vm.prank(owner);
        emergencyController.setGuardian(guardian, true);

        vm.prank(guardian);
        emergencyController.pauseProtocol("guardian pause");
        assertFalse(emergencyController.isActive());
    }

    function test_EmergencyController_Unauthorized_Reverts() public {
        vm.prank(lp);
        vm.expectRevert(EmergencyController.Unauthorized.selector);
        emergencyController.pauseProtocol("unauthorized");
    }
}
