// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager}    from "../../lib/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "../../lib/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey}         from "../../lib/v4-core/src/types/PoolKey.sol";
import {BalanceDelta}    from "../../lib/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "../../lib/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "../../lib/v4-core/src/types/PoolOperation.sol";
import {IERC20}    from "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

interface IReserveVault {
    function deposit(address token, uint256 amount) external;
}

/// @title TestRouter
/// @notice Unlock-callback router for liquidity + swaps on Unichain Sepolia.
///         Charges a 20bps protocol fee on each swap, routing it to the ReserveVault.
///         NOT audited — for testing only.
contract TestRouter is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;

    address public constant RESERVE_VAULT    = 0xA046d4bDb3CDc4ba92cA0939b1464aE1cAb6B025;
    uint256 public constant PROTOCOL_FEE_BPS = 20; // 0.20%

    // No price limit: use min/max sqrt price constants
    uint160 internal constant MIN_SQRT_PRICE_PLUS_ONE  = 4295128740;
    uint160 internal constant MAX_SQRT_PRICE_MINUS_ONE = 1461446703485210103287273052203988822378723970341;

    enum Action { ADD, REMOVE, SWAP }

    struct CBData {
        Action                action;
        PoolKey               key;
        ModifyLiquidityParams lpParams;
        SwapParams            swapParams;
        address               sender;
        address               recipient;
    }

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    // ─── External — liquidity ─────────────────────────────────────────────────

    function addLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params
    ) external returns (BalanceDelta delta) {
        bytes memory result = poolManager.unlock(abi.encode(CBData({
            action:     Action.ADD,
            key:        key,
            lpParams:   params,
            swapParams: SwapParams(false, 0, 0),
            sender:     msg.sender,
            recipient:  msg.sender
        })));
        delta = abi.decode(result, (BalanceDelta));
    }

    function removeLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params
    ) external returns (BalanceDelta delta) {
        bytes memory result = poolManager.unlock(abi.encode(CBData({
            action:     Action.REMOVE,
            key:        key,
            lpParams:   params,
            swapParams: SwapParams(false, 0, 0),
            sender:     msg.sender,
            recipient:  msg.sender
        })));
        delta = abi.decode(result, (BalanceDelta));
    }

    // ─── External — swap ──────────────────────────────────────────────────────

    /// @param key       The pool to swap in.
    /// @param zeroForOne True = sell token0 for token1; false = sell token1 for token0.
    /// @param amountIn  Exact input amount (positive integer — converted to negative amountSpecified).
    function swap(
        PoolKey calldata key,
        bool             zeroForOne,
        uint256          amountIn
    ) external returns (BalanceDelta delta) {
        // Collect protocol fee (20bps of amountIn) and route to ReserveVault
        address feeToken = zeroForOne
            ? Currency.unwrap(key.currency0)
            : Currency.unwrap(key.currency1);
        uint256 protocolFee = (amountIn * PROTOCOL_FEE_BPS) / 10_000;
        if (protocolFee > 0) {
            IERC20(feeToken).safeTransferFrom(msg.sender, address(this), protocolFee);
            IERC20(feeToken).approve(RESERVE_VAULT, protocolFee);
            IReserveVault(RESERVE_VAULT).deposit(feeToken, protocolFee);
        }

        uint160 sqrtLimit = zeroForOne ? MIN_SQRT_PRICE_PLUS_ONE : MAX_SQRT_PRICE_MINUS_ONE;

        bytes memory result = poolManager.unlock(abi.encode(CBData({
            action:   Action.SWAP,
            key:      key,
            lpParams: ModifyLiquidityParams(0, 0, 0, bytes32(0)),
            swapParams: SwapParams({
                zeroForOne:        zeroForOne,
                amountSpecified:   -int256(amountIn), // negative = exactIn
                sqrtPriceLimitX96: sqrtLimit
            }),
            sender:    msg.sender,
            recipient: msg.sender
        })));
        delta = abi.decode(result, (BalanceDelta));
    }

    // ─── IUnlockCallback ───────────────────────────────────────────────────────

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "TestRouter: caller not PM");

        CBData memory cb = abi.decode(data, (CBData));

        BalanceDelta delta;

        if (cb.action == Action.SWAP) {
            delta = poolManager.swap(cb.key, cb.swapParams, "");
        } else {
            (delta,) = poolManager.modifyLiquidity(cb.key, cb.lpParams, "");
        }

        _settle(cb.key.currency0, delta.amount0(), cb.sender, cb.recipient);
        _settle(cb.key.currency1, delta.amount1(), cb.sender, cb.recipient);

        return abi.encode(delta);
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _settle(
        Currency currency,
        int128   amount,
        address  sender,
        address  recipient
    ) internal {
        if (amount < 0) {
            uint256 amt = uint256(uint128(-amount));
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransferFrom(sender, address(poolManager), amt);
            poolManager.settle();
        } else if (amount > 0) {
            poolManager.take(currency, recipient, uint256(uint128(amount)));
        }
    }
}
