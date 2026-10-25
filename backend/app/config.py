"""Application configuration and environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend root if present
backend_root = Path(__file__).resolve().parent.parent
dotenv_path = backend_root / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    load_dotenv()

# Server settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Elexon BMRS API
ELEXON_BASE_URL = os.getenv(
    "ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
)

# Data scope (January 2026 default)
DATA_START_DATE = os.getenv("DATA_START_DATE", "2026-01-01")
DATA_END_DATE = os.getenv("DATA_END_DATE", "2026-01-31")

# Caching Configuration
CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))
ENABLE_DISK_CACHE = os.getenv("ENABLE_DISK_CACHE", "true").lower() in ("true", "1", "yes")
CACHE_DIR_PATH = os.getenv("CACHE_DIR", "")

# CORS - Frontend Origin
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
