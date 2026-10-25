"""
Integration tests for FastAPI endpoints.
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

MOCK_RAW_ACTUALS = [
    {
        "dataset": "FUELHH",
        "publishTime": "2026-01-01T00:45:00Z",
        "startTime": "2026-01-01T00:00:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 1,
        "fuelType": "WIND",
        "generation": 10000.0,
    },
    {
        "dataset": "FUELHH",
        "publishTime": "2026-01-01T01:15:00Z",
        "startTime": "2026-01-01T00:30:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 2,
        "fuelType": "WIND",
        "generation": 12000.0,
    },
]

MOCK_RAW_FORECASTS = [
    {
        "dataset": "WINDFOR",
        "publishTime": "2025-12-31T09:00:00Z",
        "startTime": "2026-01-01T00:00:00Z",
        "generation": 11500.0,
    },
]


def test_health_check():
    """Verify that health check endpoint returns 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "windsight-api"


@patch("app.routers.data.fetch_wind_actuals")
def test_get_actuals(mock_fetch):
    """Test /api/actuals returns hourly aggregated records."""
    mock_fetch.return_value = MOCK_RAW_ACTUALS

    response = client.get("/api/actuals?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["count"] == 1
    assert data["data"][0]["generation"] == 11000.0


@patch("app.routers.data.fetch_wind_forecasts")
def test_get_forecasts(mock_fetch):
    """Test /api/forecasts returns forecasts aligned before gate closure."""
    mock_fetch.return_value = MOCK_RAW_FORECASTS

    response = client.get("/api/forecasts?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["count"] == 1
    assert data["data"][0]["generation"] == 11500.0


@patch("app.routers.data.fetch_wind_forecasts")
@patch("app.routers.data.fetch_wind_actuals")
def test_get_forecast_vs_actual(mock_actuals, mock_forecasts):
    """Test /api/forecast-vs-actual returns merged records with error calculations."""
    mock_actuals.return_value = MOCK_RAW_ACTUALS
    mock_forecasts.return_value = MOCK_RAW_FORECASTS

    response = client.get("/api/forecast-vs-actual?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert data["count"] == 1
    record = data["data"][0]
    assert record["actual_generation"] == 11000.0
    assert record["forecast_generation"] == 11500.0
    assert record["error"] == 500.0
    assert record["absolute_error"] == 500.0


@patch("app.routers.accuracy.fetch_wind_forecasts")
@patch("app.routers.accuracy.fetch_wind_actuals")
def test_get_accuracy_summary(mock_actuals, mock_forecasts):
    """Test /api/accuracy/summary returns computed KPIs."""
    mock_actuals.return_value = MOCK_RAW_ACTUALS
    mock_forecasts.return_value = MOCK_RAW_FORECASTS

    response = client.get("/api/accuracy/summary?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["total_hours"] == 1
    assert data["mae"] == 500.0
    assert data["bias"] == 500.0


@patch("app.routers.accuracy.fetch_wind_forecasts")
@patch("app.routers.accuracy.fetch_wind_actuals")
def test_get_accuracy_by_day(mock_actuals, mock_forecasts):
    """Test /api/accuracy/by-day returns daily breakdown."""
    mock_actuals.return_value = MOCK_RAW_ACTUALS
    mock_forecasts.return_value = MOCK_RAW_FORECASTS

    response = client.get("/api/accuracy/by-day?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["date"] == "2026-01-01"


@patch("app.routers.accuracy.fetch_wind_forecasts")
@patch("app.routers.accuracy.fetch_wind_actuals")
def test_get_accuracy_by_hour(mock_actuals, mock_forecasts):
    """Test /api/accuracy/by-hour returns 24 hours."""
    mock_actuals.return_value = MOCK_RAW_ACTUALS
    mock_forecasts.return_value = MOCK_RAW_FORECASTS

    response = client.get("/api/accuracy/by-hour?date_from=2026-01-01&date_to=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 24


@patch("app.routers.accuracy.fetch_wind_forecasts")
@patch("app.routers.accuracy.fetch_wind_actuals")
def test_get_accuracy_distribution(mock_actuals, mock_forecasts):
    """Test /api/accuracy/distribution returns bins."""
    mock_actuals.return_value = MOCK_RAW_ACTUALS
    mock_forecasts.return_value = MOCK_RAW_FORECASTS

    response = client.get("/api/accuracy/distribution?date_from=2026-01-01&date_to=2026-01-01&bins=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 10
