"""Unit tests for HedgeFlow risk scoring engine"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.scoring import (
    compute_volatility_score,
    compute_liquidity_stress_score,
    compute_whale_activity_score,
    compute_reserve_pressure_score,
    classify_risk_mode,
    compute_risk,
)
from src.models import RiskMode, PoolMetrics, PricePoint
import time


def make_prices(n=50, base=3000.0, std=0.01):
    """Generate a synthetic price series."""
    import random
    prices = [base]
    for _ in range(n - 1):
        prices.append(prices[-1] * (1 + random.gauss(0, std)))
    return prices


def test_volatility_score_stable():
    """Stable prices → low volatility score"""
    prices = [3000.0] * 50
    score = compute_volatility_score(prices)
    assert score == 0.0, f"Expected 0, got {score}"
    print(f"  ✓ Stable prices → volatility score = {score}")


def test_volatility_score_volatile():
    """Highly volatile prices → high score"""
    import random
    random.seed(42)
    prices = make_prices(100, std=0.05)
    score = compute_volatility_score(prices)
    assert score > 10, f"Expected > 10, got {score}"
    print(f"  ✓ Volatile prices → volatility score = {score:.2f}")


def test_volatility_score_single_price():
    """Single price → 0 (no returns to compute)"""
    score = compute_volatility_score([3000.0])
    assert score == 0.0
    print(f"  ✓ Single price → volatility score = {score}")


def test_liquidity_stress_zero_volume():
    """Zero volume → zero stress"""
    score = compute_liquidity_stress_score(tvl_usd=1_000_000, volume_24h_usd=0)
    assert score == 0.0
    print(f"  ✓ Zero volume → liquidity stress = {score}")


def test_liquidity_stress_high_volume():
    """Volume = TVL → high stress"""
    score = compute_liquidity_stress_score(tvl_usd=1_000_000, volume_24h_usd=1_000_000)
    assert score == 80.0, f"Expected 80, got {score}"
    print(f"  ✓ Volume = TVL → liquidity stress = {score}")


def test_liquidity_stress_capped():
    """Volume >> TVL → capped at 100"""
    score = compute_liquidity_stress_score(tvl_usd=100_000, volume_24h_usd=10_000_000)
    assert score == 100.0
    print(f"  ✓ Volume >> TVL → liquidity stress capped at {score}")


def test_whale_activity_no_whales():
    """No whale swaps → 0"""
    swaps = [100, 200, 50, 300]  # all small
    score = compute_whale_activity_score(swaps, tvl_usd=1_000_000, whale_threshold_pct=0.01)
    assert score == 0.0
    print(f"  ✓ No whale swaps → whale score = {score}")


def test_whale_activity_all_whales():
    """All swaps are whale-sized → high score"""
    swaps = [20_000, 15_000, 25_000]  # all > 1% of 1M TVL
    score = compute_whale_activity_score(swaps, tvl_usd=1_000_000)
    assert score == 100.0
    print(f"  ✓ All whale swaps → whale score = {score}")


def test_reserve_pressure_healthy():
    """Healthy reserve → low pressure"""
    score = compute_reserve_pressure_score(reserve_balance=1_000_000, total_liabilities=10_000)
    assert score < 10, f"Expected < 10, got {score}"
    print(f"  ✓ Healthy reserve → pressure = {score:.2f}")


def test_reserve_pressure_critical():
    """Reserve < liabilities → high pressure"""
    score = compute_reserve_pressure_score(reserve_balance=1_000, total_liabilities=10_000)
    assert score > 50, f"Expected > 50, got {score}"
    print(f"  ✓ Critical reserve → pressure = {score:.2f}")


def test_reserve_pressure_empty():
    """Empty reserve → max pressure"""
    score = compute_reserve_pressure_score(reserve_balance=0, total_liabilities=1_000)
    assert score == 100.0
    print(f"  ✓ Empty reserve → pressure = {score}")


def test_classify_risk_mode():
    """Risk mode classification thresholds"""
    assert classify_risk_mode(0)   == RiskMode.NORMAL
    assert classify_risk_mode(30)  == RiskMode.NORMAL
    assert classify_risk_mode(31)  == RiskMode.ELEVATED
    assert classify_risk_mode(55)  == RiskMode.ELEVATED
    assert classify_risk_mode(56)  == RiskMode.DEFENSIVE
    assert classify_risk_mode(80)  == RiskMode.DEFENSIVE
    assert classify_risk_mode(81)  == RiskMode.CRISIS
    assert classify_risk_mode(100) == RiskMode.CRISIS
    print("  ✓ Risk mode classification thresholds correct")


def test_compute_risk_normal():
    """Low-stress pool → NORMAL mode"""
    metrics = PoolMetrics(
        pool_id="0xtest",
        prices=[PricePoint(price=3000.0, timestamp=int(time.time()) - i * 60) for i in range(50)],
        tvl_usd=10_000_000,
        volume_24h_usd=100_000,
        reserve_balance=5_000_000,
        total_liabilities=100_000,
    )
    result = compute_risk(metrics)
    assert result.risk_mode == RiskMode.NORMAL, f"Expected NORMAL, got {result.risk_mode}"
    assert result.risk_score <= 30
    print(f"  ✓ Low-stress pool → {result.risk_mode} (score={result.risk_score:.2f})")


def test_compute_risk_crisis():
    """High-stress pool → CRISIS or DEFENSIVE mode"""
    import random
    random.seed(99)
    prices = make_prices(100, std=0.08)  # very volatile
    metrics = PoolMetrics(
        pool_id="0xcrisis",
        prices=[PricePoint(price=p, timestamp=int(time.time()) - i * 60) for i, p in enumerate(prices)],
        tvl_usd=500_000,
        volume_24h_usd=2_000_000,  # volume >> TVL
        reserve_balance=1_000,
        total_liabilities=500_000,  # near-insolvent reserve
    )
    result = compute_risk(metrics)
    assert result.risk_mode in (RiskMode.CRISIS, RiskMode.DEFENSIVE), \
        f"Expected CRISIS/DEFENSIVE, got {result.risk_mode}"
    print(f"  ✓ High-stress pool → {result.risk_mode} (score={result.risk_score:.2f})")


def test_fee_table():
    """Recommended fee matches mode"""
    fee_map = {
        RiskMode.NORMAL:    3_000,
        RiskMode.ELEVATED:  6_000,
        RiskMode.DEFENSIVE: 12_000,
        RiskMode.CRISIS:    25_000,
    }
    for mode, expected_fee in fee_map.items():
        metrics = PoolMetrics(
            pool_id="0xfee",
            prices=[PricePoint(price=3000.0, timestamp=int(time.time()))],
            tvl_usd=1_000_000,
            volume_24h_usd=0,
            reserve_balance=1_000_000,
            total_liabilities=0,
        )
        # Force a specific mode by patching classify
        from src import scoring
        original = scoring.classify_risk_mode
        scoring.classify_risk_mode = lambda _: mode
        result = compute_risk(metrics)
        scoring.classify_risk_mode = original
        assert result.recommended_fee_bps == expected_fee, \
            f"Mode {mode}: expected fee {expected_fee}, got {result.recommended_fee_bps}"
    print("  ✓ Fee table correct for all modes")


if __name__ == "__main__":
    tests = [
        test_volatility_score_stable,
        test_volatility_score_volatile,
        test_volatility_score_single_price,
        test_liquidity_stress_zero_volume,
        test_liquidity_stress_high_volume,
        test_liquidity_stress_capped,
        test_whale_activity_no_whales,
        test_whale_activity_all_whales,
        test_reserve_pressure_healthy,
        test_reserve_pressure_critical,
        test_reserve_pressure_empty,
        test_classify_risk_mode,
        test_compute_risk_normal,
        test_compute_risk_crisis,
        test_fee_table,
    ]

    print("\n=== HedgeFlow Risk Engine Tests ===\n")
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  ✗ {test.__name__}: {e}")
            failed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)
