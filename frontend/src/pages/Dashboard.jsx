import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine,
} from 'recharts';
import { AlertCircle, Filter, Download } from 'lucide-react';
import { fetchForecastVsActual, fetchAccuracySummary } from '../api';
import { format, parseISO } from 'date-fns';

const DATE_PRESETS = [
  { id: 'all', label: 'FULL MONTH (JAN 1-31)', start: 0, end: 744 },
  { id: 'w1', label: 'W1: JAN 1-7', start: 0, end: 168 },
  { id: 'w2', label: 'W2: JAN 8-14', start: 168, end: 336 },
  { id: 'storm', label: 'STORM EVENT: JAN 22-26', start: 504, end: 624 },
  { id: 'w4', label: 'W4: JAN 27-31', start: 624, end: 744 },
];

export default function Dashboard() {
  const [rawData, setRawData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePreset, setActivePreset] = useState('all');
  const [showErrorArea, setShowErrorArea] = useState(true);

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

      const formatted = tsRes.data.map((d) => ({
        ...d,
        time: format(parseISO(d.start_time), 'MMM d HH:mm'),
        shortTime: format(parseISO(d.start_time), 'd/M HH:mm'),
        date: format(parseISO(d.start_time), 'MMM d'),
        hour: format(parseISO(d.start_time), 'HH:mm'),
      }));

      setRawData(formatted);
      setSummary(sumRes);
    } catch (err) {
      setError(err.message || 'Failed connecting to backend API');
    } finally {
      setLoading(false);
    }
  }

  // Filtered view based on quick preset
  const displayData = useMemo(() => {
    if (!rawData.length) return [];
    const preset = DATE_PRESETS.find(p => p.id === activePreset);
    if (!preset || preset.id === 'all') return rawData;
    return rawData.slice(preset.start, preset.end);
  }, [rawData, activePreset]);

  // Compute stats on active view
  const activeStats = useMemo(() => {
    if (!displayData.length) return null;
    const actuals = displayData.map(d => d.actual_generation);
    const forecasts = displayData.map(d => d.forecast_generation);
    const errors = displayData.map(d => d.error);
    const absErrors = displayData.map(d => d.absolute_error);

    const avgActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;
    const avgForecast = forecasts.reduce((a, b) => a + b, 0) / forecasts.length;
    const avgMae = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;
    const avgBias = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxGen = Math.max(...actuals);
    const minGen = Math.min(...actuals);

    const overCount = errors.filter(e => e > 0).length;
    const overPct = (overCount / errors.length * 100).toFixed(1);

    return {
      avgActual: Math.round(avgActual),
      avgForecast: Math.round(avgForecast),
      avgMae: Math.round(avgMae),
      avgBias: Math.round(avgBias),
      maxGen: Math.round(maxGen),
      minGen: Math.round(minGen),
      overPct,
      count: displayData.length,
    };
  }, [displayData]);

  if (loading) return <TerminalLoadingSkeleton />;
  if (error) return (
    <div className="terminal-panel" style={{ borderColor: 'var(--color-danger)', padding: 16 }}>
      <div style={{ color: 'var(--color-danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertCircle size={16} /> Backend Feed Disconnected: {error}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        Verify that `uvicorn app.main:app` is active on port 8000.
      </p>
    </div>
  );

  return (
    <div>
      {/* Trading Advisory Callout */}
      <div className="terminal-callout">
        <div>
          <span className="callout-bold">UK DAY-AHEAD PROCUREMENT INTELLIGENCE:</span>{' '}
          Evaluated 744 hourly settlement periods for January 2026. Systematic positive bias of{' '}
          <strong style={{ color: 'var(--color-bias-over)' }}>+{activeStats?.avgBias?.toLocaleString()} MW</strong> detected.
          Wind models over-predicted generation in <strong style={{ color: 'var(--text-bright)' }}>{activeStats?.overPct}%</strong> of hours,
          creating structural cashout shortfall exposure for unhedged utilities.
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          DECISION BENCHMARK: D-1 11:00 UTC GATE
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="control-toolbar">
        <div className="toolbar-left">
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="filter-label">PERIOD SELECT:</span>
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

        <div className="toolbar-right">
          <button
            className="filter-btn"
            style={{ borderRadius: 'var(--radius-xs)', borderRight: '1px solid var(--border-base)' }}
            onClick={() => setShowErrorArea(!showErrorArea)}
          >
            {showErrorArea ? 'HIDE ERROR SPREAD' : 'SHOW ERROR SPREAD'}
          </button>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            RECORDS: <strong style={{ color: 'var(--text-primary)' }}>{activeStats?.count}H</strong>
          </span>
        </div>
      </div>

      {/* Institutional KPI Ribbon */}
      <div className="kpi-ribbon">
        {/* Cell 1: Actual Outturn */}
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">ACTUAL OUTTURN (AVG)</span>
            <span className="kpi-cell-badge badge-actual">ELEXON FUELHH</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{activeStats?.avgActual?.toLocaleString()}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>PEAK: {activeStats?.maxGen?.toLocaleString()} MW</span>
            <span>BASE: {activeStats?.minGen?.toLocaleString()} MW</span>
          </div>
        </div>

        {/* Cell 2: Day-Ahead Forecast */}
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">DAY-AHEAD FORECAST</span>
            <span className="kpi-cell-badge badge-forecast">WINDFOR 11:00 D-1</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{activeStats?.avgForecast?.toLocaleString()}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>DELTA: +{(activeStats?.avgForecast - activeStats?.avgActual)?.toLocaleString()} MW</span>
            <span style={{ color: 'var(--color-bias-over)' }}>OVER-PROMISED</span>
          </div>
        </div>

        {/* Cell 3: Mean Absolute Error */}
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">MEAN ABS. ERROR (MAE)</span>
            <span className="kpi-cell-badge badge-neutral">VOLATILITY</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{activeStats?.avgMae?.toLocaleString()}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>RMSE: {summary?.rmse?.toLocaleString()} MW</span>
            <span>MAX: {summary?.max_error?.toLocaleString()} MW</span>
          </div>
        </div>

        {/* Cell 4: Forecast Accuracy */}
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">ACCURACY INDEX</span>
            <span className="kpi-cell-badge badge-neutral">100% - MAPE</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{summary ? (100 - summary.mape).toFixed(1) : '77.9'}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-cell-sub">
            <span>MAPE: {summary?.mape?.toFixed(2)}%</span>
            <span>CONFIDENCE: MODERATE</span>
          </div>
        </div>

        {/* Cell 5: Systematic Bias */}
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">SYSTEMATIC BIAS</span>
            <span className="kpi-cell-badge badge-warning">SHORTFALL RISK</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num" style={{ color: 'var(--color-bias-over)' }}>
              +{activeStats?.avgBias?.toLocaleString()}
            </span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>SHORTFALL FREQ: {activeStats?.overPct}%</span>
            <span>IMBALANCE PENALTY</span>
          </div>
        </div>
      </div>

      {/* Main Primary Chart: Forecast vs Actual */}
      <div className="terminal-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <span className="panel-title">UK National Wind: Day-Ahead Forecast vs Outturn Actual</span>
            <span className="panel-subtitle font-mono">| RESOLUTION: 1-HOUR HARMONIZED | SETTLEMENT: EMR BENCHMARK</span>
          </div>

          <div className="panel-actions">
            <div className="legend-chip">
              <span className="legend-line" style={{ background: 'var(--color-actual)' }} />
              <span>ACTUAL (MW)</span>
            </div>
            <div className="legend-chip">
              <span className="legend-line" style={{ background: 'var(--color-forecast)', borderTop: '2px dashed #3b82f6' }} />
              <span>D-1 FORECAST (MW)</span>
            </div>
            {showErrorArea && (
              <div className="legend-chip">
                <span className="legend-square" style={{ background: 'rgba(245, 158, 11, 0.25)' }} />
                <span>IMBALANCE GAP</span>
              </div>
            )}
          </div>
        </div>

        <div className="panel-body">
          <div className="chart-box-large">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="shortTime"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<TerminalChartTooltip />} />

                {/* Actual Wind Area */}
                <Area
                  type="monotone"
                  dataKey="actual_generation"
                  name="Actual Outturn"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#actualFill)"
                  dot={false}
                  isAnimationActive={false}
                />

                {/* Day-Ahead Forecast Line */}
                <Line
                  type="monotone"
                  dataKey="forecast_generation"
                  name="Day-Ahead Forecast"
                  stroke="#3b82f6"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />

                <Brush
                  dataKey="shortTime"
                  height={24}
                  stroke="#2d3e63"
                  fill="#090c14"
                  tickFormatter={() => ''}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Chart: Net Imbalance Error Timeline */}
      <div className="terminal-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <span className="panel-title">Net Hourly Imbalance Exposure (Forecast Error)</span>
            <span className="panel-subtitle font-mono">
              | POSITIVE = OVER-FORECAST (SHORT POSITION) | NEGATIVE = UNDER-FORECAST (SPILL RISK)
            </span>
          </div>

          <div className="panel-actions">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              SYSTEM BUY PRICE (SBP) EXPOSURE THRESHOLD: &gt; +2,500 MW
            </span>
          </div>
        </div>

        <div className="panel-body">
          <div className="chart-box-small">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="shortTime"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                />
                <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                <ReferenceLine y={2500} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'CRITICAL SHORTFALL', fill: '#f59e0b', fontSize: 9 }} />
                <Tooltip content={<TerminalErrorTooltip />} />
                <Area
                  type="monotone"
                  dataKey="error"
                  name="Error (MW)"
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

/* --- Institutional Terminal Tooltips --- */

function TerminalChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const actual = payload.find(p => p.dataKey === 'actual_generation')?.value;
  const forecast = payload.find(p => p.dataKey === 'forecast_generation')?.value;
  const delta = forecast != null && actual != null ? forecast - actual : 0;
  const isOver = delta > 0;

  return (
    <div className="terminal-tooltip">
      <div className="tooltip-time">{label} UTC</div>
      <div className="tooltip-row">
        <span style={{ color: 'var(--color-actual)' }}>● ACTUAL OUTTURN:</span>
        <span className="tooltip-val">{actual?.toLocaleString()} MW</span>
      </div>
      <div className="tooltip-row">
        <span style={{ color: 'var(--color-forecast)' }}>--- D-1 FORECAST:</span>
        <span className="tooltip-val">{forecast?.toLocaleString()} MW</span>
      </div>
      <div className="tooltip-error-row">
        <span style={{ color: isOver ? 'var(--color-bias-over)' : 'var(--color-bias-under)' }}>
          {isOver ? '▲ OVER-FORECAST:' : '▼ UNDER-FORECAST:'}
        </span>
        <span className="tooltip-val" style={{ color: isOver ? 'var(--color-bias-over)' : 'var(--color-bias-under)' }}>
          {isOver ? `+${delta?.toLocaleString()}` : delta?.toLocaleString()} MW
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-muted)' }}>
        {isOver ? 'IMPACT: DESK IS SHORT IN BALANCING' : 'IMPACT: DESK SPILLS SURPLUS POWER'}
      </div>
    </div>
  );
}

function TerminalErrorTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const err = payload[0]?.value;
  if (err == null) return null;

  return (
    <div className="terminal-tooltip">
      <div className="tooltip-time">{label} UTC</div>
      <div className="tooltip-row">
        <span>IMBALANCE VOLUME:</span>
        <span className="tooltip-val" style={{ color: err > 0 ? 'var(--color-bias-over)' : 'var(--color-bias-under)' }}>
          {err > 0 ? `+${err.toLocaleString()}` : err.toLocaleString()} MW
        </span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
        {err > 0 ? 'STATUS: Procurement Gap / High Cashout Risk' : 'STATUS: Long Position / Surplus Spill'}
      </div>
    </div>
  );
}

function TerminalLoadingSkeleton() {
  return (
    <div>
      <div className="control-toolbar" style={{ height: 42 }}>
        <div className="terminal-skeleton" style={{ width: 300, height: 18 }} />
      </div>
      <div className="kpi-ribbon">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="kpi-cell" style={{ height: 95 }}>
            <div className="terminal-skeleton" style={{ width: '60%', height: 12, marginBottom: 8 }} />
            <div className="terminal-skeleton" style={{ width: '80%', height: 28 }} />
          </div>
        ))}
      </div>
      <div className="terminal-panel" style={{ height: 420 }}>
        <div className="terminal-skeleton" style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
