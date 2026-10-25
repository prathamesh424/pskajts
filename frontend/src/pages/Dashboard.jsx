import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine,
} from 'recharts';
import { Filter } from 'lucide-react';
import { fetchForecastVsActual, fetchAccuracySummary } from '../api';

const DATE_PRESETS = [
  { id: 'all', label: 'FULL MONTH (JAN 1-31)', start: 0, end: 744 },
  { id: 'w1', label: 'WEEK 1 (JAN 1-7)', start: 0, end: 168 },
  { id: 'w2', label: 'WEEK 2 (JAN 8-14)', start: 168, end: 336 },
  { id: 'storm', label: 'STORM EVENT (JAN 22-26)', start: 504, end: 624 },
  { id: 'w4', label: 'WEEK 4 (JAN 27-31)', start: 624, end: 744 },
];

/**
 * Timezone-agnostic UTC formatter.
 */
function getUtcTickMeta(isoStr) {
  if (!isoStr) return { full: '', dateLabel: '', dayHour: '' };
  const clean = isoStr.replace('+00:00', 'Z');
  const d = new Date(clean);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return {
    full: `${m} ${day}, ${hour}:00`,
    dateLabel: `${m} ${day}`,
    dayHour: `${day} ${m} ${hour}:00`,
  };
}

export default function Dashboard() {
  const [rawData, setRawData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePreset, setActivePreset] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [tsRes, sumRes] = await Promise.all([
        fetchForecastVsActual(),
        fetchAccuracySummary(),
      ]);

      const formatted = tsRes.data.map((d) => {
        const meta = getUtcTickMeta(d.start_time);
        return {
          ...d,
          time: meta.full,
          dateLabel: meta.dateLabel,
          displayTick: meta.dayHour,
        };
      });

      setRawData(formatted);
      setSummary(sumRes);
    } catch (err) {
      setError(err.message || 'Failed connecting to backend');
    } finally {
      setLoading(false);
    }
  }

  const displayData = useMemo(() => {
    if (!rawData.length) return [];
    const preset = DATE_PRESETS.find(p => p.id === activePreset);
    if (!preset || preset.id === 'all') return rawData;
    return rawData.slice(preset.start, preset.end);
  }, [rawData, activePreset]);

  // Clean, non-overlapping tick interval based on active view window
  const xAxisInterval = useMemo(() => {
    const len = displayData.length;
    if (len > 500) return 71; // ~10 clean ticks across 744 hours (every 3 days)
    if (len > 250) return 47; // ~7 ticks across 336 hours (every 2 days)
    if (len > 100) return 23; // ~7 ticks across 168 hours (every 24 hours)
    if (len > 40) return 11;  // ~8-10 ticks across 96-120 hours (every 12 hours)
    return 3;                 // every 4 hours for small windows
  }, [displayData.length]);

  const formatXAxisTick = (val) => {
    if (!val) return '';
    // If viewing month-long window, show concise "Jan 1", "Jan 4", etc.
    if (displayData.length > 250) {
      const parts = val.split(' ');
      if (parts.length >= 2) return `${parts[1]} ${parts[0]}`;
    }
    return val;
  };

  const stats = useMemo(() => {
    if (!displayData.length) return null;
    const actuals = displayData.map(d => d.actual_generation);
    const forecasts = displayData.map(d => d.forecast_generation);
    const errors = displayData.map(d => d.error);
    const absErrors = displayData.map(d => d.absolute_error);

    const avgActual = Math.round(actuals.reduce((a, b) => a + b, 0) / actuals.length);
    const avgForecast = Math.round(forecasts.reduce((a, b) => a + b, 0) / forecasts.length);
    const avgMae = Math.round(absErrors.reduce((a, b) => a + b, 0) / absErrors.length);
    const avgBias = Math.round(errors.reduce((a, b) => a + b, 0) / errors.length);

    return { avgActual, avgForecast, avgMae, avgBias, count: displayData.length };
  }, [displayData]);

  if (loading) return <DashboardSkeleton />;
  if (error) return (
    <div className="clean-panel" style={{ padding: 20, color: 'var(--color-danger)' }}>
      Error: {error}
    </div>
  );

  return (
    <div>
      {/* 4 Clean, Spacious Metric Cards */}
      <div className="kpi-grid-4">
        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">ACTUAL OUTTURN</span>
            <span className="kpi-pill">ELEXON FUELHH</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number">{stats?.avgActual?.toLocaleString()}</span>
            <span className="kpi-val-unit">MW avg</span>
          </div>
          <div className="kpi-box-footer">
            <span>Aggregated 30m actuals</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">DAY-AHEAD FORECAST</span>
            <span className="kpi-pill">11:00 D-1 GATE</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number">{stats?.avgForecast?.toLocaleString()}</span>
            <span className="kpi-val-unit">MW avg</span>
          </div>
          <div className="kpi-box-footer">
            <span>Trading decision benchmark</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">MEAN ABS. ERROR</span>
            <span className="kpi-pill">MAE</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number">{stats?.avgMae?.toLocaleString()}</span>
            <span className="kpi-val-unit">MW</span>
          </div>
          <div className="kpi-box-footer">
            <span>RMSE: {summary?.rmse?.toLocaleString()} MW</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">SYSTEMATIC BIAS</span>
            <span className="kpi-pill" style={{ color: 'var(--color-warning)' }}>OVER-FORECAST</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number" style={{ color: 'var(--color-warning)' }}>
              +{stats?.avgBias?.toLocaleString()}
            </span>
            <span className="kpi-val-unit">MW</span>
          </div>
          <div className="kpi-box-footer">
            <span>Accuracy: {summary ? (100 - summary.mape).toFixed(1) : '77.9'}%</span>
          </div>
        </div>
      </div>

      {/* Uncluttered Filter Bar */}
      <div className="control-toolbar">
        <div className="toolbar-left">
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>VIEW RANGE:</span>
          <div className="filter-btn-group">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                className={`filter-btn ${activePreset === p.id ? 'active' : ''}`}
                onClick={() => setActivePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-right font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          HOURS: <strong style={{ color: 'var(--text-white)' }}>{stats?.count}</strong>
        </div>
      </div>

      {/* Main Timeseries Chart */}
      <div className="clean-panel">
        <div className="clean-panel-header">
          <div>
            <span className="panel-heading">Wind Generation: Day-Ahead Forecast vs Outturn Actual</span>
            <span className="panel-meta font-mono">| January 2026</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 3, background: 'var(--color-actual)' }} />
              <span style={{ color: 'var(--color-actual)' }}>Actual (MW)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 2, background: 'var(--color-forecast)', borderTop: '2px dashed #38bdf8' }} />
              <span style={{ color: 'var(--color-forecast)' }}>Day-Ahead Forecast (MW)</span>
            </div>
          </div>
        </div>

        <div className="clean-panel-body">
          <div style={{ width: '100%', height: 390 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="actualFillNeutral" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="displayTick"
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  interval={xAxisInterval}
                  tickFormatter={formatXAxisTick}
                  dy={4}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomChartTooltip />} />

                <Area
                  type="monotone"
                  dataKey="actual_generation"
                  name="Actual Outturn"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#actualFillNeutral)"
                  dot={false}
                  isAnimationActive={false}
                />

                <Line
                  type="monotone"
                  dataKey="forecast_generation"
                  name="Forecast"
                  stroke="#38bdf8"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />

                <Brush
                  dataKey="displayTick"
                  height={20}
                  stroke="var(--border-hover)"
                  fill="var(--bg-panel)"
                  tickFormatter={() => ''}
                  y={352}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Chart: Forecast Error */}
      <div className="clean-panel">
        <div className="clean-panel-header">
          <div>
            <span className="panel-heading">Forecast Error Spread (Forecast − Actual)</span>
            <span className="panel-meta font-mono">| Positive = Over-forecast / Shortfall Exposure</span>
          </div>
        </div>

        <div className="clean-panel-body">
          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 5, right: 10, left: 0, bottom: 15 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="displayTick"
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  interval={xAxisInterval}
                  tickFormatter={formatXAxisTick}
                  dy={4}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                />
                <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1} />
                <Tooltip content={<CustomErrorTooltip />} />
                <Area
                  type="monotone"
                  dataKey="error"
                  name="Error"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  fill="rgba(245, 158, 11, 0.08)"
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const actual = payload.find(p => p.dataKey === 'actual_generation')?.value;
  const forecast = payload.find(p => p.dataKey === 'forecast_generation')?.value;
  const delta = forecast != null && actual != null ? forecast - actual : 0;

  return (
    <div className="clean-tooltip">
      <div className="tooltip-title">{d?.time || d?.displayTick} UTC</div>
      <div className="tooltip-line">
        <span style={{ color: 'var(--color-actual)' }}>Actual Outturn:</span>
        <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{actual?.toLocaleString()} MW</span>
      </div>
      <div className="tooltip-line">
        <span style={{ color: 'var(--color-forecast)' }}>Day-Ahead Forecast:</span>
        <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{forecast?.toLocaleString()} MW</span>
      </div>
      <div className="tooltip-line" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 4, marginTop: 4 }}>
        <span style={{ color: delta > 0 ? 'var(--color-warning)' : 'var(--color-actual)' }}>
          {delta > 0 ? 'Over-forecast:' : 'Under-forecast:'}
        </span>
        <span style={{ fontWeight: 600, color: delta > 0 ? 'var(--color-warning)' : 'var(--color-actual)' }}>
          {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()} MW
        </span>
      </div>
    </div>
  );
}

function CustomErrorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const err = payload[0]?.value;
  if (err == null) return null;

  return (
    <div className="clean-tooltip">
      <div className="tooltip-title">{d?.time || d?.displayTick} UTC</div>
      <div className="tooltip-line">
        <span>Forecast Error:</span>
        <span style={{ fontWeight: 600, color: err > 0 ? 'var(--color-warning)' : 'var(--color-actual)' }}>
          {err > 0 ? `+${err.toLocaleString()}` : err.toLocaleString()} MW
        </span>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="kpi-grid-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="clean-skeleton" style={{ height: 100 }} />
        ))}
      </div>
      <div className="clean-skeleton" style={{ height: 420 }} />
    </div>
  );
}
