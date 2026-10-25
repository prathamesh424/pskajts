"""
Router for forecast accuracy analysis endpoints.
"""
from fastapi import APIRouter, Query

from app.services.elexon_client import fetch_wind_actuals, fetch_wind_forecasts
from app.services.data_processor import (
    aggregate_actuals_to_hourly,
    select_latest_forecast_per_hour,
    build_forecast_vs_actual,
)
from app.services.accuracy import (
    compute_summary_metrics,
    compute_daily_accuracy,
    compute_hourly_accuracy,
    compute_error_distribution,
)
from app.config import DATA_START_DATE, DATA_END_DATE

router = APIRouter(prefix="/api/accuracy", tags=["accuracy"])


async def _get_aligned_records(date_from: str, date_to: str) -> list[dict]:
    """Helper: fetch, align, and build forecast-vs-actual records."""
    raw_actuals = await fetch_wind_actuals(date_from, date_to)
    raw_forecasts = await fetch_wind_forecasts(date_from, date_to)

    hourly_actuals = aggregate_actuals_to_hourly(raw_actuals)
    aligned_forecasts = select_latest_forecast_per_hour(
        raw_forecasts, date_from, date_to
    )

    return build_forecast_vs_actual(hourly_actuals, aligned_forecasts)


@router.get("/summary")
async def get_accuracy_summary(
    date_from: str = Query(DATA_START_DATE),
    date_to: str = Query(DATA_END_DATE),
):
    """
    Overall accuracy KPIs for the specified period.

    Returns MAE, RMSE, MAPE, Bias, and Max Error.
    """
    records = await _get_aligned_records(date_from, date_to)
    return compute_summary_metrics(records)


@router.get("/by-day")
async def get_daily_accuracy(
    date_from: str = Query(DATA_START_DATE),
    date_to: str = Query(DATA_END_DATE),
):
    """
    Daily breakdown of accuracy metrics.

    Returns one record per calendar day with MAE, RMSE, MAPE, etc.
    """
    records = await _get_aligned_records(date_from, date_to)
    return {"data": compute_daily_accuracy(records)}


@router.get("/by-hour")
async def get_hourly_accuracy(
    date_from: str = Query(DATA_START_DATE),
    date_to: str = Query(DATA_END_DATE),
):
    """
    Accuracy profile by hour-of-day (0-23).

    Reveals systematic patterns — e.g., forecasts tend to be less
    accurate during certain hours.
    """
    records = await _get_aligned_records(date_from, date_to)
    return {"data": compute_hourly_accuracy(records)}


@router.get("/distribution")
async def get_error_distribution(
    date_from: str = Query(DATA_START_DATE),
    date_to: str = Query(DATA_END_DATE),
    bins: int = Query(20, ge=5, le=50),
):
    """
    Distribution of forecast errors as a histogram.

    Useful for understanding the spread and skewness of forecast errors.
    """
    records = await _get_aligned_records(date_from, date_to)
    return {"data": compute_error_distribution(records, bins)}
