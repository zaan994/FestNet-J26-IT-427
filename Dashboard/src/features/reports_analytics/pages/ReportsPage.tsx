import React from 'react';
import { BarChart3, TrendingUp, AlertCircle, HeartHandshake, Download } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Incident Reports & Telemetry Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Historical health trends, peak crowd density distributions, and paramedic response efficiency metrics.
          </p>
        </div>

        <button className="btn-primary">
          <Download size={16} /> Export Shift Incident Report (PDF)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <div className="fest-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVG PARAMEDIC RESPONSE TIME</span>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.5rem' }}>2.4 min</p>
          <span style={{ fontSize: '0.75rem', color: '#34d399' }}>↓ 35% faster than conventional radio dispatch</span>
        </div>

        <div className="fest-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL RESOLVED INCIDENTS</span>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.5rem' }}>47</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Over last 12 hours of festival</span>
        </div>

        <div className="fest-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>HEAT STROKE PREVENTIONS</span>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.5rem' }}>19</p>
          <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Automated early vitals warnings triggered</span>
        </div>

        <div className="fest-card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>PEAK FESTIVAL OCCUPANCY</span>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: '#8b5cf6', marginTop: '0.5rem' }}>22,480</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Occurred at 19:30 during DJ headliner</span>
        </div>
      </div>

      {/* Hourly Trend Visualizer */}
      <div className="fest-card">
        <div className="fest-card-header">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Peak Crowd Density vs. Medical Incident Correlation</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last 8 Hours (13:00 - 20:00)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', height: '200px', padding: '1rem 0' }}>
          {[
            { hour: '13:00', density: 35, incidents: 1 },
            { hour: '14:00', density: 45, incidents: 2 },
            { hour: '15:00', density: 60, incidents: 4 },
            { hour: '16:00', density: 72, incidents: 6 },
            { hour: '17:00', density: 85, incidents: 9 },
            { hour: '18:00', density: 92, incidents: 14 },
            { hour: '19:00', density: 98, incidents: 18 },
            { hour: '20:00', density: 95, incidents: 12 },
          ].map((bar, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.7rem', color: '#fb7185', marginBottom: '0.25rem', fontWeight: 700 }}>{bar.incidents} emg</span>
              <div style={{
                width: '100%',
                maxHeight: `${bar.density * 1.5}px`,
                height: `${bar.density}%`,
                background: bar.density > 80 ? 'linear-gradient(180deg, #f43f5e, #be123c)' : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.3s ease'
              }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{bar.hour}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
