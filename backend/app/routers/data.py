"""
Router for wind generation actuals and forecasts data endpoints.
"""
from fastapi import APIRouter, Query

from app.services.elexon_client import fetch_wind_actuals, fetch_wind_forecasts
from app.services.data_processor import (
    aggregate_actuals_to_hourly,
    select_latest_forecast_per_hour,
    build_forecast_vs_actual,
    get_forecast_revisions_for_date,
)
from app.config import DATA_START_DATE, DATA_END_DATE

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/actuals")
async def get_actuals(
    date_from: str = Query(DATA_START_DATE, description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(DATA_END_DATE, description="End date (YYYY-MM-DD)"),
):
    """
    Get hourly wind generation actuals for the given date range.

    Returns aggregated 30-min data as hourly averages.
    """
    raw = await fetch_wind_actuals(date_from, date_to)
    hourly = aggregate_actuals_to_hourly(raw)

    # Convert to sorted list
    records = [
        {"start_time": k, "generation": v}
        for k, v in sorted(hourly.items())
    ]
    return {"data": records, "count": len(records)}


@router.get("/forecasts")
async def get_forecasts(
    date_from: str = Query(DATA_START_DATE),
    date_to: str = Query(DATA_END_DATE),
):
    """
    Get the latest day-ahead wind forecasts (at gate closure) for each hour.

    Returns one forecast per delivery hour — the latest revision available
    before the day-ahead market gate closure.
    """
    raw = await fetch_wind_forecasts(date_from, date_to)
    aligned = select_latest_forecast_per_hour(raw, date_from, date_to)

    records = [
        {
            "start_time": k,
            "generation": v["generation"],
            "publish_time": v["publishTime"],
        }
        for k, v in sorted(aligned.items())
    ]
    return {"data": records, "count": len(records)}


@router.get("/forecast-vs-actual")
async def get_forecast_vs_actual(
    date_from: str = Query(DATA_START_DATE),
    date_to: str = Query(DATA_END_DATE),
):
    """
    Get aligned forecast and actual data for comparison charting.

    Each record includes the forecast, actual, and computed error.
    """
    raw_actuals = await fetch_wind_actuals(date_from, date_to)
    raw_forecasts = await fetch_wind_forecasts(date_from, date_to)

    hourly_actuals = aggregate_actuals_to_hourly(raw_actuals)
    aligned_forecasts = select_latest_forecast_per_hour(
        raw_forecasts, date_from, date_to
    )

    records = build_forecast_vs_actual(hourly_actuals, aligned_forecasts)
    return {"data": records, "count": len(records)}


@router.get("/forecast-revisions/{delivery_date}")
async def get_forecast_revisions(
    delivery_date: str,
):
    """
    Get all forecast revisions for a specific delivery date.

    Shows how the forecast evolved over time as new revisions were published.
    Useful for the Forecast Explorer feature.
    """
    raw_forecasts = await fetch_wind_forecasts(
        delivery_date, delivery_date
    )
    revisions = get_forecast_revisions_for_date(raw_forecasts, delivery_date)

    # Also fetch actuals for overlay
    raw_actuals = await fetch_wind_actuals(delivery_date, delivery_date)
    hourly_actuals = aggregate_actuals_to_hourly(raw_actuals)

    actuals_list = [
        {"start_time": k, "generation": v}
        for k, v in sorted(hourly_actuals.items())
    ]

    return {
        "delivery_date": delivery_date,
        "revisions": revisions,
        "actuals": actuals_list,
        "revision_count": len(set(r["publish_time"] for r in revisions)),
    }
