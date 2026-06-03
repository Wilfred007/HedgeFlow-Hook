"""
HedgeFlow Risk Scoring Engine

Weighted risk formula:
  RiskScore = 0.4 * V + 0.3 * L + 0.2 * W + 0.1 * R

Where:
  V = Volatility score      (0–100)
  L = Liquidity stress      (0–100)
  W = Whale activity        (0–100)
  R = Reserve pressure      (0–100)

Risk thresholds:
  0–30   → NORMAL
  31–55  → ELEVATED
  56–80  → DEFENSIVE
  81–100 → CRISIS
"""
from __future__ import annotations

import numpy as np
from typing import Sequence

from .models import RiskMode, RiskComponents, RiskEngineOutput, PoolMetrics, SentimentResult

# ─── Weights ───────────────────────────────────────────────────────────────────
WEIGHT_VOLATILITY       = 0.40
WEIGHT_LIQUIDITY_STRESS = 0.30
WEIGHT_WHALE_ACTIVITY   = 0.20
WEIGHT_RESERVE_PRESSURE = 0.10

# ─── Fee table (Uniswap v4 units: 1_000_000 = 100%) ───────────────────────────
FEE_TABLE = {
    RiskMode.NORMAL:    3_000,
    RiskMode.ELEVATED:  6_000,
    RiskMode.DEFENSIVE: 12_000,
    RiskMode.CRISIS:    25_000,
}

# ─── Volatility scoring ────────────────────────────────────────────────────────

def compute_volatility_score(prices: Sequence[float]) -> float:
    """
    Compute a 0–100 volatility score from a price series.

    Uses annualised standard deviation of log returns, capped and normalised.
    """
    if len(prices) < 2:
        return 0.0

    arr = np.array(prices, dtype=float)
    # Log returns
    returns = np.diff(np.log(arr))
    if len(returns) == 0:
        return 0.0

    std = float(np.std(returns))

    # Annualise (assuming 5-minute candles: 288 per day, 105120 per year)
    annualised = std * np.sqrt(105_120)

    # Map to 0–100:
    # 0% annualised vol → 0
    # 200% annualised vol → 100
    score = min(100.0, (annualised / 2.0) * 100.0)
    return round(score, 2)


# ─── Liquidity stress scoring ──────────────────────────────────────────────────

def compute_liquidity_stress_score(tvl_usd: float, volume_24h_usd: float) -> float:
    """
    Score based on volume/TVL ratio.
    High volume relative to TVL = stress.
    """
    if tvl_usd <= 0:
        return 100.0

    ratio = volume_24h_usd / tvl_usd

    # 0 ratio → 0 stress
    # 1.0 ratio (volume = TVL) → 80 stress
    # 2.0+ ratio → 100 stress
    score = min(100.0, ratio * 80.0)
    return round(score, 2)


# ─── Whale activity scoring ────────────────────────────────────────────────────

def compute_whale_activity_score(
    swap_amounts: Sequence[float],
    tvl_usd: float,
    whale_threshold_pct: float = 0.01,  # 1% of TVL
) -> float:
    """
    Score based on proportion of swaps that are 'whale-sized' (> threshold% of TVL).
    """
    if not swap_amounts or tvl_usd <= 0:
        return 0.0

    threshold = tvl_usd * whale_threshold_pct
    whale_count = sum(1 for a in swap_amounts if a >= threshold)
    whale_ratio = whale_count / len(swap_amounts)

    # 0 whale swaps → 0
    # 50%+ whale swaps → 100
    score = min(100.0, whale_ratio * 200.0)
    return round(score, 2)


# ─── Reserve pressure scoring ─────────────────────────────────────────────────

def compute_reserve_pressure_score(
    reserve_balance: float,
    total_liabilities: float,
) -> float:
    """
    Score based on reserve health ratio.
    High liabilities relative to reserve = high pressure.
    """
    if reserve_balance <= 0:
        return 100.0
    if total_liabilities <= 0:
        return 0.0

    health = reserve_balance / total_liabilities

    # health >= 10 → 0 pressure
    # health = 1   → 50 pressure
    # health < 0.5 → 100 pressure
    if health >= 10.0:
        return 0.0
    elif health >= 1.0:
        # Linear from 0 to 50 as health goes from 10 to 1
        score = 50.0 * (10.0 - health) / 9.0
    else:
        # Linear from 50 to 100 as health goes from 1 to 0
        score = 50.0 + 50.0 * (1.0 - health)

    return round(min(100.0, max(0.0, score)), 2)


# ─── Risk mode classification ──────────────────────────────────────────────────

def classify_risk_mode(score: float) -> RiskMode:
    if score <= 30:
        return RiskMode.NORMAL
    elif score <= 55:
        return RiskMode.ELEVATED
    elif score <= 80:
        return RiskMode.DEFENSIVE
    else:
        return RiskMode.CRISIS


# ─── Final risk combination with sentiment ────────────────────────────────────

def combine_with_sentiment(
    statistical_score: float,
    sentiment_score: float,
) -> float:
    """
    FinalRisk = 0.8 * StatisticalRisk + 0.2 * SentimentRisk
    """
    return round(0.8 * statistical_score + 0.2 * sentiment_score, 2)


# ─── Main scoring function ────────────────────────────────────────────────────

def compute_risk(
    metrics: PoolMetrics,
    swap_amounts: Sequence[float] | None = None,
    sentiment: SentimentResult | None = None,
    timestamp: int = 0,
) -> RiskEngineOutput:
    """
    Compute the full risk score for a pool.
    """
    import time
    ts = timestamp or int(time.time())

    prices = [p.price for p in metrics.prices]

    # ── Component scores ──────────────────────────────────────────────────────
    v = compute_volatility_score(prices)
    l = compute_liquidity_stress_score(metrics.tvl_usd, metrics.volume_24h_usd)
    w = compute_whale_activity_score(swap_amounts or [], metrics.tvl_usd)
    r = compute_reserve_pressure_score(metrics.reserve_balance, metrics.total_liabilities)

    # ── Weighted score ────────────────────────────────────────────────────────
    statistical_score = (
        WEIGHT_VOLATILITY       * v
        + WEIGHT_LIQUIDITY_STRESS * l
        + WEIGHT_WHALE_ACTIVITY   * w
        + WEIGHT_RESERVE_PRESSURE * r
    )
    statistical_score = round(min(100.0, max(0.0, statistical_score)), 2)

    # ── Combine with sentiment ────────────────────────────────────────────────
    final_score = statistical_score
    if sentiment is not None:
        final_score = combine_with_sentiment(statistical_score, sentiment.score)

    risk_mode = classify_risk_mode(final_score)

    return RiskEngineOutput(
        risk_score=final_score,
        risk_mode=risk_mode,
        recommended_fee_bps=FEE_TABLE[risk_mode],
        components=RiskComponents(
            volatility=v,
            liquidity_stress=l,
            whale_activity=w,
            reserve_pressure=r,
        ),
        sentiment=sentiment,
        timestamp=ts,
    )
