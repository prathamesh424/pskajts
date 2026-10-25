import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
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
      setError(err.message || 'Failed loading accuracy metrics');
    } finally {
      setLoading(false);
    }
  }

  const filteredDaily = daily.filter(d => {
    if (filterRisk === 'all') return true;
    return d.risk === filterRisk;
  });

  if (loading) return <AccuracySkeleton />;
  if (error) return (
    <div className="clean-panel" style={{ padding: 20, color: 'var(--color-danger)' }}>
      Error: {error}
    </div>
  );

  return (
    <div>
      {/* 4 Clean Metric Cards */}
      <div className="kpi-grid-4">
        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">MEAN ABS. ERROR</span>
            <span className="kpi-pill">MAE</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number">{summary?.mae?.toLocaleString()}</span>
            <span className="kpi-val-unit">MW</span>
          </div>
          <div className="kpi-box-footer">
            <span>Average volume deviation</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">ROOT MEAN SQUARE</span>
            <span className="kpi-pill">RMSE</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number">{summary?.rmse?.toLocaleString()}</span>
            <span className="kpi-val-unit">MW</span>
          </div>
          <div className="kpi-box-footer">
            <span>Heavy penalty on large misses</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">PERCENTAGE ERROR</span>
            <span className="kpi-pill">MAPE</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number">{summary?.mape?.toFixed(2)}</span>
            <span className="kpi-val-unit">%</span>
          </div>
          <div className="kpi-box-footer">
            <span>Accuracy: {(100 - summary?.mape).toFixed(1)}%</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-box-header">
            <span className="kpi-box-title">SYSTEM BIAS</span>
            <span className="kpi-pill" style={{ color: 'var(--color-warning)' }}>OVER-FORECAST</span>
          </div>
          <div className="kpi-box-value">
            <span className="kpi-val-number" style={{ color: 'var(--color-warning)' }}>
              +{summary?.bias?.toLocaleString()}
            </span>
            <span className="kpi-val-unit">MW</span>
          </div>
          <div className="kpi-box-footer">
            <span>Persistent structural deficit</span>
          </div>
        </div>
      </div>

      {/* Row 1: Diurnal Profile & Distribution Side-by-Side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Diurnal Profile */}
        <div className="clean-panel" style={{ marginBottom: 0 }}>
          <div className="clean-panel-header">
            <div>
              <span className="panel-heading">24-Hour Diurnal Error Profile</span>
              <span className="panel-meta font-mono">| By Hour-of-Day (00–23 UTC)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: 2 }} />
              <span style={{ color: '#f59e0b' }}>16:00–19:00 Peak</span>
            </div>
          </div>
          <div className="clean-panel-body">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                  <XAxis dataKey="hourLabel" tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Tooltip content={<HourlyTooltip />} />
                  <Bar dataKey="mae" name="MAE (MW)">
                    {hourly.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPeak ? '#f59e0b' : '#3f3f46'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Error Distribution */}
        <div className="clean-panel" style={{ marginBottom: 0 }}>
          <div className="clean-panel-header">
            <div>
              <span className="panel-heading">Error Distribution</span>
              <span className="panel-meta font-mono">| (Forecast − Actual)</span>
            </div>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-warning)' }}>
              72.3% OVER-FORECAST
            </span>
          </div>
          <div className="clean-panel-body">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 9, fontFamily: 'var(--font-mono)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<DistTooltip />} />
                  <ReferenceLine x="0k" stroke="#71717a" strokeDasharray="2 2" />
                  <Bar dataKey="count" name="Hours">
                    {distribution.map((entry, index) => (
                      <Cell key={`dist-${index}`} fill={entry.isPositive ? 'rgba(245, 158, 11, 0.65)' : 'rgba(168, 85, 247, 0.6)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Daily Accuracy Ledger Table */}
      <div className="clean-panel">
        <div className="clean-panel-header">
          <div>
            <span className="panel-heading">Daily Accuracy Ledger</span>
            <span className="panel-meta font-mono">| 31 Days Breakdown</span>
          </div>

          <div className="filter-btn-group">
            <button className={`filter-btn ${filterRisk === 'all' ? 'active' : ''}`} onClick={() => setFilterRisk('all')}>ALL (31)</button>
            <button className={`filter-btn ${filterRisk === 'HIGH' ? 'active' : ''}`} onClick={() => setFilterRisk('HIGH')}>HIGH RISK</button>
            <button className={`filter-btn ${filterRisk === 'LOW' ? 'active' : ''}`} onClick={() => setFilterRisk('LOW')}>STABLE</button>
          </div>
        </div>

        <div className="clean-table-wrap">
          <table className="clean-table">
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
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDaily.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.hours}h</td>
                  <td>{row.avg_actual?.toLocaleString()} MW</td>
                  <td>{row.avg_forecast?.toLocaleString()} MW</td>
                  <td style={{ fontWeight: 700, color: row.mae > 3500 ? 'var(--color-danger)' : 'var(--text-white)' }}>
                    {row.mae?.toLocaleString()}
                  </td>
                  <td>{row.rmse?.toLocaleString()}</td>
                  <td>{row.mape?.toFixed(1)}%</td>
                  <td style={{ color: row.bias > 0 ? 'var(--color-warning)' : 'inherit' }}>
                    {row.bias > 0 ? `+${row.bias.toLocaleString()}` : row.bias?.toLocaleString()}
                  </td>
                  <td>{row.max_error?.toLocaleString()} MW</td>
                  <td>
                    <span className="kpi-pill" style={{
                      color: row.risk === 'HIGH' ? 'var(--color-danger)' : row.risk === 'LOW' ? 'var(--color-actual)' : 'var(--text-secondary)'
                    }}>
                      {row.risk}
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
  const d = payload[0]?.payload;
  return (
    <div className="clean-tooltip">
      <div className="tooltip-title">Hour {label} UTC</div>
      <div className="tooltip-line">
        <span>MAE:</span>
        <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{d?.mae?.toLocaleString()} MW</span>
      </div>
      <div className="tooltip-line">
        <span>Bias:</span>
        <span style={{ color: d?.bias > 0 ? 'var(--color-warning)' : 'inherit' }}>
          {d?.bias > 0 ? `+${d?.bias?.toLocaleString()}` : d?.bias?.toLocaleString()} MW
        </span>
      </div>
      {d?.isPeak && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b' }}>UK Evening Peak Demand</div>
      )}
    </div>
  );
}

function DistTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="clean-tooltip">
      <div className="tooltip-title">Range: {d?.bin_start?.toFixed(0)} to {d?.bin_end?.toFixed(0)} MW</div>
      <div className="tooltip-line">
        <span>Count:</span>
        <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{d?.count} hours ({d?.percentage}%)</span>
      </div>
    </div>
  );
}

function AccuracySkeleton() {
  return (
    <div>
      <div className="kpi-grid-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="clean-skeleton" style={{ height: 100 }} />
        ))}
      </div>
      <div className="clean-skeleton" style={{ height: 320 }} />
    </div>
  );
}
