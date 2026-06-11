// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IReserveVault {
    function deposit(address token, uint256 amount) external;
    function reserveBalance(address token) external view returns (uint256);
    function canPay(address token, uint256 amount) external view returns (bool);
}

/// @notice Mints tUSDC and deposits it into the ReserveVault so IL compensation can be paid.
///
/// Usage:
///   forge script script/FundVault.s.sol --rpc-url $RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
///
/// The vault needs at least (maxCompensationUSD / 0.05) in reserve to clear the 5% payout cap.
/// With $50 000 deposited, single payouts up to $2 500 pass canPay.
contract FundVault is Script {
    address constant RESERVE_VAULT = 0xA5F45841CC150202b2F7013D47C1aC658823f5B6;
    address constant TUSDC         = 0x5f797282CCD3c8e383C55E461B84caE590a43f99;

    uint256 constant FUND_AMOUNT = 50_000e18; // 50 000 tUSDC (18 decimals)

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        IReserveVault vault = IReserveVault(RESERVE_VAULT);

        uint256 balanceBefore = vault.reserveBalance(TUSDC);
        console2.log("Vault tUSDC balance before:", balanceBefore / 1e18);

        vm.startBroadcast(deployerKey);
        IMintable(TUSDC).mint(deployer, FUND_AMOUNT);
        IMintable(TUSDC).approve(RESERVE_VAULT, FUND_AMOUNT);
        vault.deposit(TUSDC, FUND_AMOUNT);
        vm.stopBroadcast();

        uint256 balanceAfter = vault.reserveBalance(TUSDC);
        console2.log("Vault tUSDC balance after: ", balanceAfter / 1e18);
        console2.log("5%% payout cap (max single payout):", balanceAfter / 20 / 1e18, "tUSDC");
        console2.log("canPay $499 compensation:", vault.canPay(TUSDC, 499e18));
    }
}
