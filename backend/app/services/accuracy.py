"""
Forecast accuracy metrics computation.

Calculates MAE, RMSE, MAPE, Bias, and Max Error from aligned
forecast-vs-actual records. Provides aggregate, daily, hourly,
and distributional breakdowns.
"""
import math
import logging
from datetime import datetime
from collections import defaultdict

import numpy as np

logger = logging.getLogger(__name__)


def compute_summary_metrics(records: list[dict]) -> dict:
    """
    Compute aggregate accuracy metrics across all records.

    Args:
        records: List of forecast-vs-actual dicts (from build_forecast_vs_actual).

    Returns:
        Dict matching AccuracySummary fields.
    """
    if not records:
        return _empty_summary()

    errors = np.array([r["error"] for r in records])
    abs_errors = np.array([r["absolute_error"] for r in records])
    actuals = np.array([r["actual_generation"] for r in records])
    forecasts = np.array([r["forecast_generation"] for r in records])

    # MAPE: only where actual > 0 to avoid division by zero
    valid_mask = actuals > 0
    if valid_mask.any():
        mape = float(np.mean(abs_errors[valid_mask] / actuals[valid_mask]) * 100)
    else:
        mape = 0.0

    times = sorted([r["start_time"] for r in records])

    return {
        "period_start": times[0][:10] if times else "",
        "period_end": times[-1][:10] if times else "",
        "total_hours": len(records),
        "mae": round(float(np.mean(abs_errors)), 1),
        "rmse": round(float(np.sqrt(np.mean(errors ** 2))), 1),
        "mape": round(mape, 2),
        "bias": round(float(np.mean(errors)), 1),
        "max_error": round(float(np.max(abs_errors)), 1),
        "avg_actual": round(float(np.mean(actuals)), 1),
        "avg_forecast": round(float(np.mean(forecasts)), 1),
    }


def compute_daily_accuracy(records: list[dict]) -> list[dict]:
    """
    Break down accuracy metrics by calendar day.

    Returns:
        List of dicts matching DailyAccuracy fields, sorted by date.
    """
    by_day: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        date_str = r["start_time"][:10]
        by_day[date_str].append(r)

    results = []
    for date_str in sorted(by_day.keys()):
        day_records = by_day[date_str]
        metrics = compute_summary_metrics(day_records)
        results.append({
            "date": date_str,
            "hours": len(day_records),
            "mae": metrics["mae"],
            "rmse": metrics["rmse"],
            "mape": metrics["mape"],
            "bias": metrics["bias"],
            "max_error": metrics["max_error"],
            "avg_actual": metrics["avg_actual"],
            "avg_forecast": metrics["avg_forecast"],
        })

    return results


def compute_hourly_accuracy(records: list[dict]) -> list[dict]:
    """
    Average accuracy metrics by hour-of-day (0-23).

    Useful for identifying times when forecasts are systematically better or worse.

    Returns:
        List of 24 dicts matching HourlyAccuracy fields.
    """
    by_hour: dict[int, list[dict]] = defaultdict(list)
    for r in records:
        dt = datetime.fromisoformat(r["start_time"].replace("Z", "+00:00"))
        by_hour[dt.hour].append(r)

    results = []
    for hour in range(24):
        hour_records = by_hour.get(hour, [])
        if not hour_records:
            results.append({
                "hour": hour,
                "mae": 0.0,
                "rmse": 0.0,
                "mape": 0.0,
                "bias": 0.0,
                "sample_count": 0,
            })
            continue

        errors = np.array([r["error"] for r in hour_records])
        abs_errors = np.array([r["absolute_error"] for r in hour_records])
        actuals = np.array([r["actual_generation"] for r in hour_records])

        valid_mask = actuals > 0
        mape = float(np.mean(abs_errors[valid_mask] / actuals[valid_mask]) * 100) \
            if valid_mask.any() else 0.0

        results.append({
            "hour": hour,
            "mae": round(float(np.mean(abs_errors)), 1),
            "rmse": round(float(np.sqrt(np.mean(errors ** 2))), 1),
            "mape": round(mape, 2),
            "bias": round(float(np.mean(errors)), 1),
            "sample_count": len(hour_records),
        })

    return results


def compute_error_distribution(
    records: list[dict],
    num_bins: int = 20,
) -> list[dict]:
    """
    Compute a histogram of forecast errors.

    Returns:
        List of dicts matching ErrorDistribution fields.
    """
    if not records:
        return []

    errors = [r["error"] for r in records]
    min_err = min(errors)
    max_err = max(errors)

    # Add small padding so edge values fit into bins
    padding = (max_err - min_err) * 0.01 if max_err != min_err else 1.0
    bin_edges = np.linspace(min_err - padding, max_err + padding, num_bins + 1)

    counts, _ = np.histogram(errors, bins=bin_edges)
    total = len(errors)

    results = []
    for i in range(num_bins):
        results.append({
            "bin_start": round(float(bin_edges[i]), 1),
            "bin_end": round(float(bin_edges[i + 1]), 1),
            "count": int(counts[i]),
            "percentage": round(int(counts[i]) / total * 100, 1),
        })

    return results


def _empty_summary() -> dict:
    """Return zeroed-out summary for edge cases."""
    return {
        "period_start": "",
        "period_end": "",
        "total_hours": 0,
        "mae": 0.0,
        "rmse": 0.0,
        "mape": 0.0,
        "bias": 0.0,
        "max_error": 0.0,
        "avg_actual": 0.0,
        "avg_forecast": 0.0,
    }
