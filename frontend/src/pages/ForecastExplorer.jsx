import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { Search, Calendar, Layers, Clock } from 'lucide-react';
import { fetchForecastRevisions } from '../api';
import { format, parseISO } from 'date-fns';

// Pre-generate all January 2026 dates for the picker
const JAN_DATES = Array.from({ length: 31 }, (_, i) => {
  const d = new Date(2026, 0, i + 1);
  return {
    value: format(d, 'yyyy-MM-dd'),
    label: format(d, 'EEE, MMM d'),
  };
});

// Distinct colors for forecast revision lines
const REVISION_COLORS = [
  '#64748b', '#94a3b8', '#cbd5e1',
  '#a78bfa', '#8b5cf6', '#7c3aed',
  '#60a5fa', '#3b82f6', '#2563eb',
  '#38bdf8', '#0ea5e9', '#0284c7',
  '#f59e0b', '#f97316',
];

/**
 * Forecast Explorer — interactive tool to explore forecast revisions
 * for a specific delivery date. Shows how forecasts improve as the
 * delivery day approaches.
 */
export default function ForecastExplorer() {
  const [selectedDate, setSelectedDate] = useState('2026-01-15');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  async function loadData(date) {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchForecastRevisions(date);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Group revisions by publishTime to create separate lines
  const { chartData, publishTimes } = useMemo(() => {
    if (!data) return { chartData: [], publishTimes: [] };

    // Get unique publish times (sorted)
    const pTimes = [...new Set(data.revisions.map(r => r.publish_time))].sort();

    // Build chart data: each row is an hour, columns are revisions + actual
    const hourMap = {};

    // Add actuals
    data.actuals.forEach(a => {
      const hour = format(parseISO(a.start_time), 'HH:mm');
      hourMap[hour] = { hour, actual: a.generation };
    });

    // Add forecast revisions
    data.revisions.forEach(r => {
      const hour = format(parseISO(r.start_time), 'HH:mm');
      if (!hourMap[hour]) hourMap[hour] = { hour };
      const pubLabel = format(parseISO(r.publish_time), 'MMM d HH:mm');
      hourMap[hour][pubLabel] = r.generation;
    });

    const rows = Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour));
    const pubLabels = pTimes.map(pt => format(parseISO(pt), 'MMM d HH:mm'));

    return { chartData: rows, publishTimes: pubLabels };
  }, [data]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <Search size={28} style={{ marginRight: 12, verticalAlign: 'middle', color: 'var(--color-accent-cyan)' }} />
          Forecast Explorer
        </h1>
        <p className="page-description">
          Explore how wind generation forecasts evolve over time for a specific delivery day.
          See all forecast revisions overlaid with actual generation.
        </p>
      </div>

      {/* Date Selector */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'var(--space-6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
            <Calendar size={18} />
            <span style={{ fontWeight: 500 }}>Delivery Date:</span>
          </div>
          <select
            className="select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {JAN_DATES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          {data && !loading && (
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginLeft: 'auto' }}>
              <div className="badge badge-green">
                <Layers size={12} style={{ marginRight: 4 }} />
                {data.revision_count} forecast revisions
              </div>
              <div className="badge badge-amber">
                <Clock size={12} style={{ marginRight: 4 }} />
                {data.actuals?.length || 0} actual hours
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {loading && <LoadingState />}
      {error && <div className="error-banner">⚠️ {error}</div>}

      {data && !loading && (
        <>
          {/* Main Revision Chart */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ marginBottom: 'var(--space-6)' }}
          >
            <div className="card-header">
              <div>
                <h2 className="card-title">Forecast Revisions vs Actual</h2>
                <p className="card-subtitle">
                  Each line represents a forecast published at a different time.
                  The green line shows actual generation. Later forecasts (darker colors) tend to be more accurate.
                </p>
              </div>
            </div>

            <div className="chart-container-lg">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
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
                  <Tooltip content={<RevisionTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={50}
                    wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 16 }}
                  />

                  {/* Actual generation (bold green line) */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="✦ Actual"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10b981' }}
                  />

                  {/* Forecast revision lines */}
                  {publishTimes.map((pt, i) => (
                    <Line
                      key={pt}
                      type="monotone"
                      dataKey={pt}
                      name={`Forecast @ ${pt}`}
                      stroke={REVISION_COLORS[i % REVISION_COLORS.length]}
                      strokeWidth={1.5}
                      strokeDasharray={i < publishTimes.length / 2 ? '6 3' : undefined}
                      dot={false}
                      opacity={0.5 + (i / publishTimes.length) * 0.5}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Revision Timeline */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="card-header">
              <h2 className="card-title">Forecast Revision Timeline</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Published At</th>
                    <th>Hours Before Delivery (avg)</th>
                    <th>Target Hours Covered</th>
                    <th>Avg Forecast (MW)</th>
                  </tr>
                </thead>
                <tbody>
                  {publishTimes.map((pt, i) => {
                    const revs = data.revisions.filter(
                      r => format(parseISO(r.publish_time), 'MMM d HH:mm') === pt
                    );
                    const avgGen = revs.reduce((s, r) => s + r.generation, 0) / revs.length;
                    const avgHours = revs.reduce((s, r) => s + r.hours_before_delivery, 0) / revs.length;

                    return (
                      <tr key={pt}>
                        <td style={{ fontWeight: 500, color: REVISION_COLORS[i % REVISION_COLORS.length] }}>
                          {pt}
                        </td>
                        <td>{avgHours?.toFixed(1)}h</td>
                        <td>{revs.length} hours</td>
                        <td>{avgGen?.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}


/* --- Sub-components --- */

function RevisionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '12px 16px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      maxHeight: 300,
      overflowY: 'auto',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--color-text-primary)' }}>{label}</p>
      {payload
        .filter(p => p.value != null)
        .map((p, i) => (
          <p key={i} style={{ color: p.color, fontSize: 12, marginBottom: 2 }}>
            {p.name}: <strong>{p.value?.toLocaleString()} MW</strong>
          </p>
        ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="card" style={{ padding: 48, textAlign: 'center' }}>
      <div className="skeleton skeleton-chart" style={{ maxWidth: 800, margin: '0 auto' }} />
      <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>
        Loading forecast revisions from Elexon BMRS...
      </p>
    </div>
  );
}
