"""
HedgeFlow Risk Engine — FastAPI application

Endpoints:
  POST /risk/score      — compute risk score for a pool
  GET  /risk/latest     — latest cached risk snapshot
  GET  /health          — health check
"""
from __future__ import annotations

import time
import os
from typing import Optional

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.models import RiskRequest, RiskEngineOutput, RiskMode, SentimentResult
from src.scoring import compute_risk
from src.grok import get_market_sentiment

app = FastAPI(
    title="HedgeFlow Risk Engine",
    description="Adaptive risk scoring for HedgeFlow liquidity protection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_URL  = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_KEY  = "hedgeflow:risk:latest"
CACHE_TTL  = 300  # 5 minutes

_redis: Optional[aioredis.Redis] = None
_latest_snapshot: Optional[RiskEngineOutput] = None  # in-memory fallback


@app.on_event("startup")
async def startup():
    global _redis
    try:
        _redis = aioredis.from_url(REDIS_URL, decode_responses=True)
        await _redis.ping()
        print("[RiskEngine] Redis connected")
    except Exception as e:
        print(f"[RiskEngine] Redis not available, using in-memory cache: {e}")
        _redis = None


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": int(time.time())}


@app.post("/risk/score", response_model=RiskEngineOutput)
async def score_risk(request: RiskRequest) -> RiskEngineOutput:
    """
    Compute a risk score for a pool given current metrics.

    The score uses:
      - Volatility (40%)
      - Liquidity stress (30%)
      - Whale activity (20%)
      - Reserve pressure (10%)

    If include_sentiment=True and HedgeFlow_API_KEY is set, HedgeFlow sentiment
    is blended in as 20% of the final score.
    """
    sentiment: Optional[SentimentResult] = None

    if request.include_sentiment:
        sentiment = await get_market_sentiment()

    result = compute_risk(
        metrics=request.pool_metrics,
        swap_amounts=request.swap_amounts or None,
        sentiment=sentiment,
        timestamp=int(time.time()),
    )

    global _latest_snapshot
    _latest_snapshot = result

    if _redis:
        try:
            await _redis.set(CACHE_KEY, result.model_dump_json(), ex=CACHE_TTL)
        except Exception:
            pass

    return result


@app.get("/risk/latest", response_model=Optional[RiskEngineOutput])
async def get_latest():
    """Return the most recently computed risk snapshot."""
    if _redis:
        try:
            cached = await _redis.get(CACHE_KEY)
            if cached:
                return RiskEngineOutput.model_validate_json(cached)
        except Exception:
            pass
    if _latest_snapshot is None:
        raise HTTPException(status_code=404, detail="No risk snapshot available yet")
    return _latest_snapshot


@app.get("/risk/demo", response_model=RiskEngineOutput)
async def demo_risk():
    """
    Demo endpoint — returns a sample DEFENSIVE risk score.
    Useful for testing the automation layer without real data.
    """
    from src.models import PoolMetrics, PricePoint
    import random

    # Simulate a volatile price series
    base = 3000.0
    prices = [
        PricePoint(price=base * (1 + random.gauss(0, 0.02)), timestamp=int(time.time()) - (60 * i))
        for i in range(50, 0, -1)
    ]

    metrics = PoolMetrics(
        pool_id="0xdemo",
        prices=prices,
        tvl_usd=5_000_000,
        volume_24h_usd=3_000_000,
        reserve_balance=500_000,
        total_liabilities=200_000,
    )

    return compute_risk(metrics=metrics, timestamp=int(time.time()))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("RISK_ENGINE_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
