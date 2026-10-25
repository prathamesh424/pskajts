import { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Calendar, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import { fetchForecastRevisions } from '../api';

const NOTABLE_DATES = [
  { date: '2026-01-24', label: 'Jan 24: Storm Éowyn (Peak Volatility)' },
  { date: '2026-01-08', label: 'Jan 8: High Accuracy (MAE 580 MW)' },
  { date: '2026-01-15', label: 'Jan 15: Weather Front Transition' },
  { date: '2026-01-28', label: 'Jan 28: Severe Over-Forecast' },
];

const ALL_JAN_DATES = Array.from({ length: 31 }, (_, i) => {
  const dayNum = String(i + 1).padStart(2, '0');
  return {
    value: `2026-01-${dayNum}`,
    label: `2026-01-${dayNum}`,
  };
});

/**
 * Timezone-agnostic UTC hour extractor.
 * e.g. "2026-01-08T14:00:00Z" or "2026-01-08T14:00:00+00:00" -> "14:00"
 */
function getUtcHour(isoStr) {
  if (!isoStr) return '';
  const tIdx = isoStr.indexOf('T');
  if (tIdx !== -1) {
    return isoStr.substring(tIdx + 1, tIdx + 6);
  }
  return '';
}

/**
 * Timezone-agnostic UTC label formatter.
 */
function formatUtcDateTime(isoStr) {
  if (!isoStr) return '';
  const clean = isoStr.replace('+00:00', 'Z');
  const d = new Date(clean);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hour = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hour}:${min}`;
}

export default function ForecastExplorer() {
  const [selectedDate, setSelectedDate] = useState('2026-01-08');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRevisionTime, setSelectedRevisionTime] = useState(null);
  const [showGateBenchmark, setShowGateBenchmark] = useState(true);

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  async function loadData(date) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchForecastRevisions(date);
      setData(res);

      if (res.revisions?.length) {
        const uniqueTimes = [...new Set(res.revisions.map(r => r.publish_time))].sort();

        // Calculate D-1 11:00 UTC target
        const dateParts = date.split('-');
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const dMinus1 = new Date(Date.UTC(year, month, day - 1, 11, 0, 0));
        const gateTargetISO = dMinus1.toISOString();

        const beforeGate = uniqueTimes.filter(t => t <= gateTargetISO);
        const bestGate = beforeGate.length ? beforeGate[beforeGate.length - 1] : uniqueTimes[0];
        setSelectedRevisionTime(bestGate);
      }
    } catch (err) {
      setError(err.message || 'Failed loading forecast revisions');
    } finally {
      setLoading(false);
    }
  }

  // Parse and build clean chart data
  const { chartData, revisionsMeta, gateRevisionTime } = useMemo(() => {
    if (!data || !data.revisions?.length) {
      return { chartData: [], revisionsMeta: [], gateRevisionTime: null };
    }

    const uniquePublishTimes = [...new Set(data.revisions.map(r => r.publish_time))].sort();

    // Identify Gate Closure revision: latest published <= D-1 11:00 UTC
    const dateParts = selectedDate.split('-');
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[2], 10);
    const dMinus1 = new Date(Date.UTC(year, month, day - 1, 11, 0, 0));
    const gateTargetISO = dMinus1.toISOString();

    const beforeGate = uniquePublishTimes.filter(t => t <= gateTargetISO);
    const gateTime = beforeGate.length ? beforeGate[beforeGate.length - 1] : uniquePublishTimes[0];

    // Build actuals map keyed by UTC hour "HH:00"
    const actualMap = {};
    data.actuals.forEach(a => {
      const h = getUtcHour(a.start_time);
      if (h) {
        actualMap[h] = Math.round(a.generation);
      }
    });

    // Process revision metadata
    const revsList = uniquePublishTimes.map((pTime, idx) => {
      const recordsForTime = data.revisions.filter(r => r.publish_time === pTime);
      const genVals = recordsForTime.map(r => r.generation);
      const avgGen = genVals.length ? Math.round(genVals.reduce((a, b) => a + b, 0) / genVals.length) : 0;

      // Compute MAE and Bias against actuals
      let errSum = 0;
      let biasSum = 0;
      let count = 0;
      recordsForTime.forEach(r => {
        const h = getUtcHour(r.start_time);
        if (actualMap[h] != null) {
          const diff = r.generation - actualMap[h];
          errSum += Math.abs(diff);
          biasSum += diff;
          count++;
        }
      });
      const mae = count ? Math.round(errSum / count) : 0;
      const bias = count ? Math.round(biasSum / count) : 0;
      const isGate = pTime === gateTime;

      // Delta vs previous revision
      let prevDiff = 0;
      if (idx > 0) {
        const prevRecords = data.revisions.filter(r => r.publish_time === uniquePublishTimes[idx - 1]);
        const prevAvg = prevRecords.reduce((a, b) => a + b.generation, 0) / prevRecords.length;
        prevDiff = Math.round(avgGen - prevAvg);
      }

      return {
        publishTime: pTime,
        label: formatUtcDateTime(pTime),
        avgGen,
        mae,
        bias,
        isGate,
        prevDiff,
      };
    });

    // Active revision and Gate revision map
    const activeTime = selectedRevisionTime || gateTime;
    const activeRevMap = {};
    data.revisions.filter(r => r.publish_time === activeTime).forEach(r => {
      const h = getUtcHour(r.start_time);
      if (h) activeRevMap[h] = Math.round(r.generation);
    });

    const gateRevMap = {};
    data.revisions.filter(r => r.publish_time === gateTime).forEach(r => {
      const h = getUtcHour(r.start_time);
      if (h) gateRevMap[h] = Math.round(r.generation);
    });

    // Build 24-hour chart rows
    const rows = [];
    for (let h = 0; h < 24; h++) {
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      const actualVal = actualMap[hourStr] != null ? actualMap[hourStr] : null;
      const selectedGen = activeRevMap[hourStr] != null ? activeRevMap[hourStr] : null;
      const gateGen = gateRevMap[hourStr] != null ? gateRevMap[hourStr] : null;

      rows.push({
        hour: hourStr,
        actual: actualVal,
        selectedForecast: selectedGen,
        gateForecast: gateGen,
      });
    }

    return {
      chartData: rows,
      revisionsMeta: revsList,
      gateRevisionTime: gateTime,
    };
  }, [data, selectedDate, selectedRevisionTime]);

  const currentActiveMeta = useMemo(() => {
    return revisionsMeta.find(r => r.publishTime === selectedRevisionTime) || revisionsMeta[0];
  }, [revisionsMeta, selectedRevisionTime]);

  return (
    <div>
      {/* Top Controls: Clean and uncluttered */}
      <div className="control-toolbar" style={{ marginBottom: 20 }}>
        <div className="toolbar-left">
          <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>PRESETS:</span>
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
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>DATE:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-white)',
              border: '1px solid var(--border-base)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {ALL_JAN_DATES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-Column Studio Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 20 }}>
        {/* Left Column: Focused Chart & Controls */}
        <div>
          {/* Active Revision Header Banner */}
          <div className="clean-panel" style={{ marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  ACTIVE REVISION CYCLE
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                  <span className="font-mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-white)' }}>
                    {currentActiveMeta?.label || 'Loading...'} UTC
                  </span>
                  {currentActiveMeta?.isGate && (
                    <span className="kpi-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                      GATE CLOSURE BENCHMARK (11:00 D-1)
                    </span>
                  )}
                </div>
              </div>

              {/* Stats for Active Revision */}
              <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
                <div>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>MEAN FORECAST</div>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-white)' }}>
                    {currentActiveMeta?.avgGen?.toLocaleString()} MW
                  </div>
                </div>
                <div>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>BIAS VS OUTTURN</div>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: currentActiveMeta?.bias > 0 ? '#f59e0b' : '#10b981' }}>
                    {currentActiveMeta?.bias > 0 ? `+${currentActiveMeta?.bias?.toLocaleString()}` : currentActiveMeta?.bias?.toLocaleString()} MW
                  </div>
                </div>
                <div>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>MAE</div>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-white)' }}>
                    {currentActiveMeta?.mae?.toLocaleString()} MW
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ width: 12, height: 3, background: 'var(--color-actual)', borderRadius: 1 }} />
                    <span style={{ color: 'var(--color-actual)', fontWeight: 600 }}>ACTUAL OUTTURN</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ width: 12, height: 2, background: 'var(--color-forecast)', borderTop: '2px dashed #38bdf8' }} />
                    <span style={{ color: 'var(--color-forecast)', fontWeight: 600 }}>ACTIVE REVISION</span>
                  </div>
                  {showGateBenchmark && !currentActiveMeta?.isGate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ width: 12, height: 2, background: '#f59e0b', borderTop: '2px dotted #f59e0b' }} />
                      <span style={{ color: '#f59e0b' }}>GATE CLOSURE REF</span>
                    </div>
                  )}
                </div>

                {!currentActiveMeta?.isGate && (
                  <button
                    className="filter-btn"
                    onClick={() => setShowGateBenchmark(!showGateBenchmark)}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                  >
                    {showGateBenchmark ? 'HIDE GATE REF' : 'SHOW GATE REF'}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="clean-skeleton" style={{ height: 360 }} />
              ) : error ? (
                <div style={{ color: 'var(--color-danger)', padding: 40, textAlign: 'center' }}>{error}</div>
              ) : (
                <div style={{ width: '100%', height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="actualGradClean" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        domain={[0, 'auto']}
                      />
                      <Tooltip content={<StudioTooltip />} />

                      {/* Actual Outturn Area */}
                      <Area
                        type="monotone"
                        dataKey="actual"
                        name="Actual Outturn"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#actualGradClean)"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />

                      {/* Selected Revision Line */}
                      <Line
                        type="monotone"
                        dataKey="selectedForecast"
                        name="Active Forecast"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />

                      {/* Optional Gate Benchmark */}
                      {showGateBenchmark && !currentActiveMeta?.isGate && (
                        <Line
                          type="monotone"
                          dataKey="gateForecast"
                          name="Gate Closure Ref"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="2 2"
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Revision Progression Timeline Ledger */}
        <div>
          <div className="clean-panel">
            <div className="clean-panel-header">
              <span className="panel-heading">REVISION CHRONOLOGY</span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {revisionsMeta.length} CYCLES
              </span>
            </div>

            <div style={{ maxHeight: 460, overflowY: 'auto' }}>
              {revisionsMeta.map((rev) => {
                const isSelected = rev.publishTime === (selectedRevisionTime || gateRevisionTime);
                return (
                  <div
                    key={rev.publishTime}
                    onClick={() => setSelectedRevisionTime(rev.publishTime)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--bg-subtle)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 120ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="font-mono" style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--text-white)' : 'var(--text-secondary)' }}>
                          {rev.label}
                        </span>
                        {rev.isGate && (
                          <span style={{ fontSize: 9, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '1px 4px', borderRadius: 2, fontFamily: 'var(--font-mono)' }}>
                            GATE
                          </span>
                        )}
                      </div>
                      <ChevronRight size={13} style={{ color: isSelected ? 'var(--text-white)' : 'var(--text-dim)' }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Avg: <strong style={{ color: 'var(--text-primary)' }}>{rev.avgGen.toLocaleString()} MW</strong>
                      </span>
                      <span style={{ color: rev.bias > 0 ? 'var(--color-warning)' : 'var(--color-actual)' }}>
                        MAE: {rev.mae.toLocaleString()} MW
                      </span>
                    </div>

                    {rev.prevDiff !== 0 && (
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: rev.prevDiff > 0 ? '#38bdf8' : '#a855f7', marginTop: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                        {rev.prevDiff > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        Shift: {rev.prevDiff > 0 ? `+${rev.prevDiff}` : rev.prevDiff} MW vs prior cycle
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudioTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const actual = payload.find(p => p.dataKey === 'actual')?.value;
  const forecast = payload.find(p => p.dataKey === 'selectedForecast')?.value;
  const gate = payload.find(p => p.dataKey === 'gateForecast')?.value;
  const diff = forecast != null && actual != null ? forecast - actual : 0;

  return (
    <div className="clean-tooltip">
      <div className="tooltip-title">{label} UTC</div>
      {actual != null && (
        <div className="tooltip-line">
          <span style={{ color: 'var(--color-actual)' }}>Actual:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{actual?.toLocaleString()} MW</span>
        </div>
      )}
      {forecast != null && (
        <div className="tooltip-line">
          <span style={{ color: 'var(--color-forecast)' }}>Active Rev:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{forecast?.toLocaleString()} MW</span>
        </div>
      )}
      {gate != null && (
        <div className="tooltip-line">
          <span style={{ color: '#f59e0b' }}>Gate Ref:</span>
          <span>{gate?.toLocaleString()} MW</span>
        </div>
      )}
      {forecast != null && actual != null && (
        <div className="tooltip-line" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 4, marginTop: 4 }}>
          <span style={{ color: diff > 0 ? 'var(--color-warning)' : 'var(--color-actual)' }}>
            {diff > 0 ? 'Over-forecast:' : 'Under-forecast:'}
          </span>
          <span style={{ fontWeight: 600, color: diff > 0 ? 'var(--color-warning)' : 'var(--color-actual)' }}>
            {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} MW
          </span>
        </div>
      )}
    </div>
  );
}
