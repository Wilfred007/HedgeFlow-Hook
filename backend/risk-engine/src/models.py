"""HedgeFlow Risk Engine — Pydantic models"""
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class RiskMode(str, Enum):
    NORMAL    = "NORMAL"
    ELEVATED  = "ELEVATED"
    DEFENSIVE = "DEFENSIVE"
    CRISIS    = "CRISIS"


class RiskComponents(BaseModel):
    volatility:       float = Field(..., ge=0, le=100, description="Volatility score 0–100")
    liquidity_stress: float = Field(..., ge=0, le=100, description="Liquidity stress score 0–100")
    whale_activity:   float = Field(..., ge=0, le=100, description="Whale activity score 0–100")
    reserve_pressure: float = Field(..., ge=0, le=100, description="Reserve pressure score 0–100")


class SentimentResult(BaseModel):
    score: float = Field(..., ge=0, le=100)
    label: str   # FEAR | NEUTRAL | GREED


class RiskEngineOutput(BaseModel):
    risk_score:         float        = Field(..., ge=0, le=100)
    risk_mode:          RiskMode
    recommended_fee_bps: int
    components:         RiskComponents
    sentiment:          Optional[SentimentResult] = None
    timestamp:          int


class PricePoint(BaseModel):
    price:     float
    timestamp: int


class PoolMetrics(BaseModel):
    pool_id:         str
    prices:          list[PricePoint]
    tvl_usd:         float
    volume_24h_usd:  float
    reserve_balance: float
    total_liabilities: float


class RiskRequest(BaseModel):
    pool_metrics:      PoolMetrics
    swap_amounts:      list[float] = []
    include_sentiment: bool = False
