# WindSight — UK Wind Generation Forecast Accuracy Dashboard

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-17%20Passed-brightgreen.svg?style=flat&logo=pytest)](https://docs.pytest.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Enterprise Renewable Intelligence for the UK Day-Ahead Power Market**  
> Developed for the Day-Ahead Power Procurement Team at a leading UK Energy Utility.  
> Sourced from the official **Elexon BMRS Insights API** for **January 2026**.  
>
> **Live Web App**: [https://frontend-alpha-six-56.vercel.app/](https://frontend-alpha-six-56.vercel.app/)  
> **Live API**: [https://pskajts.onrender.com](https://pskajts.onrender.com) | [Swagger Documentation](https://pskajts.onrender.com/docs)

---

## Table of Contents

1. [Business Context & Problem Statement](#-business-context--problem-statement)
2. [Key Quantitative Findings (January 2026)](#-key-quantitative-findings-january-2026)
3. [Architecture & System Design](#-architecture--system-design)
4. [Domain Methodology](#-domain-methodology)
5. [Feature Highlights](#-feature-highlights)
6. [Repository Structure & Directory Details](#-repository-structure--directory-details)
7. [Quick Start (Docker Compose)](#-quick-start-docker-compose)
8. [Local Development Setup](#-local-development-setup)
9. [Live Deployment & Links](#-live-deployment--links)
10. [API Documentation](#-api-documentation)
11. [Automated Testing](#-automated-testing)
12. [Client Pitch & Tech Review Presentations (Video Demo)](#-client-pitch--tech-review-presentations-video-demo)
13. [AI Tools Disclosure](#-ai-tools-disclosure)

---

## Business Context & Problem Statement

Energy utilities in Great Britain purchase wholesale power in day-ahead auctions (such as EPEX SPOT and Nord Pool) to fulfill forecasted consumer demand. Because wind constitutes a major and growing share of the UK generation stack, wind forecast errors expose utilities to severe financial risk in the **Balancing Mechanism**:

- **Systematic Over-Forecasting Risk**: If the day-ahead forecast overstates wind generation, the utility procures insufficient thermal/interconnect power. In real time, the system faces a shortfall, forcing the utility to buy imbalance energy at high **System Buy Prices (SBP)**.
- **Systematic Under-Forecasting Risk**: If wind is under-forecast, the utility buys excess power day-ahead and is forced to spill power at discounted **System Sell Prices (SSP)**.
- **Timing & Gate Closure**: Day-ahead auction order books close at **11:00 UTC on Day $D-1$**. Any forecast updates published after gate closure cannot be used for day-ahead auction bidding.

**WindSight** solves this problem by providing traders with:

1. Exact gate-closure aligned forecast comparisons (zero lookahead bias).
2. Rigorous quantitative accuracy metrics (MAE, RMSE, MAPE, Bias).
3. Diurnal / hourly risk profiles to safeguard peak demand hours.
4. An interactive **Forecast Explorer** showing revision convergence curves.

---

## Key Quantitative Findings (January 2026)

Evaluated across **744 hourly settlement intervals** (all 31 days of January 2026) using official Elexon BMRS data:

| Metric | Value | Trader Interpretation |
| --- | --- | --- |
| **Average Actual Wind Generation** | **11,580.7 MW** | Base wind outturn in January |
| **Average Day-Ahead Forecast** | **13,421.0 MW** | Expected generation at gate closure |
| **Mean Absolute Error (MAE)** | **2,122.8 MW** | Typical volume deviation per hour |
| **Root Mean Square Error (RMSE)** | **2,616.7 MW** | Volatility metric penalizing large forecast misses |
| **Mean Absolute Percentage Error (MAPE)** | **22.06%** | Overall forecast accuracy of **77.94%** |
| **Forecast Bias (Mean Error)** | **+1,840.3 MW** | **Systematic over-forecasting** by ~1.84 GW |
| **Max Hourly Error** | **6,833.0 MW** | Extreme tail risk event during weather transitions |

> **Key Procurement Takeaway**: The national wind forecast exhibits a persistent **+1.84 GW positive bias** in winter conditions. Applying an algorithmic bias-discount factor to day-ahead bids can save an estimated **£50,000–£100,000 per high-demand event** in avoided cashout penalties.

---

## Architecture & System Design

```mermaid
graph LR
    subgraph Client ["Frontend (Port 3000)"]
        React["React 19 SPA (Vite)"]
        Recharts["Recharts Visuals"]
        Nginx["Nginx Reverse Proxy"]
    end

    subgraph Backend ["Backend (Port 8000)"]
        FastAPI["FastAPI Engine"]
        Processor["Data Alignment Service"]
        Metrics["NumPy Metrics Engine"]
        Cache["Two-Tier Cache (Disk + RAM)"]
    end

    subgraph DataProvider ["Elexon BMRS API"]
        FUELHH["FUELHH (30-min Actuals)"]
        WINDFOR["WINDFOR (Hourly Forecasts)"]
    end

    React --> Nginx
    Nginx -->|/api/*| FastAPI
    FastAPI --> Processor
    FastAPI --> Metrics
    Processor --> Cache
    Cache <--> FUELHH
    Cache <--> WINDFOR
```

- **Frontend**: React 19, Vite, Recharts, Framer Motion, Lucide Icons.
- **Backend**: FastAPI, Pydantic, NumPy, HTTPX, Uvicorn.
- **Orchestration**: Docker, Docker Compose, Nginx (multi-stage production builds).
- **Storage/Cache**: Two-tier memory + persistent disk cache ensuring sub-150ms response times.

---

## Domain Methodology

### 1. 30-Minute to 1-Hour Aggregation

`FUELHH` outturn data is published in 30-minute settlement periods ($SP_1 \dots SP_{48}$). `WINDFOR` forecasts are published at hourly resolution ($H_1 \dots H_{24}$). WindSight aggregates actuals to hourly resolution using arithmetic mean:
$$\text{Actual}_{\text{hour}} = \frac{\text{Gen}_{HH1} + \text{Gen}_{HH2}}{2}$$

### 2. Gate Closure Temporal Alignment (No Lookahead Bias)

For a delivery hour $H$ on day $D$, the UK day-ahead market closes at **11:00 UTC on Day $D-1$**. WindSight filters WINDFOR forecasts to include only revisions where:
$$\text{publishTime} \le D-1 \text{ at } 11:00\text{ UTC}$$
The latest revision meeting this criterion is selected as the day-ahead benchmark.

### 3. Quantitative Error Formulas

- **Error**: $e_i = \text{Forecast}_i - \text{Actual}_i$ (Positive = Over-forecast, Negative = Under-forecast)
- **MAE**: $\frac{1}{N} \sum_{i=1}^N |e_i|$
- **RMSE**: $\sqrt{\frac{1}{N} \sum_{i=1}^N e_i^2}$
- **MAPE**: $\frac{100\%}{M} \sum_{\text{Actual}_i > 0} \frac{|e_i|}{\text{Actual}_i}$
- **Bias**: $\frac{1}{N} \sum_{i=1}^N e_i$

---

## Feature Highlights

### 1. Executive Dashboard (`/`)

- Hero KPI cards with animated counters and color-coded status pills.
- Interactive **Forecast vs Actual Timeseries** with brush zoom, custom tooltips showing MW deviations, and dual area fills.
- **Error Over Time** timeseries displaying over-procurement vs under-procurement risks.

### 2. Accuracy Analytics (`/accuracy`)

- Daily performance breakdown table with conditional formatting.
- **24-Hour Diurnal Accuracy Profile**: Shows when forecasts are least reliable (identifies error spikes during 16:00–19:00 peak hours).
- **Error Distribution Histogram**: Visualizes spread, skewness, and fat-tail risk.

### 3. Forecast Explorer (`/explorer`)

- Interactive date picker for any delivery day in January 2026.
- Overlays **all forecast revisions** (from 48h out to gate closure) alongside actual outturn.
- Demonstrates forecast convergence and model update frequency.

---

## Repository Structure & Directory Details

The repository follows a clean, decoupled microservices architecture separating analytical data ingestion from the institutional trading dashboard:

```
.
├── .env.example                     # Master environment variable template for Docker Compose
├── docker-compose.yml               # Multi-container orchestration (FastAPI backend + Nginx React frontend)
├── README.md                        # Project documentation, findings, and operating manual
├── docs/                            # Assessment deliverables and video presentation scripts
│   ├── CLIENT_PITCH.md              # 5-minute client pitch script (Part 1 video demo)
│   └── TECH_REVIEW.md               # 5-minute technical review script (Part 2 video demo)
├── backend/                         # High-performance Python analytical backend
│   ├── Dockerfile                   # Production Python 3.11 container definition
│   ├── Procfile                     # Heroku deployment process configuration
│   ├── render.yaml                  # Render cloud deployment blueprint
│   ├── requirements.txt             # Pinned backend dependencies (FastAPI, NumPy, HTTPX, Pydantic, etc.)
│   ├── main.py                      # Root convenience entry point (`python main.py`)
│   ├── seed_data.py                 # Cold-start data pre-fetch script for Elexon BMRS datasets
│   ├── data_cache/                  # Pre-seeded persistent JSON cache for instant zero-latency startup
│   ├── app/
│   │   ├── main.py                  # FastAPI application creation, CORS setup, and lifecycle handling
│   │   ├── config.py                # Environment configuration loading and default constants
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic data models for API responses and analytical entities
│   │   ├── services/
│   │   │   ├── elexon_client.py     # Async Elexon BMRS API client with two-tier (memory + disk) cache
│   │   │   ├── data_processor.py    # Temporal alignment, 30m-to-1h aggregation, and gate-closure filtering
│   │   │   └── accuracy.py          # Vectorized metrics engine (MAE, RMSE, MAPE, Bias, distributions)
│   │   └── routers/
│   │       ├── data.py              # Data endpoints (/api/actuals, /api/forecasts, /api/forecast-revisions)
│   │       └── accuracy.py          # Analytical endpoints (/api/accuracy/summary, /by-day, /by-hour, /distribution)
│   └── tests/
│       ├── test_accuracy.py         # Unit tests for mathematical accuracy calculations and edge cases
│       ├── test_data_processor.py   # Unit tests for 30m aggregation and gate closure logic
│       └── test_api.py              # Integration tests for HTTP contracts and endpoint status codes
└── frontend/                        # Reactive single-page institutional trading terminal
    ├── Dockerfile                   # Multi-stage production build (Node 20 build -> Nginx Alpine runtime)
    ├── nginx.conf                   # Nginx reverse proxy routing `/api/*` requests to backend
    ├── package.json                 # Frontend dependencies (React 19, Vite, Recharts, Lucide Icons)
    ├── vite.config.js               # Vite build configuration and local dev server proxy
    ├── vercel.json                  # Vercel deployment configuration for single-page routing
    ├── index.html                   # HTML5 root template with typography and meta tags
    └── src/
        ├── main.jsx                 # React root mounting
        ├── App.jsx                  # Main terminal shell, tab navigation, and live UTC clock
        ├── index.css                # Pure Carbon Dark minimalist design system and styling tokens
        ├── api.js                   # Axios HTTP client connecting to backend analytical endpoints
        └── pages/
            ├── Dashboard.jsx        # Tab 1: Executive KPI overview, timeseries chart with brush zoom
            ├── AccuracyAnalysis.jsx # Tab 2: Error metrics, 24h diurnal risk profile, error histogram
            └── ForecastExplorer.jsx # Tab 3: Interactive revision convergence studio for January 2026
```

---

## Quick Start (Docker Compose)

Launch the entire full-stack application with a single command:

```bash
docker-compose up --build
```

- **Frontend UI**: [http://localhost:3000](http://localhost:3000)
- **Backend API & Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

To shut down:

```bash
docker-compose down
```

---

## 💻 Local Development Setup

### Backend (Python 3.11+)

1. Navigate to backend directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Run the development server:

   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

4. (Optional) Run data pre-fetch seed script:

   ```bash
   python seed_data.py
   ```

### Frontend (Node 20+)

1. Navigate to frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run Vite development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173).

---

## Live Deployment & Links

| Deliverable | Target Platform | URL / Status |
| --- | --- | --- |
| **Frontend Application** | Vercel | [https://frontend-alpha-six-56.vercel.app/](https://frontend-alpha-six-56.vercel.app/) |
| **Backend API** | Render | [https://pskajts.onrender.com](https://pskajts.onrender.com) (Swagger Docs: [/docs](https://pskajts.onrender.com/docs)) |
| **Video Demo (10 min)** | YouTube (Unlisted) | [https://youtu.be/VuFdtX_izd4](https://youtu.be/VuFdtX_izd4) |
| **Public GitHub Repo** | GitHub | [https://github.com/prathamesh424/pskajts](https://github.com/prathamesh424/pskajts) |

### Deployment Guide

1. **Frontend (Vercel)**:
   - Import the GitHub repository on [Vercel](https://vercel.com).
   - Set **Root Directory** to `frontend`.
   - Set Environment Variable: `VITE_API_URL=<your-backend-api-url>`.
   - The included `frontend/vercel.json` handles Single Page Application client-side routing.
2. **Backend (Heroku / Render)**:
   - **Heroku**: Connect repository, deploy using the included `backend/Procfile`. Set config var `FRONTEND_URL=<your-frontend-url>`.
   - **Render**: Create Web Service from `backend/` using the included `backend/render.yaml` configuration.

---

## API Documentation

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/health` | `GET` | Health check probe |
| `/api/actuals` | `GET` | Aggregated hourly wind generation actuals |
| `/api/forecasts` | `GET` | Latest forecasts aligned before gate closure |
| `/api/forecast-vs-actual` | `GET` | Joined timeseries with computed error metrics |
| `/api/forecast-revisions/{delivery_date}` | `GET` | Multi-revision forecast history for a delivery day |
| `/api/accuracy/summary` | `GET` | Overall KPIs (MAE, RMSE, MAPE, Bias, Max Error) |
| `/api/accuracy/by-day` | `GET` | Daily breakdown of accuracy statistics |
| `/api/accuracy/by-hour` | `GET` | 24-hour diurnal accuracy profile |
| `/api/accuracy/distribution` | `GET` | Histogram frequency bins of forecast errors |

Interactive Swagger UI is available at `http://localhost:8000/docs`.

---

## Automated Testing

WindSight includes a 17-test suite covering analytical calculations, edge cases, data alignment, and HTTP contracts:

```bash
cd backend
python -m pytest tests/ -v
```

Output:

```
============================= test session starts =============================
collected 17 items

tests/test_accuracy.py::test_compute_summary_metrics PASSED              [  5%]
tests/test_accuracy.py::test_empty_summary_metrics PASSED                [ 11%]
tests/test_accuracy.py::test_compute_daily_accuracy PASSED               [ 17%]
tests/test_accuracy.py::test_compute_hourly_accuracy PASSED              [ 23%]
tests/test_accuracy.py::test_compute_error_distribution PASSED           [ 29%]
tests/test_api.py::test_health_check PASSED                              [ 35%]
tests/test_api.py::test_get_actuals PASSED                               [ 41%]
tests/test_api.py::test_get_forecasts PASSED                             [ 47%]
tests/test_api.py::test_get_forecast_vs_actual PASSED                    [ 52%]
tests/test_api.py::test_get_accuracy_summary PASSED                      [ 58%]
tests/test_api.py::test_get_accuracy_by_day PASSED                       [ 64%]
tests/test_api.py::test_get_accuracy_by_hour PASSED                      [ 70%]
tests/test_api.py::test_get_accuracy_distribution PASSED                 [ 76%]
tests/test_data_processor.py::test_aggregate_actuals_to_hourly PASSED    [ 82%]
tests/test_data_processor.py::test_select_latest_forecast_per_hour_gate_closure PASSED [ 88%]
tests/test_data_processor.py::test_build_forecast_vs_actual PASSED       [ 94%]
tests/test_data_processor.py::test_get_forecast_revisions_for_date PASSED [100%]

============================= 17 passed in 0.69s ==============================
```

---

## Client Pitch & Tech Review Presentations (Video Demo)

In accordance with Section 3.1 of the assessment guidelines, the video demo consists of two distinct 5-minute parts (maximum 10 minutes total):

1. **Part 1 — Client Presentation (Max 5 min)**:
   - Presenting the pilot portal and quantitative analysis directly to the customer (energy utility procurement desk).
   - Demonstrating live features, daily error profiles, and actionable financial ROI.
   - **Full Script & Walkthrough Guide**: **[Client Pitch Presentation Script (docs/CLIENT_PITCH.md)](docs/CLIENT_PITCH.md)**

2. **Part 2 — Technical Lead Review (Max 5 min)**:
   - Walkthrough of the software architecture, design principles, mathematical methodology, codebase, and key engineering practices.
   - Designed for internal review and clear knowledge transfer.
   - **Full Script & Architecture Guide**: **[Internal Technical Lead Review (docs/TECH_REVIEW.md)](docs/TECH_REVIEW.md)**

---

## AI Tools Disclosure

In compliance with assessment requirements, AI coding assistance was utilized as follows:

- **Tools Used**: Antigravity AI Assistant (Google DeepMind agentic coding system).
- **Usage**: Scaffolding project boilerplate, drafting test assertions, formatting documentation, and automating repetitive UI CSS utility setups.
- **Human Verification**: All domain logic (gate closure timing, resolution aggregation, Elexon BMRS API contract handling, financial error interpretations) was systematically designed, mathematically verified, and validated against actual outturn data.
