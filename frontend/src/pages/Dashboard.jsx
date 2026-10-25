import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, ComposedChart, Legend, Brush,
  ReferenceLine,
} from 'recharts';
import { Wind, TrendingUp, AlertTriangle, Zap, Activity } from 'lucide-react';
import { fetchForecastVsActual, fetchAccuracySummary } from '../api';
import { format, parseISO } from 'date-fns';

/**
 * Executive Dashboard — hero KPIs and forecast vs actual timeseries.
 * Landing page designed to give an immediate overview to the client.
 */
export default function Dashboard() {
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      // Format timeseries for charting
      const formatted = tsRes.data.map((d) => ({
        ...d,
        time: format(parseISO(d.start_time), 'MMM d HH:mm'),
        date: format(parseISO(d.start_time), 'MMM d'),
        hour: format(parseISO(d.start_time), 'HH:mm'),
      }));

      setTimeseriesData(formatted);
      setSummary(sumRes);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="error-banner">⚠️ {error}</div>;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Wind Generation Overview</h1>
        <p className="page-description">
          UK national wind generation actuals vs. day-ahead forecasts for January 2026.
          Forecasts shown are the latest available at gate closure (11:00 D-1).
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          icon={<Wind size={20} />}
          label="Avg Generation"
          value={summary?.avg_actual?.toLocaleString()}
          unit="MW"
          delay={0}
        />
        <KPICard
          icon={<TrendingUp size={20} />}
          label="Forecast Accuracy"
          value={summary ? (100 - summary.mape).toFixed(1) : '-'}
          unit="%"
          variant="positive"
          subtext={`MAPE: ${summary?.mape?.toFixed(1)}%`}
          delay={1}
        />
        <KPICard
          icon={<AlertTriangle size={20} />}
          label="Mean Abs. Error"
          value={summary?.mae?.toLocaleString()}
          unit="MW"
          variant="warning"
          delay={2}
        />
        <KPICard
          icon={<Zap size={20} />}
          label="Forecast Bias"
          value={summary?.bias > 0 ? `+${summary.bias.toLocaleString()}` : summary?.bias?.toLocaleString()}
          unit="MW"
          variant={summary?.bias > 0 ? 'warning' : 'positive'}
          subtext={summary?.bias > 0 ? 'Over-forecasting' : 'Under-forecasting'}
          delay={3}
        />
      </div>

      {/* Main Timeseries Chart */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Activity size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--color-accent-cyan)' }} />
              Forecast vs Actual Wind Generation
            </h2>
            <p className="card-subtitle">
              Hourly comparison · January 2026 · Drag the brush below to zoom
            </p>
          </div>
        </div>

        <div className="chart-container-lg">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeseriesData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                label={{
                  value: 'Generation (MW)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#64748b', fontSize: 12 },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ fontSize: 13, color: '#94a3b8' }}
              />
              <Area
                type="monotone"
                dataKey="actual_generation"
                name="Actual"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#actualGrad)"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="forecast_generation"
                name="Forecast"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
              <Brush
                dataKey="time"
                height={30}
                stroke="rgba(59, 130, 246, 0.3)"
                fill="rgba(17, 24, 39, 0.8)"
                tickFormatter={() => ''}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Error Timeseries */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="card-header">
          <div>
            <h2 className="card-title">Forecast Error Over Time</h2>
            <p className="card-subtitle">
              Positive = over-forecast (excess procurement), Negative = under-forecast (shortfall risk)
            </p>
          </div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timeseriesData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: 'Error (MW)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#64748b', fontSize: 12 },
                }}
              />
              <Tooltip content={<ErrorTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="error"
                name="Forecast Error"
                stroke="#f59e0b"
                strokeWidth={1.5}
                fill="rgba(245, 158, 11, 0.1)"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}


/* --- Sub-components --- */

function KPICard({ icon, label, value, unit, variant, subtext, delay = 0 }) {
  const valueClass = variant === 'positive'
    ? 'kpi-value positive'
    : variant === 'warning'
      ? 'kpi-value warning'
      : variant === 'negative'
        ? 'kpi-value negative'
        : 'kpi-value';

  return (
    <motion.div
      className="kpi-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--color-text-muted)' }}>
        {icon}
        <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
      </div>
      <div className={valueClass}>
        {value ?? '-'}
        <span className="kpi-unit">{unit}</span>
      </div>
      {subtext && <div className="kpi-change">{subtext}</div>}
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '12px 16px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, marginBottom: 4 }}>
          {p.name}: <strong>{p.value?.toLocaleString()} MW</strong>
        </p>
      ))}
      {payload.length >= 2 && (
        <p style={{ color: '#f59e0b', fontSize: 12, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
          Error: <strong>{(payload[1].value - payload[0].value).toLocaleString()} MW</strong>
        </p>
      )}
    </div>
  );
}

function ErrorTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const error = payload[0].value;
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '12px 16px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text-primary)' }}>{label}</p>
      <p style={{ color: error > 0 ? '#f59e0b' : '#8b5cf6', fontSize: 13 }}>
        {error > 0 ? '⬆ Over-forecast' : '⬇ Under-forecast'}: <strong>{Math.abs(error).toLocaleString()} MW</strong>
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div className="skeleton skeleton-text" style={{ width: 300, height: 32 }} />
        <div className="skeleton skeleton-text" style={{ width: 500, marginTop: 8 }} />
      </div>
      <div className="kpi-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="kpi-card">
            <div className="skeleton skeleton-text" style={{ width: 100 }} />
            <div className="skeleton skeleton-kpi" style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton skeleton-chart" />
      </div>
    </div>
  );
}
