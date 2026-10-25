import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { Calendar, Layers, Clock, AlertCircle } from 'lucide-react';
import { fetchForecastRevisions } from '../api';
import { format, parseISO } from 'date-fns';

const NOTABLE_DATES = [
  { date: '2026-01-02', label: '02 JAN: BASELINE DAY' },
  { date: '2026-01-08', label: '08 JAN: HIGH ACCURACY (MAE 580 MW)' },
  { date: '2026-01-15', label: '15 JAN: MET DISPERSION' },
  { date: '2026-01-24', label: '24 JAN: STORM ÉOWYN PEAK' },
  { date: '2026-01-28', label: '28 JAN: SEVERE OVER-FORECAST' },
];

const JAN_DATES = Array.from({ length: 31 }, (_, i) => {
  const d = new Date(2026, 0, i + 1);
  return {
    value: format(d, 'yyyy-MM-dd'),
    label: format(d, 'yyyy-MM-dd (EEE)'),
  };
});

// Precision revision palette: older revisions are muted, latest is highlighted
const PALETTE = [
  '#475569', '#64748b', '#94a3b8', '#38bdf8', '#0284c7', '#2563eb', '#f59e0b', '#ec4899', '#14b8a6'
];

export default function ForecastExplorer() {
  const [selectedDate, setSelectedDate] = useState('2026-01-24');
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
      setError(err.message || 'Failed fetching revisions');
    } finally {
      setLoading(false);
    }
  }

  const { chartData, publishTimes, summaryStats } = useMemo(() => {
    if (!data) return { chartData: [], publishTimes: [], summaryStats: null };

    const pTimes = [...new Set(data.revisions.map(r => r.publish_time))].sort();
    const hourMap = {};

    // Ingest actuals
    data.actuals.forEach(a => {
      const hour = format(parseISO(a.start_time), 'HH:mm');
      hourMap[hour] = { hour, actual: Math.round(a.generation) };
    });

    // Ingest revisions
    data.revisions.forEach(r => {
      const hour = format(parseISO(r.start_time), 'HH:mm');
      if (!hourMap[hour]) hourMap[hour] = { hour };
      const pubLabel = format(parseISO(r.publish_time), 'dd/MM HH:mm');
      hourMap[hour][pubLabel] = Math.round(r.generation);
    });

    const rows = Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour));
    const pubLabels = pTimes.map(pt => format(parseISO(pt), 'dd/MM HH:mm'));

    // Compute stats for selected delivery date
    const actualVals = data.actuals.map(a => a.generation);
    const avgActual = actualVals.length ? Math.round(actualVals.reduce((a, b) => a + b, 0) / actualVals.length) : 0;
    const peakActual = actualVals.length ? Math.round(Math.max(...actualVals)) : 0;

    return {
      chartData: rows,
      publishTimes: pubLabels,
      summaryStats: {
        avgActual,
        peakActual,
        revisionCount: pTimes.length,
      }
    };
  }, [data]);

  return (
    <div>
      {/* Trading Advisory Callout */}
      <div className="terminal-callout">
        <div>
          <span className="callout-bold">MULTI-REVISION CONVERGENCE ENGINE:</span>{' '}
          Examine how meteorological updates converge towards outturn generation across consecutive publication cycles.
          Evaluate whether early forecasts were reliable or if significant updates occurred in the final 6 hours before gate closure.
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          DATASET: WINDFOR HISTORICAL REVISION STREAM
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="control-toolbar">
        <div className="toolbar-left">
          <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="filter-label">NOTABLE EVENTS:</span>
          <div className="filter-btn-group">
            {NOTABLE_DATES.map((item) => (
              <button
                key={item.date}
                className={`filter-btn ${selectedDate === item.date ? 'active' : ''}`}
                onClick={() => setSelectedDate(item.date)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-right">
          <span className="filter-label">SELECT DATE:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: '#090c14',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-base)',
              borderRadius: 'var(--radius-xs)',
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              outline: 'none',
            }}
          >
            {JAN_DATES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Daily Snapshot KPI Ribbon */}
      <div className="kpi-ribbon" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">DELIVERY DATE</span>
            <span className="kpi-cell-badge badge-neutral font-mono">{selectedDate}</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num" style={{ fontSize: 17 }}>{format(parseISO(selectedDate), 'EEEE, MMMM d')}</span>
          </div>
          <div className="kpi-cell-sub">
            <span>UK SETTLEMENT CALENDAR</span>
          </div>
        </div>

        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">OUTTURN ACTUAL MEAN</span>
            <span className="kpi-cell-badge badge-actual">FUELHH</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{summaryStats?.avgActual?.toLocaleString()}</span>
            <span className="kpi-unit">MW</span>
          </div>
          <div className="kpi-cell-sub">
            <span>PEAK HOURLY OUTTURN: {summaryStats?.peakActual?.toLocaleString()} MW</span>
          </div>
        </div>

        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">INGESTED REVISIONS</span>
            <span className="kpi-cell-badge badge-forecast">WINDFOR</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num">{summaryStats?.revisionCount}</span>
            <span className="kpi-unit">CYCLES</span>
          </div>
          <div className="kpi-cell-sub">
            <span>ROLLING FORECAST UPDATES</span>
          </div>
        </div>

        <div className="kpi-cell">
          <div className="kpi-cell-top">
            <span className="kpi-cell-label">BENCHMARK GATE CLOSURE</span>
            <span className="kpi-cell-badge badge-warning">LOCKED</span>
          </div>
          <div className="kpi-cell-main">
            <span className="kpi-num" style={{ fontSize: 16 }}>11:00 UTC D-1</span>
          </div>
          <div className="kpi-cell-sub">
            <span>DECISION POINT FOR TRADERS</span>
          </div>
        </div>
      </div>

      {/* Main Multi-Revision Convergence Chart */}
      <div className="terminal-panel">
        <div className="panel-header">
          <div className="panel-title-area">
            <span className="panel-title">Forecast Evolution Across Publication Cycles vs Outturn Actual</span>
            <span className="panel-subtitle font-mono">| DELIVERY: {selectedDate} (24 HOURS)</span>
          </div>

          <div className="panel-actions">
            <div className="legend-chip">
              <span className="legend-line" style={{ background: '#10b981', height: 3 }} />
              <strong style={{ color: '#10b981' }}>ACTUAL OUTTURN</strong>
            </div>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              MUTED LINES = EARLIER REVISIONS | BRIGHT LINES = NEAR GATE CLOSURE
            </span>
          </div>
        </div>

        <div className="panel-body">
          {loading ? (
            <div className="terminal-skeleton" style={{ height: 380 }} />
          ) : error ? (
            <div style={{ color: 'var(--color-danger)', padding: 20 }}>{error}</div>
          ) : (
            <div className="chart-box-large">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <Tooltip content={<ExplorerTooltip />} />

                  {/* Render Actual Generation as heavy prominent emerald line */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual Outturn"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />

                  {/* Render each published revision */}
                  {publishTimes.map((pubTime, idx) => (
                    <Line
                      key={pubTime}
                      type="monotone"
                      dataKey={pubTime}
                      name={`Rev: ${pubTime}`}
                      stroke={PALETTE[idx % PALETTE.length]}
                      strokeWidth={idx === publishTimes.length - 1 ? 2 : 1.2}
                      strokeDasharray={idx === publishTimes.length - 1 ? '4 3' : '2 2'}
                      dot={false}
                      opacity={idx === publishTimes.length - 1 ? 1 : 0.65}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExplorerTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const actualEntry = payload.find(p => p.dataKey === 'actual');

  return (
    <div className="terminal-tooltip" style={{ maxWidth: 320 }}>
      <div className="tooltip-time">DELIVERY HOUR: {label} UTC</div>
      {actualEntry && (
        <div className="tooltip-row" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4, marginBottom: 4 }}>
          <span style={{ color: '#10b981', fontWeight: 700 }}>● ACTUAL OUTTURN:</span>
          <span className="tooltip-val" style={{ color: '#10b981' }}>{actualEntry.value?.toLocaleString()} MW</span>
        </div>
      )}
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4 }}>FORECAST REVISIONS:</div>
      {payload.filter(p => p.dataKey !== 'actual').map((p) => {
        const delta = actualEntry?.value != null ? p.value - actualEntry.value : 0;
        return (
          <div key={p.dataKey} className="tooltip-row" style={{ fontSize: 10 }}>
            <span style={{ color: p.color }}>{p.name}:</span>
            <span className="tooltip-val font-mono">
              {p.value?.toLocaleString()} MW{' '}
              <span style={{ fontSize: 9, color: delta > 0 ? 'var(--color-bias-over)' : 'var(--color-bias-under)' }}>
                ({delta > 0 ? `+${delta}` : delta})
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
