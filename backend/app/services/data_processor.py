"""
Data processing service: aligns forecast and actual data.

Key responsibilities:
- Aggregate 30-min actuals to hourly averages (to match forecast resolution)
- For each delivery hour, select the latest forecast published before gate closure
- Produce aligned forecast-vs-actual records with error calculations
"""
import logging
from datetime import datetime, timezone
from collections import defaultdict
from typing import Optional

logger = logging.getLogger(__name__)

# UK day-ahead market gate closure is typically ~09:00-11:00 on D-1.
# We use 11:00 as the latest decision point.
GATE_CLOSURE_HOUR = 11


def aggregate_actuals_to_hourly(raw_actuals: list[dict]) -> dict[str, float]:
    """
    Convert 30-minute actuals to hourly averages.

    Groups by the hour of each startTime and averages the two half-hour values.

    Returns:
        Dict mapping ISO hour string → average generation (MW).
        e.g. {'2026-01-01T00:00:00Z': 15000.5, ...}
    """
    hourly_buckets: dict[str, list[float]] = defaultdict(list)

    for record in raw_actuals:
        st = datetime.fromisoformat(record["startTime"].replace("Z", "+00:00"))
        # Floor to the hour
        hour_key = st.replace(minute=0, second=0, microsecond=0)
        hourly_buckets[hour_key.isoformat()].append(record["generation"])

    return {
        k: sum(v) / len(v)
        for k, v in hourly_buckets.items()
    }


def select_latest_forecast_before_gate(
    forecasts: list[dict],
    delivery_date: str,
    gate_hour: int = GATE_CLOSURE_HOUR,
) -> dict[str, dict]:
    """
    For each forecast target hour on the delivery_date, find the latest
    forecast revision published before gate closure on D-1.

    In the UK day-ahead market, traders must submit bids by ~11:00 on D-1.
    So for a Jan 5 delivery, they use forecasts published before Jan 4 11:00 UTC.

    Returns:
        Dict mapping startTime ISO string → forecast record dict.
    """
    delivery_dt = datetime.fromisoformat(delivery_date)
    gate_closure = datetime(
        delivery_dt.year, delivery_dt.month, delivery_dt.day,
        gate_hour, 0, 0, tzinfo=timezone.utc
    ) - __import__("datetime").timedelta(days=1)

    # Filter forecasts targeting this delivery date
    relevant: dict[str, list[dict]] = defaultdict(list)
    for f in forecasts:
        st = datetime.fromisoformat(f["startTime"].replace("Z", "+00:00"))
        pt = datetime.fromisoformat(f["publishTime"].replace("Z", "+00:00"))

        # Only consider forecasts for hours within the delivery date
        if st.date() == delivery_dt.date() and pt <= gate_closure:
            relevant[f["startTime"]].append(f)

    # For each target hour, pick the latest published forecast
    result: dict[str, dict] = {}
    for start_time, revisions in relevant.items():
        latest = max(revisions, key=lambda x: x["publishTime"])
        result[start_time] = latest

    return result


def select_latest_forecast_per_hour(
    forecasts: list[dict],
    target_date_from: str = "2026-01-01",
    target_date_to: str = "2026-01-31",
) -> dict[str, dict]:
    """
    For each forecast target hour within the date range, find the latest
    forecast published before gate closure on D-1.

    This is the main alignment function used across the app.

    Returns:
        Dict mapping startTime ISO string → best forecast record.
    """
    from datetime import timedelta

    date_from = datetime.fromisoformat(target_date_from)
    date_to = datetime.fromisoformat(target_date_to)

    # Build an index: startTime → list of (publishTime, record)
    forecast_index: dict[str, list[dict]] = defaultdict(list)
    for f in forecasts:
        forecast_index[f["startTime"]].append(f)

    result: dict[str, dict] = {}
    current = date_from
    while current <= date_to:
        delivery_date_str = current.strftime("%Y-%m-%d")
        gate_closure = datetime(
            current.year, current.month, current.day,
            GATE_CLOSURE_HOUR, 0, 0, tzinfo=timezone.utc
        ) - timedelta(days=1)

        # For each hour of this delivery day
        for hour in range(24):
            target_dt = datetime(
                current.year, current.month, current.day,
                hour, 0, 0, tzinfo=timezone.utc
            )
            target_key = target_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

            candidates = forecast_index.get(target_key, [])
            # Filter to those published before gate closure
            valid = [
                c for c in candidates
                if datetime.fromisoformat(
                    c["publishTime"].replace("Z", "+00:00")
                ) <= gate_closure
            ]

            if valid:
                latest = max(
                    valid,
                    key=lambda x: x["publishTime"]
                )
                result[target_key] = latest

        current += timedelta(days=1)

    return result


def build_forecast_vs_actual(
    hourly_actuals: dict[str, float],
    aligned_forecasts: dict[str, dict],
) -> list[dict]:
    """
    Join hourly actuals and aligned forecasts to produce comparison records.

    Returns:
        Sorted list of dicts ready for the ForecastVsActual schema.
    """
    records = []

    for start_time_str, forecast in aligned_forecasts.items():
        # Try matching with and without timezone suffix
        actual_gen = hourly_actuals.get(start_time_str)
        if actual_gen is None:
            # Try with +00:00 suffix
            alt_key = start_time_str.replace("Z", "+00:00")
            actual_gen = hourly_actuals.get(alt_key)
        if actual_gen is None:
            continue

        forecast_gen = forecast["generation"]
        error = forecast_gen - actual_gen
        abs_error = abs(error)
        pct_error = (abs_error / actual_gen * 100) if actual_gen > 0 else None

        records.append({
            "start_time": start_time_str,
            "actual_generation": round(actual_gen, 1),
            "forecast_generation": round(forecast_gen, 1),
            "forecast_publish_time": forecast["publishTime"],
            "error": round(error, 1),
            "absolute_error": round(abs_error, 1),
            "percentage_error": round(pct_error, 2) if pct_error else None,
        })

    records.sort(key=lambda x: x["start_time"])
    return records


def get_forecast_revisions_for_date(
    forecasts: list[dict],
    delivery_date: str,
) -> list[dict]:
    """
    Get all forecast revisions for a specific delivery date,
    organized by target hour with all publish times.

    Returns:
        List of dicts with startTime, publishTime, generation, hours_before_delivery.
    """
    delivery_dt = datetime.fromisoformat(delivery_date)
    records = []

    for f in forecasts:
        st = datetime.fromisoformat(f["startTime"].replace("Z", "+00:00"))
        pt = datetime.fromisoformat(f["publishTime"].replace("Z", "+00:00"))

        if st.date() == delivery_dt.date():
            hours_before = (st - pt).total_seconds() / 3600
            records.append({
                "start_time": f["startTime"],
                "publish_time": f["publishTime"],
                "generation": f["generation"],
                "hours_before_delivery": round(hours_before, 1),
            })

    records.sort(key=lambda x: (x["start_time"], x["publish_time"]))
    return records
