"""
Data seeding script: pre-fetches January 2026 data from Elexon BMRS API
and saves it to the local disk cache directory for instantaneous app load.
"""
import asyncio
import logging
import time

from app.services.elexon_client import fetch_wind_actuals, fetch_wind_forecasts
from app.services.data_processor import (
    aggregate_actuals_to_hourly,
    select_latest_forecast_per_hour,
    build_forecast_vs_actual,
)
from app.services.accuracy import compute_summary_metrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_data")


async def seed():
    start_time = time.time()
    logger.info("Starting January 2026 data pre-fetch from Elexon BMRS...")

    logger.info("1/2 Fetching FUELHH actuals (2026-01-01 to 2026-01-31)...")
    actuals = await fetch_wind_actuals("2026-01-01", "2026-01-31")
    logger.info("Fetched %d FUELHH actuals records.", len(actuals))

    logger.info("2/2 Fetching WINDFOR forecasts (2026-01-01 to 2026-01-31)...")
    forecasts = await fetch_wind_forecasts("2026-01-01", "2026-01-31")
    logger.info("Fetched %d WINDFOR forecast records.", len(forecasts))

    # Process alignment to check metrics
    hourly_actuals = aggregate_actuals_to_hourly(actuals)
    aligned_forecasts = select_latest_forecast_per_hour(forecasts, "2026-01-01", "2026-01-31")
    records = build_forecast_vs_actual(hourly_actuals, aligned_forecasts)
    metrics = compute_summary_metrics(records)

    elapsed = time.time() - start_time
    logger.info("Successfully seeded data in %.2f seconds!", elapsed)
    logger.info("Aligned comparison hours: %d", len(records))
    logger.info("January 2026 Key Metrics: MAE=%.1f MW, RMSE=%.1f MW, MAPE=%.2f%%, Bias=%.1f MW",
                metrics["mae"], metrics["rmse"], metrics["mape"], metrics["bias"])


if __name__ == "__main__":
    asyncio.run(seed())
