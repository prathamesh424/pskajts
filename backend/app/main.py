"""
WindSight — UK Wind Generation Forecast Accuracy Dashboard

Main FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.routers import data, accuracy

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    logger.info("WindSight API starting up")
    yield
    logger.info("WindSight API shutting down")


app = FastAPI(
    title="WindSight API",
    description=(
        "Backend API for the UK Wind Generation Forecast Accuracy Dashboard. "
        "Provides wind generation actuals and forecasts from Elexon BMRS, "
        "with forecast accuracy analysis for day-ahead procurement decisions."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(data.router)
app.include_router(accuracy.router)


@app.get("/api/health", tags=["system"])
async def health_check():
    """Health check endpoint for monitoring and deployment probes."""
    return {"status": "healthy", "service": "windsight-api", "version": "1.0.0"}
