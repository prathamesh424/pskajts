"""
Async HTTP client for the Elexon BMRS Insights API.

Fetches wind generation actuals (FUELHH) and forecasts (WINDFOR) for January 2026.
Includes an in-memory cache to avoid redundant API calls during a single server session.
"""
import httpx
import time
import logging
from datetime import datetime, timedelta
from typing import Any

from app.config import ELEXON_BASE_URL, CACHE_TTL

logger = logging.getLogger(__name__)


import hashlib
import json
import os
from pathlib import Path

# Disk cache directory
CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "data_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


class _Cache:
    """Two-tier cache: in-memory with file-backed persistence."""

    def __init__(self, ttl: int = CACHE_TTL):
        self._store: dict[str, tuple[float, Any]] = {}
        self._ttl = ttl

    def _disk_path(self, key: str) -> Path:
        key_hash = hashlib.md5(key.encode("utf-8")).hexdigest()
        return CACHE_DIR / f"{key_hash}.json"

    def get(self, key: str) -> Any | None:
        # 1. In-memory check
        if key in self._store:
            ts, value = self._store[key]
            if time.time() - ts < self._ttl:
                return value
            del self._store[key]

        # 2. Disk cache check
        disk_file = self._disk_path(key)
        if disk_file.exists():
            try:
                with open(disk_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._store[key] = (time.time(), data)
                    return data
            except Exception as e:
                logger.warning("Failed reading disk cache for %s: %s", key, e)

        return None

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.time(), value)
        disk_file = self._disk_path(key)
        try:
            with open(disk_file, "w", encoding="utf-8") as f:
                json.dump(value, f)
        except Exception as e:
            logger.warning("Failed writing disk cache for %s: %s", key, e)


_cache = _Cache()


async def _fetch_stream(endpoint: str, params: dict) -> list[dict]:
    """
    Fetch a streaming JSON array from an Elexon BMRS dataset endpoint.

    The /stream endpoints return the full result set as a JSON array
    (no pagination needed), but responses can be large for month-long ranges.
    """
    cache_key = f"{endpoint}:{sorted(params.items())}"
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.info("Cache hit for %s", cache_key)
        return cached

    url = f"{ELEXON_BASE_URL}/datasets/{endpoint}/stream"
    logger.info("Fetching %s with params %s", url, params)

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    _cache.set(cache_key, data)
    logger.info("Fetched %d records from %s", len(data), endpoint)
    return data


async def fetch_wind_actuals(
    date_from: str = "2026-01-01",
    date_to: str = "2026-01-31",
) -> list[dict]:
    """
    Fetch half-hourly wind generation actuals from FUELHH.

    Args:
        date_from: Start settlement date (inclusive), e.g. '2026-01-01'.
        date_to: End settlement date (inclusive), e.g. '2026-01-31'.

    Returns:
        List of dicts with keys: dataset, publishTime, startTime,
        settlementDate, settlementPeriod, fuelType, generation.
    """
    return await _fetch_stream("FUELHH", {
        "format": "json",
        "fuelType": "WIND",
        "settlementDateFrom": date_from,
        "settlementDateTo": date_to,
    })


async def fetch_wind_forecasts(
    date_from: str = "2026-01-01",
    date_to: str = "2026-01-31",
) -> list[dict]:
    """
    Fetch wind generation forecasts from WINDFOR.

    We extend the publish-time window slightly before the date range
    so we capture forecasts published on Dec 31 that cover Jan 1.

    Args:
        date_from: Start date (inclusive).
        date_to: End date (inclusive).

    Returns:
        List of dicts with keys: dataset, publishTime, startTime, generation.
    """
    # Forecasts for Jan 1 delivery are published on Dec 31,
    # so we start fetching from the day before.
    publish_from = (
        datetime.fromisoformat(date_from) - timedelta(days=2)
    ).strftime("%Y-%m-%dT00:00:00Z")
    publish_to = (
        datetime.fromisoformat(date_to) + timedelta(days=1)
    ).strftime("%Y-%m-%dT00:00:00Z")

    # WINDFOR can return a large dataset for a full month.
    # We fetch in weekly chunks to stay within response size limits.
    all_data: list[dict] = []
    current_from = datetime.fromisoformat(publish_from.replace("Z", "+00:00"))
    end = datetime.fromisoformat(publish_to.replace("Z", "+00:00"))

    while current_from < end:
        current_to = min(current_from + timedelta(days=4), end)
        chunk = await _fetch_stream("WINDFOR", {
            "format": "json",
            "publishDateTimeFrom": current_from.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "publishDateTimeTo": current_to.strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
        all_data.extend(chunk)
        current_from = current_to

    return all_data
