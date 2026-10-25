/**
 * WindSight API Client
 *
 * Centralized HTTP client for the backend API.
 * All endpoints return data for January 2026 by default.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min — Elexon API can be slow
});

/**
 * Fetch aligned forecast-vs-actual timeseries.
 */
export async function fetchForecastVsActual(dateFrom = '2026-01-01', dateTo = '2026-01-31') {
  const { data } = await api.get('/api/forecast-vs-actual', {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

/**
 * Fetch overall accuracy summary metrics.
 */
export async function fetchAccuracySummary(dateFrom = '2026-01-01', dateTo = '2026-01-31') {
  const { data } = await api.get('/api/accuracy/summary', {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

/**
 * Fetch daily accuracy breakdown.
 */
export async function fetchDailyAccuracy(dateFrom = '2026-01-01', dateTo = '2026-01-31') {
  const { data } = await api.get('/api/accuracy/by-day', {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

/**
 * Fetch hourly accuracy profile (0-23h).
 */
export async function fetchHourlyAccuracy(dateFrom = '2026-01-01', dateTo = '2026-01-31') {
  const { data } = await api.get('/api/accuracy/by-hour', {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

/**
 * Fetch error distribution histogram.
 */
export async function fetchErrorDistribution(dateFrom = '2026-01-01', dateTo = '2026-01-31', bins = 20) {
  const { data } = await api.get('/api/accuracy/distribution', {
    params: { date_from: dateFrom, date_to: dateTo, bins },
  });
  return data;
}

/**
 * Fetch forecast revisions for a specific delivery date.
 */
export async function fetchForecastRevisions(deliveryDate) {
  const { data } = await api.get(`/api/forecast-revisions/${deliveryDate}`);
  return data;
}

/**
 * Health check.
 */
export async function healthCheck() {
  const { data } = await api.get('/api/health');
  return data;
}
