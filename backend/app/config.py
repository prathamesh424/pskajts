"""Application configuration and environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()

# Elexon BMRS API
ELEXON_BASE_URL = os.getenv(
    "ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
)

# Data scope
DATA_START_DATE = "2026-01-01"
DATA_END_DATE = "2026-01-31"

# Cache TTL in seconds (1 hour)
CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))

# CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
