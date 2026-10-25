"""Pydantic models for API request/response schemas."""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# --- Raw data models (from Elexon) ---

class WindActual(BaseModel):
    """A single half-hourly wind generation actual from FUELHH."""
    start_time: datetime
    generation: float  # MW
    settlement_date: str
    settlement_period: int


class WindForecast(BaseModel):
    """A single wind generation forecast from WINDFOR."""
    start_time: datetime
    publish_time: datetime
    generation: float  # MW


# --- Processed / aligned models ---

class ForecastVsActual(BaseModel):
    """Aligned forecast and actual for a single hourly slot."""
    start_time: datetime
    actual_generation: float  # MW (hourly avg of 30-min actuals)
    forecast_generation: float  # MW
    forecast_publish_time: datetime
    error: float  # forecast - actual (positive = over-forecast)
    absolute_error: float
    percentage_error: Optional[float] = None  # |error| / actual * 100


# --- Accuracy summary models ---

class AccuracySummary(BaseModel):
    """Aggregate accuracy metrics over a period."""
    period_start: str
    period_end: str
    total_hours: int
    mae: float  # Mean Absolute Error (MW)
    rmse: float  # Root Mean Square Error (MW)
    mape: float  # Mean Absolute Percentage Error (%)
    bias: float  # Mean Error — positive = systematic over-forecasting (MW)
    max_error: float  # Worst-case absolute error (MW)
    avg_actual: float  # Average actual generation (MW)
    avg_forecast: float  # Average forecast generation (MW)


class DailyAccuracy(BaseModel):
    """Accuracy metrics for a single day."""
    date: str
    hours: int
    mae: float
    rmse: float
    mape: float
    bias: float
    max_error: float
    avg_actual: float
    avg_forecast: float


class HourlyAccuracy(BaseModel):
    """Average accuracy at a specific hour-of-day (0-23)."""
    hour: int
    mae: float
    rmse: float
    mape: float
    bias: float
    sample_count: int


class ErrorDistribution(BaseModel):
    """Histogram bin for error distribution."""
    bin_start: float
    bin_end: float
    count: int
    percentage: float


class ForecastRevision(BaseModel):
    """A single forecast revision for a target time."""
    publish_time: datetime
    generation: float
    hours_before_delivery: Optional[float] = None
