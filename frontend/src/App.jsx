import { useState, useEffect } from 'react';
import { Activity, BarChart2, Layers, ShieldCheck, Clock } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AccuracyAnalysis from './pages/AccuracyAnalysis';
import ForecastExplorer from './pages/ForecastExplorer';
import './index.css';

const TABS = [
  { id: 'dashboard', code: '01', label: 'EXECUTIVE OVERVIEW', icon: Activity },
  { id: 'accuracy', code: '02', label: 'ACCURACY MATRIX & RISK', icon: BarChart2 },
  { id: 'explorer', code: '03', label: 'REVISION EXPLORER', icon: Layers },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toUTCString().replace('GMT', 'UTC')
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Top Institutional Terminal Header */}
      <header className="terminal-header">
        <div className="terminal-header-top">
          <div className="brand-section">
            <div className="brand-logo">
              <div className="brand-icon-box">
                <ShieldCheck size={16} />
              </div>
              <span className="brand-title">WINDSIGHT</span>
            </div>
            <span className="brand-tag">UK POWER TRADING DESK · DAY-AHEAD</span>
          </div>

          <div className="market-status-bar">
            <div className="status-pill">
              <span className="beacon-dot" />
              <span className="status-meta">ELEXON BMRS:</span>
              <span className="status-value">CONNECTED (48 HH/DAY)</span>
            </div>
            <div className="status-pill">
              <span className="status-meta">GATE CLOSURE:</span>
              <span className="status-value">11:00 UTC D-1 LOCKED</span>
            </div>
            <div className="status-pill">
              <Clock size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="status-value font-mono">{currentTime || 'UTC SYNCHRONIZED'}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="terminal-nav-bar">
          <div className="segmented-nav">
            {TABS.map(({ id, code, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-tab-btn ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={13} />
                <span>{code} // {label}</span>
              </button>
            ))}
          </div>

          <div className="data-period-badge">
            DATASET: <strong style={{ color: 'var(--text-primary)' }}>FUELHH &amp; WINDFOR</strong> | JAN 2026 (744H)
          </div>
        </div>
      </header>

      {/* Main Trading Terminal Body */}
      <main className="app-container">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'accuracy' && <AccuracyAnalysis />}
        {activeTab === 'explorer' && <ForecastExplorer />}
      </main>
    </div>
  );
}
