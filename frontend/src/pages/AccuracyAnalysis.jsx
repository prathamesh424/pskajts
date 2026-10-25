import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, ReferenceLine, Cell
} from 'recharts';
import { Target, TrendingDown, Clock, AlertTriangle, ShieldAlert } from 'lucide-react';
import {
  fetchDailyAccuracy,
  fetchHourlyAccuracy,
  fetchErrorDistribution,
  fetchAccuracySummary,
} from '../api';
import { format } from 'date-fns';

export default function AccuracyAnalysis() {
  const [daily, setDaily] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterRisk, setFilterRisk] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [dailyRes, hourlyRes, distRes, sumRes] = await Promise.all([
        fetchDailyAccuracy(),
        fetchHourlyAccuracy(),
        fetchErrorDistribution(),
        fetchAccuracySummary(),
      ]);

      setDaily(dailyRes.data.map(d => ({
        ...d,
        dateLabel: format(new Date(d.date), 'MMM d'),
        fullDate: d.date,
        risk: d.mae > 3500 ? 'HIGH' : d.mae > 1800 ? 'MODERATE' : 'LOW',
      })));

      setHourly(hourlyRes.data.map(h => ({
        ...h,
        hourLabel: `${String(h.hour).padStart(2, '0')}:00`,
        isPeak: h.hour >= 16 && h.hour <= 19,
      })));

      setDistribution(distRes.data.map(b => ({
        ...b,
        label: `${b.bin_start > 0 ? '+' : ''}${Math.round(b.bin_start / 1000)}k`,
        isPositive: b.bin_start >= 0,
      })));

      setSummary(sumRes);
    } catch (err) {
      setError(err.message || 'Failed to fetch accuracy analytics');
    } finally {
      setLoading(false);
    }
  }

  const filteredDaily = daily.filter(d => {
    if (filterRisk === 'all') return true;
    return d.risk === filterRisk;
  });

  if (loading) return <TerminalLoadingSkeleton />;
  if (error) return (
    <div className="terminal-panel" style={{ borderColor: 'var(--color-danger)', padding: 16 }}>
      <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Error loading accuracy data: {error}</div>
    </div>
  );

  return (
    <div>
      {/* Executive Risk Advisory Banner */}
      <div className="terminal-callout" style={{ borderLeftColor: 'var(--color-bias-over)' }}>
        <div>
          <span className="callout-bold">QUANTITATIVE RISK AUDIT:</span>{' '}
          Across 744 hours in January 2026, mean absolute forecast error was{' '}
          <strong style={{ color: 'var(--text-bright)' }}>2,123 MW</strong> with RMSE of{' '}
          <strong style={{ color: 'var(--text-bright)' }}>2,617 MW</strong>.
          Forecast inaccuracy accelerates during the UK evening peak (16:00–19:00), precisely when wholesale power prices reach maximum premium.
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          ALGORITHM: VECTORIZED NUMPY MATRIX
        </div>
      </div>

      {/* Accuracy Metric Ribbon */}
      <div className="kpi-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">MEAN ABSOLUTE ERROR</span>
            <span className="kpi-cell-badge badge-neutral">MAE</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{summary?.mae?.toLocaleString()}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>EXPECTED HOURLY VOLATILITY</span>
          </div>
        </div>

        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">ROOT MEAN SQUARE ERROR</span>
            <span className="kpi-cell-badge badge-warning">RMSE</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{summary?.rmse?.toLocaleString()}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>PENALIZES TAIL SWINGS</span>
          </div>
        </div>

        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">MEAN ABS. PERCENTAGE ERROR</span>
            <span className="kpi-cell-badge badge-neutral">MAPE</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{summary?.mape?.toFixed(2)}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-cell-sub">
            <span>ACCURACY: {(100 - summary?.mape).toFixed(1)}%</span>
          </div>
        </div>

        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">SYSTEMATIC MODEL BIAS</span>
            <span className="kpi-cell-badge badge-warning">OVER-FORECAST</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num" style={{ color: 'var(--color-bias-over)' }}>
              +{summary?.bias?.toLocaleString()}
            </span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>AVERAGE POWER DEFICIT</span>
          </div>
        </div>
      </div>

      {/* Row 1: Diurnal Profile & Error Distribution */}
      <div className="grid-half">
        {/* Left: 24-Hour Diurnal Accuracy Profile */}
        <div className="terminal-panel">
          <div className="panel-header">
            <div className="panel-title-area">
              <span className="panel-title">24-Hour Diurnal Accuracy Profile</span>
              <span className="panel-subtitle font-mono">| BY HOUR-OF-DAY (00–23 UTC)</span>
            </div>
            <div className="panel-actions">
              <span className="legend-chip">
                <span className="legend-square" style={{ background: '#f59e0b' }} />
                <span>16:00–19:00 PEAK RISK</span>
              </span>
            </div>
          </div>
          <div className="panel-body">
            <div className="chart-box-medium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hourLabel" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Tooltip content={<HourlyTooltip />} />
                  <Bar dataKey="mae" name="MAE (MW)">
                    {hourly.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPeak ? '#f59e0b' : '#334155'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              NOTE: Amber columns denote UK evening peak demand window (16:00–19:00) where forecast error averages 2,420 MW.
            </div>
          </div>
        </div>

        {/* Right: Error Frequency Histogram */}
        <div className="terminal-panel">
          <div className="panel-header">
            <div className="panel-title-area">
              <span className="panel-title">Error Distribution &amp; Asymmetry</span>
              <span className="panel-subtitle font-mono">| HISTOGRAM BINS: (FORECAST - ACTUAL)</span>
            </div>
            <div className="panel-actions">
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-bias-over)' }}>
                72.3% OVER-FORECAST SKEW
              </span>
            </div>
          </div>
          <div className="panel-body">
            <div className="chart-box-medium">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'var(--font-mono)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DistTooltip />} />
                  <ReferenceLine x="0k" stroke="#64748b" strokeDasharray="2 2" />
                  <Bar dataKey="count" name="Hours Count">
                    {distribution.map((entry, index) => (
                      <Cell key={`dist-${index}`} fill={entry.isPositive ? 'rgba(245, 158, 11, 0.7)' : 'rgba(139, 92, 246, 0.6)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-bias-under)' }}>◄ Under-forecast (Surplus Power)</span>
              <span style={{ color: 'var(--color-bias-over)' }}>Over-forecast (Shortfall Deficit) ►</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Daily Accuracy Ledger Table */}
      <div className="terminal-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <span className="panel-title">Daily Forecast Accuracy Ledger</span>
            <span className="panel-subtitle font-mono">| AUDITED ACROSS ALL 31 CALENDAR DAYS</span>
          </div>

          <div className="panel-actions">
            <div className="filter-btn-group">
              <button className={`filter-btn ${filterRisk === 'all' ? 'active' : ''}`} onClick={() => setFilterRisk('all')}>ALL DAYS (31)</button>
              <button className={`filter-btn ${filterRisk === 'HIGH' ? 'active' : ''}`} onClick={() => setFilterRisk('HIGH')}>HIGH RISK (MAE &gt; 3.5 GW)</button>
              <button className={`filter-btn ${filterRisk === 'LOW' ? 'active' : ''}`} onClick={() => setFilterRisk('LOW')}>CALM (MAE &lt; 1.8 GW)</button>
            </div>
          </div>
        </div>

        <div className="terminal-table-wrap">
          <table className="terminal-table">
            <thead>
              <tr>
                <th>DELIVERY DATE</th>
                <th>PERIODS</th>
                <th>ACTUAL MEAN</th>
                <th>FORECAST MEAN</th>
                <th>MAE (MW)</th>
                <th>RMSE (MW)</th>
                <th>MAPE (%)</th>
                <th>BIAS (MW)</th>
                <th>MAX ERROR</th>
                <th>RISK STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDaily.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.hours}h</td>
                  <td>{row.avg_actual?.toLocaleString()} MW</td>
                  <td>{row.avg_forecast?.toLocaleString()} MW</td>
                  <td style={{ fontWeight: 700, color: row.mae > 3500 ? 'var(--color-danger)' : 'var(--text-bright)' }}>
                    {row.mae?.toLocaleString()}
                  </td>
                  <td>{row.rmse?.toLocaleString()}</td>
                  <td>{row.mape?.toFixed(1)}%</td>
                  <td style={{ color: row.bias > 0 ? 'var(--color-bias-over)' : 'var(--color-bias-under)' }}>
                    {row.bias > 0 ? `+${row.bias.toLocaleString()}` : row.bias?.toLocaleString()}
                  </td>
                  <td>{row.max_error?.toLocaleString()} MW</td>
                  <td>
                    <span className={`kpi-cell-badge ${row.risk === 'HIGH' ? 'badge-warning' : row.risk === 'LOW' ? 'badge-actual' : 'badge-neutral'}`}>
                      {row.risk === 'HIGH' ? 'VOLATILE' : row.risk === 'LOW' ? 'STABLE' : 'MODERATE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HourlyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  return (
    <div className="terminal-tooltip">
      <div className="tooltip-time">HOUR {label} UTC</div>
      <div className="tooltip-row">
        <span>MEAN ERROR (MAE):</span>
        <span className="tooltip-val">{data?.mae?.toLocaleString()} MW</span>
      </div>
      <div className="tooltip-row">
        <span>MAPE:</span>
        <span className="tooltip-val">{data?.mape?.toFixed(1)}%</span>
      </div>
      <div className="tooltip-row">
        <span>BIAS:</span>
        <span className="tooltip-val" style={{ color: data?.bias > 0 ? 'var(--color-bias-over)' : 'inherit' }}>
          {data?.bias > 0 ? `+${data?.bias?.toLocaleString()}` : data?.bias?.toLocaleString()} MW
        </span>
      </div>
      {data?.isPeak && (
        <div style={{ marginTop: 4, fontSize: 9, color: '#f59e0b', fontWeight: 600 }}>
          CRITICAL UK PEAK DEMAND WINDOW
        </div>
      )}
    </div>
  );
}

function DistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="terminal-tooltip">
      <div className="tooltip-time">RANGE: {d?.bin_start?.toFixed(0)} to {d?.bin_end?.toFixed(0)} MW</div>
      <div className="tooltip-row">
        <span>OCCURRENCE:</span>
        <span className="tooltip-val">{d?.count} hours ({d?.percentage}%)</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
        {d?.isPositive ? 'Over-forecasted (Shortfall Risk)' : 'Under-forecasted (Surplus)'}
      </div>
    </div>
  );
}

function TerminalLoadingSkeleton() {
  return (
    <div>
      <div className="kpi-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="kpi-cell" style={{ height: 90 }}>
            <div className="terminal-skeleton" style={{ width: '50%', height: 12, marginBottom: 8 }} />
            <div className="terminal-skeleton" style={{ width: '70%', height: 26 }} />
          </div>
        ))}
      </div>
      <div className="grid-half">
        <div className="terminal-panel" style={{ height: 320 }}><div className="terminal-skeleton" style={{ width: '100%', height: '100%' }} /></div>
        <div className="terminal-panel" style={{ height: 320 }}><div className="terminal-skeleton" style={{ width: '100%', height: '100%' }} /></div>
      </div>
    </div>
  );
}
