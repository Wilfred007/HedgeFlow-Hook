// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─── Uniswap v4 core ───────────────────────────────────────────────────────────
import {IPoolManager} from "../../lib/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "../../lib/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "../../lib/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "../../lib/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "../../lib/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "../../lib/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "../../lib/v4-core/src/types/PoolOperation.sol";
import {Hooks} from "../../lib/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "../../lib/v4-core/src/libraries/LPFeeLibrary.sol";
import {Currency, CurrencyLibrary} from "../../lib/v4-core/src/types/Currency.sol";


// ─── OpenZeppelin ──────────────────────────────────────────────────────────────
import {Ownable} from "../../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "../../lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "../../lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

// ─── HedgeFlow ─────────────────────────────────────────────────────────────────
import {IRiskManager} from "../interfaces/IRiskManager.sol";
import {IReserveVault} from "../interfaces/IReserveVault.sol";
import {IILCalculator} from "../interfaces/IILCalculator.sol";
import {IOracleManager} from "../interfaces/IOracleManager.sol";
import {HedgeFlowMath} from "../libraries/HedgeFlowMath.sol";

/// @title HedgeFlowHook
/// @notice Core Uniswap v4 hook implementing adaptive liquidity protection.
///
///         Hook flags required (encoded in deployment address):
///           BEFORE_ADD_LIQUIDITY_FLAG        (1 << 11)
///           AFTER_REMOVE_LIQUIDITY_FLAG      (1 << 8)
///           BEFORE_SWAP_FLAG                 (1 << 7)
///           AFTER_SWAP_FLAG                  (1 << 6)
///           AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG (1 << 0)
///
///         Address bits required: 0b_0000_1001_1100_0001 = 0x09C1
contract HedgeFlowHook is IHooks, Ownable, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;
    using HedgeFlowMath for uint256;

    // ─── Types ─────────────────────────────────────────────────────────────────

    /// @notice Snapshot of an LP position at deposit time
    struct LPPosition {
        uint256 depositAmount0;    // token0 amount deposited (18-dec normalised)
        uint256 depositAmount1;    // token1 amount deposited (18-dec normalised)
        uint256 depositPrice0USD;  // token0 price at deposit (18-dec)
        uint256 depositPrice1USD;  // token1 price at deposit (18-dec)
        uint256 depositValueUSD;   // total USD value at deposit
        uint256 depositTimestamp;
        bool    exists;
    }

    // ─── Events ────────────────────────────────────────────────────────────────

    event LiquidityAdded(
        address indexed lp,
        bytes32 indexed poolId,
        uint256 amount0,
        uint256 amount1,
        uint256 valueUSD,
        uint256 timestamp
    );

    event LiquidityRemoved(
        address indexed lp,
        bytes32 indexed poolId,
        uint256 withdrawAmount0,
        uint256 withdrawAmount1,
        uint256 ilAmountUSD,
        uint256 compensationUSD,
        uint256 timestamp
    );

    event SwapExecuted(
        bytes32 indexed poolId,
        address indexed sender,
        uint24  feeBps,
        IRiskManager.RiskMode riskMode,
        uint256 timestamp
    );

    event ReserveAllocated(
        bytes32 indexed poolId,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    event ProtocolPaused();
    event ProtocolResumed();

    // ─── Errors ────────────────────────────────────────────────────────────────

    error NotPoolManager();
    error ProtocolIsPaused();
    error PositionNotFound();
    error OraclePriceUnavailable(address token);

    // ─── State ─────────────────────────────────────────────────────────────────

    IPoolManager   public immutable poolManager;
    IRiskManager   public riskManager;
    IReserveVault  public reserveVault;
    IILCalculator  public ilCalculator;
    IOracleManager public oracleManager;

    address public treasury;

    bool public paused;

    /// @notice lp => poolId => position
    mapping(address => mapping(bytes32 => LPPosition)) public positions;

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(
        IPoolManager   _poolManager,
        IRiskManager   _riskManager,
        IReserveVault  _reserveVault,
        IILCalculator  _ilCalculator,
        IOracleManager _oracleManager,
        address        _treasury,
        address        _owner
    ) Ownable(_owner) {
        poolManager   = _poolManager;
        riskManager   = _riskManager;
        reserveVault  = _reserveVault;
        ilCalculator  = _ilCalculator;
        oracleManager = _oracleManager;
        treasury      = _treasury;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ProtocolIsPaused();
        _;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function setRiskManager(address _rm) external onlyOwner {
        riskManager = IRiskManager(_rm);
    }

    function setReserveVault(address _rv) external onlyOwner {
        reserveVault = IReserveVault(_rv);
    }

    function setILCalculator(address _ilc) external onlyOwner {
        ilCalculator = IILCalculator(_ilc);
    }

    function setOracleManager(address _om) external onlyOwner {
        oracleManager = IOracleManager(_om);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function pauseProtocol() external onlyOwner {
        paused = true;
        emit ProtocolPaused();
    }

    function resumeProtocol() external onlyOwner {
        paused = false;
        emit ProtocolResumed();
    }

    // ─── IHooks — beforeInitialize ─────────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160)
        external
        pure
        returns (bytes4)
    {
        return IHooks.beforeInitialize.selector;
    }

    // ─── IHooks — afterInitialize ──────────────────────────────────────────────

    function afterInitialize(address, PoolKey calldata, uint160, int24)
        external
        pure
        returns (bytes4)
    {
        return IHooks.afterInitialize.selector;
    }

    // ─── IHooks — beforeAddLiquidity ───────────────────────────────────────────

    /// @notice Record LP position snapshot at deposit time
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) external onlyPoolManager whenNotPaused returns (bytes4) {
        bytes32 poolId = PoolId.unwrap(key.toId());

        // Attempt to fetch current prices; skip position recording if oracle unavailable
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        uint256 price0;
        uint256 price1;
        bool pricesAvailable = true;

        try oracleManager.getPrice(token0) returns (uint256 p0) {
            price0 = p0;
        } catch {
            pricesAvailable = false;
        }

        if (pricesAvailable) {
            try oracleManager.getPrice(token1) returns (uint256 p1) {
                price1 = p1;
            } catch {
                pricesAvailable = false;
            }
        }

        if (pricesAvailable && params.liquidityDelta > 0) {
            // Estimate token amounts from liquidity delta (simplified: use liquidity as proxy)
            // In production this would use SqrtPriceMath to compute exact amounts
            uint256 liqAbs = uint256(params.liquidityDelta);

            // Store position — amounts stored as liquidity units for MVP
            // A production implementation would compute exact token amounts
            LPPosition storage pos = positions[sender][poolId];
            if (!pos.exists) {
                pos.depositAmount0    = liqAbs / 2;
                pos.depositAmount1    = liqAbs / 2;
                pos.depositPrice0USD  = price0;
                pos.depositPrice1USD  = price1;
                pos.depositValueUSD   = (liqAbs / 2 * price0 + liqAbs / 2 * price1) / 1e18;
                pos.depositTimestamp  = block.timestamp;
                pos.exists            = true;
            } else {
                // Accumulate into existing position
                pos.depositAmount0   += liqAbs / 2;
                pos.depositAmount1   += liqAbs / 2;
                pos.depositValueUSD  += (liqAbs / 2 * price0 + liqAbs / 2 * price1) / 1e18;
            }

            emit LiquidityAdded(
                sender,
                poolId,
                liqAbs / 2,
                liqAbs / 2,
                pos.depositValueUSD,
                block.timestamp
            );
        }

        return IHooks.beforeAddLiquidity.selector;
    }

    // ─── IHooks — afterAddLiquidity ────────────────────────────────────────────

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    // ─── IHooks — beforeRemoveLiquidity ────────────────────────────────────────

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) external onlyPoolManager returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    // ─── IHooks — afterRemoveLiquidity ─────────────────────────────────────────

    /// @notice Calculate IL and trigger compensation payout when LP withdraws
    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager nonReentrant returns (bytes4, BalanceDelta) {
        if (paused) return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));

        bytes32 poolId = PoolId.unwrap(key.toId());
        LPPosition storage pos = positions[sender][poolId];

        if (!pos.exists) {
            return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
        }

        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        // ── Fetch current prices ─────────────────────────────────────────────
        uint256 currentPrice0;
        uint256 currentPrice1;

        try oracleManager.getPrice(token0) returns (uint256 p0) {
            currentPrice0 = p0;
        } catch {
            // Oracle unavailable — skip compensation, clean up position
            delete positions[sender][poolId];
            return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
        }

        try oracleManager.getPrice(token1) returns (uint256 p1) {
            currentPrice1 = p1;
        } catch {
            delete positions[sender][poolId];
            return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
        }

        // ── Withdrawal amounts from BalanceDelta ─────────────────────────────
        // delta amounts are negative (LP receives tokens back)
        int128 raw0 = delta.amount0();
        int128 raw1 = delta.amount1();
        uint256 withdrawAmount0 = raw0 < 0 ? uint256(uint128(-raw0)) : uint256(uint128(raw0));
        uint256 withdrawAmount1 = raw1 < 0 ? uint256(uint128(-raw1)) : uint256(uint128(raw1));

        // ── IL calculation ───────────────────────────────────────────────────
        uint256 protectionRatioBps = riskManager.getProtectionRatioBps();

        IILCalculator.ILResult memory ilResult = ilCalculator.calculateIL(
            pos.depositAmount0,
            pos.depositAmount1,
            pos.depositPrice0USD,
            pos.depositPrice1USD,
            currentPrice0,
            currentPrice1,
            withdrawAmount0,
            withdrawAmount1,
            protectionRatioBps
        );

        // ── Compensation payout ──────────────────────────────────────────────
        if (ilResult.compensationUSD > 0) {
            // Compensation is paid in token1 (stablecoin side) for simplicity
            // Convert USD compensation to token1 amount
            uint256 compensationToken1 = currentPrice1 > 0
                ? (ilResult.compensationUSD * 1e18) / currentPrice1
                : 0;

            if (compensationToken1 > 0 && reserveVault.canPay(token1, compensationToken1)) {
                try reserveVault.payCompensation(
                    sender,
                    token1,
                    compensationToken1,
                    pos.depositTimestamp
                ) {
                    emit LiquidityRemoved(
                        sender,
                        poolId,
                        withdrawAmount0,
                        withdrawAmount1,
                        ilResult.ilAmountUSD,
                        ilResult.compensationUSD,
                        block.timestamp
                    );
                } catch {
                    // Payout failed (cooldown, cap, etc.) — emit with 0 compensation
                    emit LiquidityRemoved(
                        sender,
                        poolId,
                        withdrawAmount0,
                        withdrawAmount1,
                        ilResult.ilAmountUSD,
                        0,
                        block.timestamp
                    );
                }
            } else {
                emit LiquidityRemoved(
                    sender,
                    poolId,
                    withdrawAmount0,
                    withdrawAmount1,
                    ilResult.ilAmountUSD,
                    0,
                    block.timestamp
                );
            }
        }

        // ── Clean up position ────────────────────────────────────────────────
        delete positions[sender][poolId];

        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    // ─── IHooks — beforeSwap ───────────────────────────────────────────────────

    /// @notice Apply dynamic fee based on current risk mode
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata
    ) external onlyPoolManager whenNotPaused returns (bytes4, BeforeSwapDelta, uint24) {
        // Read current risk mode and select fee
        uint24 feeBps = riskManager.getCurrentFeeBps();

        // Signal to PoolManager to override the LP fee for this swap
        // The OVERRIDE_FEE_FLAG (0x400000) must be set in the returned fee
        uint24 overrideFee = feeBps | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        bytes32 poolId = PoolId.unwrap(key.toId());
        emit SwapExecuted(
            poolId,
            sender,
            feeBps,
            riskManager.getMode(),
            block.timestamp
        );

        return (
            IHooks.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            overrideFee
        );
    }

    // ─── IHooks — afterSwap ────────────────────────────────────────────────────

    /// @notice Emit analytics after swap completes
    function afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        // Emit reserve allocation event for indexer tracking
        // Actual fee splitting happens via FeeRouter in production
        // For MVP: emit event so the indexer can track fee revenue
        bytes32 poolId = PoolId.unwrap(key.toId());

        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        // Track the larger absolute amount as the fee-bearing side
        uint256 feeAmount = amount0 < 0
            ? uint256(uint128(-amount0))
            : uint256(uint128(amount1 < 0 ? -amount1 : amount1));

        address feeToken = amount0 < 0
            ? Currency.unwrap(key.currency0)
            : Currency.unwrap(key.currency1);

        if (feeAmount > 0) {
            // Reserve allocation = 20% of fee
            uint256 reserveShare = (feeAmount * 2_000) / 10_000;
            emit ReserveAllocated(poolId, feeToken, reserveShare, block.timestamp);
        }

        return (IHooks.afterSwap.selector, 0);
    }

    // ─── IHooks — beforeDonate / afterDonate ───────────────────────────────────

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    /// @notice Returns the LP position for a given LP and pool
    function getPosition(address lp, bytes32 poolId) external view returns (LPPosition memory) {
        return positions[lp][poolId];
    }

    /// @notice Returns the hook permissions bitmask for address validation
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize:                false,
            afterInitialize:                 false,
            beforeAddLiquidity:              true,
            afterAddLiquidity:               false,
            beforeRemoveLiquidity:           false,
            afterRemoveLiquidity:            true,
            beforeSwap:                      true,
            afterSwap:                       true,
            beforeDonate:                    false,
            afterDonate:                     false,
            beforeSwapReturnDelta:           false,
            afterSwapReturnDelta:            false,
            afterAddLiquidityReturnDelta:    false,
            afterRemoveLiquidityReturnDelta: true
        });
    }
}
