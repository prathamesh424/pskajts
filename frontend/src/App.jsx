import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, BarChart3, Search } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AccuracyAnalysis from './pages/AccuracyAnalysis';
import ForecastExplorer from './pages/ForecastExplorer';
import './index.css';

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: Wind },
  { id: 'accuracy', label: 'Accuracy Analysis', icon: BarChart3 },
  { id: 'explorer', label: 'Forecast Explorer', icon: Search },
];

function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'accuracy':
        return <AccuracyAnalysis />;
      case 'explorer':
        return <ForecastExplorer />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <Wind size={18} />
          </div>
          <span className="nav-brand-text">WindSight</span>
        </div>

        <div className="nav-links">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${activePage === id ? 'active' : ''}`}
              onClick={() => setActivePage(id)}
            >
              <Icon size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          January 2026 · UK Wind
        </div>
      </nav>

      {/* Page Content */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
