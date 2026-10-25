"""
Unit tests for data processor service.
"""
from app.services.data_processor import (
    aggregate_actuals_to_hourly,
    select_latest_forecast_per_hour,
    build_forecast_vs_actual,
    get_forecast_revisions_for_date,
)


def test_aggregate_actuals_to_hourly():
    """Verify that two 30-min periods in an hour are averaged."""
    raw_actuals = [
        {"startTime": "2026-01-01T00:00:00Z", "generation": 10000.0},
        {"startTime": "2026-01-01T00:30:00Z", "generation": 12000.0},
        {"startTime": "2026-01-01T01:00:00Z", "generation": 14000.0},
        {"startTime": "2026-01-01T01:30:00Z", "generation": 16000.0},
    ]

    hourly = aggregate_actuals_to_hourly(raw_actuals)

    # Check that 00:00 average is (10000 + 12000) / 2 = 11000
    # Matching either ISO format
    matching_00 = [v for k, v in hourly.items() if "2026-01-01T00:00:00" in k]
    assert len(matching_00) == 1
    assert matching_00[0] == 11000.0

    matching_01 = [v for k, v in hourly.items() if "2026-01-01T01:00:00" in k]
    assert len(matching_01) == 1
    assert matching_01[0] == 15000.0


def test_select_latest_forecast_per_hour_gate_closure():
    """Verify that only forecasts published before D-1 11:00 UTC are selected, picking the latest."""
    target_date = "2026-01-02"
    # Target hour: 2026-01-02T12:00:00Z
    # Gate closure is 2026-01-01T11:00:00Z
    forecasts = [
        # Published well before gate closure
        {
            "startTime": "2026-01-02T12:00:00Z",
            "publishTime": "2026-01-01T06:00:00Z",
            "generation": 8000.0,
        },
        # Published right before gate closure (latest valid)
        {
            "startTime": "2026-01-02T12:00:00Z",
            "publishTime": "2026-01-01T10:30:00Z",
            "generation": 8500.0,
        },
        # Published after gate closure (invalid for day-ahead auction)
        {
            "startTime": "2026-01-02T12:00:00Z",
            "publishTime": "2026-01-01T14:00:00Z",
            "generation": 9000.0,
        },
    ]

    selected = select_latest_forecast_per_hour(forecasts, "2026-01-02", "2026-01-02")
    target_key = "2026-01-02T12:00:00Z"
    assert target_key in selected
    assert selected[target_key]["generation"] == 8500.0
    assert selected[target_key]["publishTime"] == "2026-01-01T10:30:00Z"


def test_build_forecast_vs_actual():
    """Verify joining of hourly actuals and aligned forecasts."""
    hourly_actuals = {
        "2026-01-01T10:00:00+00:00": 10000.0,
    }
    aligned_forecasts = {
        "2026-01-01T10:00:00Z": {
            "generation": 10500.0,
            "publishTime": "2025-12-31T09:00:00Z",
        }
    }

    records = build_forecast_vs_actual(hourly_actuals, aligned_forecasts)
    assert len(records) == 1
    r = records[0]
    assert r["actual_generation"] == 10000.0
    assert r["forecast_generation"] == 10500.0
    assert r["error"] == 500.0
    assert r["absolute_error"] == 500.0
    assert r["percentage_error"] == 5.0


def test_get_forecast_revisions_for_date():
    """Verify revision ordering and hours before delivery calculation."""
    forecasts = [
        {
            "startTime": "2026-01-05T12:00:00Z",
            "publishTime": "2026-01-04T08:00:00Z",
            "generation": 6000.0,
        },
        {
            "startTime": "2026-01-05T12:00:00Z",
            "publishTime": "2026-01-04T16:00:00Z",
            "generation": 6500.0,
        },
        # Other date
        {
            "startTime": "2026-01-06T12:00:00Z",
            "publishTime": "2026-01-05T08:00:00Z",
            "generation": 7000.0,
        },
    ]

    revs = get_forecast_revisions_for_date(forecasts, "2026-01-05")
    assert len(revs) == 2
    assert revs[0]["publish_time"] == "2026-01-04T08:00:00Z"
    assert revs[0]["hours_before_delivery"] == 28.0
    assert revs[1]["publish_time"] == "2026-01-04T16:00:00Z"
    assert revs[1]["hours_before_delivery"] == 20.0
