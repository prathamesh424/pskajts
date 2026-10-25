import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Area,
  Cell, Legend, ReferenceLine,
} from 'recharts';
import { BarChart3, Clock, TrendingDown, Target } from 'lucide-react';
import {
  fetchDailyAccuracy,
  fetchHourlyAccuracy,
  fetchErrorDistribution,
  fetchAccuracySummary,
} from '../api';
import { format } from 'date-fns';

/**
 * Forecast Accuracy Analysis page.
 *
 * Deep-dive into forecast accuracy: daily breakdown, hourly profile,
 * error distribution, and bias analysis.
 */
export default function AccuracyAnalysis() {
  const [daily, setDaily] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [dailyRes, hourlyRes, distRes, sumRes] = await Promise.all([
        fetchDailyAccuracy(),
        fetchHourlyAccuracy(),
        fetchErrorDistribution(),
        fetchAccuracySummary(),
      ]);

      setDaily(dailyRes.data.map(d => ({
        ...d,
        dateLabel: format(new Date(d.date), 'MMM d'),
      })));
      setHourly(hourlyRes.data.map(h => ({
        ...h,
        hourLabel: `${String(h.hour).padStart(2, '0')}:00`,
      })));
      setDistribution(distRes.data.map(b => ({
        ...b,
        label: `${b.bin_start.toFixed(0)}`,
      })));
      setSummary(sumRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="error-banner">⚠️ {error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Forecast Accuracy Analysis</h1>
        <p className="page-description">
          Quantitative evaluation of wind generation forecast accuracy.
          Use these metrics to quantify procurement risk from forecast uncertainty.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid">
        <MetricCard icon={<Target size={18} />} label="MAE" value={summary?.mae} unit="MW" color="var(--color-accent-amber)" />
        <MetricCard icon={<TrendingDown size={18} />} label="RMSE" value={summary?.rmse} unit="MW" color="var(--color-accent-red)" />
        <MetricCard icon={<BarChart3 size={18} />} label="MAPE" value={summary?.mape?.toFixed(1)} unit="%" color="var(--color-accent-purple)" />
        <MetricCard icon={<Clock size={18} />} label="Max Error" value={summary?.max_error} unit="MW" color="var(--color-accent-cyan)" />
      </div>

      {/* Row 1: Daily Accuracy + Error Distribution */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Daily MAE & MAPE */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Daily Accuracy</h2>
              <p className="card-subtitle">MAE (bars) and MAPE % (line) by day</p>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily} margin={{ top: 10, right: 40, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="dateLabel" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval={2} />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'MAE (MW)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'MAPE %', angle: 90, position: 'insideRight', style: { fill: '#64748b', fontSize: 11 } }}
                />
                <Tooltip content={<DailyTooltip />} />
                <Bar yAxisId="left" dataKey="mae" name="MAE" fill="#f59e0b" radius={[4, 4, 0, 0]} opacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="mape" name="MAPE %" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Error Distribution */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Error Distribution</h2>
              <p className="card-subtitle">Histogram of forecast errors (MW). Center = perfect forecast.</p>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  label={{ value: 'Frequency %', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }}
                />
                <Tooltip content={<DistTooltip />} />
                <ReferenceLine x="0" stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Bar dataKey="percentage" name="Frequency" radius={[3, 3, 0, 0]}>
                  {distribution.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.bin_start < 0 ? '#8b5cf6' : entry.bin_start > 0 ? '#f59e0b' : '#64748b'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Row 2: Hourly Accuracy Profile + Bias Analysis */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Accuracy by Hour of Day */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Accuracy by Hour of Day</h2>
              <p className="card-subtitle">When are forecasts most and least accurate?</p>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hourLabel" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  label={{ value: 'MAE (MW)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }}
                />
                <Tooltip content={<HourlyTooltip />} />
                <Bar dataKey="mae" name="MAE" radius={[4, 4, 0, 0]}>
                  {hourly.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.mae > (summary?.mae * 1.2) ? '#ef4444' : entry.mae < (summary?.mae * 0.8) ? '#10b981' : '#3b82f6'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bias by Hour */}
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Forecast Bias by Hour</h2>
              <p className="card-subtitle">Systematic over/under-forecasting patterns</p>
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={hourly} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hourLabel" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  label={{ value: 'Bias (MW)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 11 } }}
                />
                <Tooltip content={<BiasTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
                <Bar dataKey="bias" name="Bias">
                  {hourly.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.bias > 0 ? '#f59e0b' : '#8b5cf6'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Daily Accuracy Table */}
      <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="card-header">
          <h2 className="card-title">Daily Accuracy Table</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Avg Actual (MW)</th>
                <th>Avg Forecast (MW)</th>
                <th>MAE (MW)</th>
                <th>RMSE (MW)</th>
                <th>MAPE (%)</th>
                <th>Bias (MW)</th>
                <th>Max Error (MW)</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date}>
                  <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{d.dateLabel}</td>
                  <td>{d.hours}</td>
                  <td>{d.avg_actual?.toLocaleString()}</td>
                  <td>{d.avg_forecast?.toLocaleString()}</td>
                  <td className={getMaeClass(d.mae, summary?.mae)}>{d.mae?.toLocaleString()}</td>
                  <td>{d.rmse?.toLocaleString()}</td>
                  <td className={getMapeClass(d.mape)}>{d.mape?.toFixed(1)}%</td>
                  <td style={{ color: d.bias > 0 ? '#f59e0b' : '#8b5cf6' }}>
                    {d.bias > 0 ? '+' : ''}{d.bias?.toLocaleString()}
                  </td>
                  <td>{d.max_error?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}


/* --- Helper functions --- */

function getMaeClass(mae, avgMae) {
  if (!avgMae) return '';
  if (mae < avgMae * 0.8) return 'cell-good';
  if (mae > avgMae * 1.2) return 'cell-bad';
  return 'cell-warn';
}

function getMapeClass(mape) {
  if (mape < 15) return 'cell-good';
  if (mape > 25) return 'cell-bad';
  return 'cell-warn';
}


/* --- Tooltip components --- */

function DailyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, marginBottom: 2 }}>
          {p.name}: <strong>{p.value?.toLocaleString()}{p.name.includes('%') ? '%' : ' MW'}</strong>
        </p>
      ))}
    </div>
  );
}

function DistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={tooltipStyle}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{d.bin_start?.toFixed(0)} to {d.bin_end?.toFixed(0)} MW</p>
      <p style={{ fontSize: 13 }}>Count: <strong>{d.count}</strong></p>
      <p style={{ fontSize: 13 }}>Frequency: <strong>{d.percentage?.toFixed(1)}%</strong></p>
    </div>
  );
}

function HourlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 13 }}>MAE: <strong>{payload[0].value?.toLocaleString()} MW</strong></p>
      <p style={{ fontSize: 12, color: '#64748b' }}>Samples: {payload[0].payload.sample_count}</p>
    </div>
  );
}

function BiasTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const bias = payload[0].value;
  return (
    <div style={tooltipStyle}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 13, color: bias > 0 ? '#f59e0b' : '#8b5cf6' }}>
        {bias > 0 ? 'Over-forecast' : 'Under-forecast'}: <strong>{Math.abs(bias)?.toLocaleString()} MW</strong>
      </p>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, color }) {
  return (
    <motion.div className="kpi-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color }}>
        {icon}
        <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
      </div>
      <div className="kpi-value">
        {value?.toLocaleString() ?? '-'}
        <span className="kpi-unit">{unit}</span>
      </div>
    </motion.div>
  );
}

const tooltipStyle = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '12px 16px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
  color: 'var(--color-text-primary)',
};

function LoadingSkeleton() {
  return (
    <div>
      <div className="page-header">
        <div className="skeleton skeleton-text" style={{ width: 350, height: 32 }} />
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
      <div className="grid-2">
        <div className="card"><div className="skeleton skeleton-chart" /></div>
        <div className="card"><div className="skeleton skeleton-chart" /></div>
      </div>
    </div>
  );
}
