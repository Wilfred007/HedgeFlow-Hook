"""
HedgeFlow HedgeFlow Integration

Calls xAI HedgeFlow API to analyse market sentiment.
Used as a 20% weight in the final risk score.
"""
from __future__ import annotations

import os
import json
import httpx
from typing import Optional

from .models import SentimentResult

HedgeFlow_API_URL = os.getenv("HedgeFlow_API_URL", "https://api.x.ai/v1")
HedgeFlow_API_KEY = os.getenv("HedgeFlow_API_KEY", "")
HedgeFlow_MODEL   = "llama-3.3-70b-versatile"

SENTIMENT_PROMPT = """
You are a crypto market analyst. Analyse the current market conditions for Ethereum and DeFi.

Classify the overall market stress level and return a JSON object with:
- "sentiment": one of "FEAR", "NEUTRAL", "GREED"
- "score": a number from 0 (extreme greed) to 100 (extreme fear)
- "reasoning": a brief 1-sentence explanation

Respond ONLY with valid JSON. Example:
{"sentiment": "FEAR", "score": 75, "reasoning": "ETH down 8% in 24h with high liquidations."}
"""


async def get_market_sentiment() -> Optional[SentimentResult]:
    """
    Query HedgeFlow for current market sentiment.
    Returns None if API key is not configured or request fails.
    """
    if not HedgeFlow_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{HedgeFlow_API_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {HedgeFlow_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": HedgeFlow_MODEL,
                    "messages": [
                        {"role": "user", "content": SENTIMENT_PROMPT}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 200,
                },
            )
            response.raise_for_status()
            data = response.json()

            content = data["choices"][0]["message"]["content"].strip()

            # Strip markdown code fences if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            parsed = json.loads(content)

            return SentimentResult(
                score=float(parsed.get("score", 50)),
                label=str(parsed.get("sentiment", "NEUTRAL")),
            )

    except Exception as e:
        print(f"[HedgeFlow] Sentiment fetch failed: {e}")
        return None
