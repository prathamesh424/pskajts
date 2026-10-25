"""
Unit tests for forecast accuracy metrics computation.
"""
import pytest
from app.services.accuracy import (
    compute_summary_metrics,
    compute_daily_accuracy,
    compute_hourly_accuracy,
    compute_error_distribution,
)


@pytest.fixture
def sample_records():
    """Sample aligned records for testing accuracy functions."""
    return [
        {
            "start_time": "2026-01-01T00:00:00Z",
            "actual_generation": 10000.0,
            "forecast_generation": 11000.0,
            "forecast_publish_time": "2025-12-31T10:00:00Z",
            "error": 1000.0,
            "absolute_error": 1000.0,
            "percentage_error": 10.0,
        },
        {
            "start_time": "2026-01-01T01:00:00Z",
            "actual_generation": 12000.0,
            "forecast_generation": 11500.0,
            "forecast_publish_time": "2025-12-31T10:00:00Z",
            "error": -500.0,
            "absolute_error": 500.0,
            "percentage_error": 4.17,
        },
        {
            "start_time": "2026-01-02T00:00:00Z",
            "actual_generation": 8000.0,
            "forecast_generation": 8000.0,
            "forecast_publish_time": "2026-01-01T10:00:00Z",
            "error": 0.0,
            "absolute_error": 0.0,
            "percentage_error": 0.0,
        },
    ]


def test_compute_summary_metrics(sample_records):
    """Test overall MAE, RMSE, MAPE, Bias, Max Error."""
    summary = compute_summary_metrics(sample_records)

    assert summary["total_hours"] == 3
    # MAE = (1000 + 500 + 0) / 3 = 500.0
    assert summary["mae"] == 500.0
    # Bias = (1000 - 500 + 0) / 3 = 166.7
    assert summary["bias"] == pytest.approx(166.7, abs=0.1)
    # Max error = 1000.0
    assert summary["max_error"] == 1000.0
    # Avg actual = (10000 + 12000 + 8000) / 3 = 10000.0
    assert summary["avg_actual"] == 10000.0
    # Avg forecast = (11000 + 11500 + 8000) / 3 = 10166.7
    assert summary["avg_forecast"] == pytest.approx(10166.7, abs=0.1)


def test_empty_summary_metrics():
    """Test handling of empty records."""
    summary = compute_summary_metrics([])
    assert summary["total_hours"] == 0
    assert summary["mae"] == 0.0
    assert summary["rmse"] == 0.0
    assert summary["mape"] == 0.0
    assert summary["bias"] == 0.0


def test_compute_daily_accuracy(sample_records):
    """Test daily breakdown grouping."""
    daily = compute_daily_accuracy(sample_records)
    assert len(daily) == 2
    assert daily[0]["date"] == "2026-01-01"
    assert daily[0]["hours"] == 2
    # Day 1 MAE: (1000 + 500) / 2 = 750.0
    assert daily[0]["mae"] == 750.0

    assert daily[1]["date"] == "2026-01-02"
    assert daily[1]["hours"] == 1
    assert daily[1]["mae"] == 0.0


def test_compute_hourly_accuracy(sample_records):
    """Test hourly profile (returns 24 hours)."""
    hourly = compute_hourly_accuracy(sample_records)
    assert len(hourly) == 24
    # Hour 0 has two entries (from Jan 1 and Jan 2): errors 1000, 0 -> MAE 500
    assert hourly[0]["sample_count"] == 2
    assert hourly[0]["mae"] == 500.0
    # Hour 1 has one entry: error -500 -> MAE 500
    assert hourly[1]["sample_count"] == 1
    assert hourly[1]["mae"] == 500.0
    # Hour 2 has 0 entries
    assert hourly[2]["sample_count"] == 0
    assert hourly[2]["mae"] == 0.0


def test_compute_error_distribution(sample_records):
    """Test histogram binning."""
    dist = compute_error_distribution(sample_records, num_bins=10)
    assert len(dist) == 10
    total_counts = sum(b["count"] for b in dist)
    assert total_counts == 3
