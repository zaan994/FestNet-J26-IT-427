import React from 'react';
import { VitalReading, ZoneData, EmergencyAlert, Responder } from '../../../types';
import { Users, HeartPulse, AlertOctagon, ShieldCheck, Thermometer, ArrowUpRight } from 'lucide-react';

interface Props {
  zones: ZoneData[];
  vitals: VitalReading[];
  alerts: EmergencyAlert[];
  responders: Responder[];
  onNavigateTab: (tab: string) => void;
}

export const OverviewPage: React.FC<Props> = ({
  zones,
  vitals,
  alerts,
  responders,
  onNavigateTab
}) => {
  const totalAttendees = zones.reduce((acc, z) => acc + z.currentCount, 0);
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);
  const activeAlerts = alerts.filter(a => a.status !== 'resolved');
  const criticalVitals = vitals.filter(v => v.status === 'critical' || v.status === 'warning');
  const availableResponders = responders.filter(r => r.status === 'available');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2), rgba(124, 58, 237, 0.15))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '16px',
        padding: '1.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            Event Operations Command & Health Matrix
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Real-time telemetry aggregation from wearable IoT wristbands, environmental sensors, and crowd beacons.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => onNavigateTab('emergency')}
            className="btn-danger"
          >
            <AlertOctagon size={16} />
            Emergency Center ({activeAlerts.length})
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div className="fest-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="fest-card-header">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL FESTIVAL CROWD</span>
            <Users size={18} color="#3b82f6" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totalAttendees.toLocaleString()}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
            Capacity: {Math.round((totalAttendees / totalCapacity) * 100)}% ({totalCapacity.toLocaleString()} max)
          </span>
        </div>

        <div className="fest-card" style={{ borderLeft: '4px solid #f43f5e' }}>
          <div className="fest-card-header">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>VITALS AT RISK</span>
            <HeartPulse size={18} color="#f43f5e" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f43f5e' }}>
            {criticalVitals.length} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>bands</span>
          </p>
          <span style={{ fontSize: '0.75rem', color: '#fb7185' }}>
            1 critical tachycardia & SpO2 alert
          </span>
        </div>

        <div className="fest-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="fest-card-header">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTIVE INCIDENTS</span>
            <AlertOctagon size={18} color="#f59e0b" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>{activeAlerts.length}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            1 SOS Button Pressed, 1 Overcrowding
          </span>
        </div>

        <div className="fest-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="fest-card-header">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>FIELD RESPONDERS</span>
            <ShieldCheck size={18} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
            {availableResponders.length} / {responders.length}
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            1 unit currently dispatched
          </span>
        </div>
      </div>

      {/* Grid: Zone Live Density & Recent Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
        {/* Zone Overview */}
        <div className="fest-card">
          <div className="fest-card-header">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Festival Zones & Crowd Status</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live capacity and thermal monitoring per sector</p>
            </div>
            <button
              onClick={() => onNavigateTab('crowd')}
              style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              Detailed Map <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            {zones.map((zone) => {
              const fillPct = Math.round((zone.currentCount / zone.capacity) * 100);
              return (
                <div key={zone.id} style={{
                  padding: '0.9rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{zone.name}</span>
                    <span className={`fest-badge badge-${zone.density}`}>
                      {zone.density.toUpperCase()}
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    margin: '0.5rem 0'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(fillPct, 100)}%`,
                      backgroundColor: fillPct > 90 ? '#f43f5e' : fillPct > 75 ? '#f59e0b' : '#3b82f6',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{zone.currentCount.toLocaleString()} / {zone.capacity.toLocaleString()} Attendees ({fillPct}%)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Thermometer size={13} /> {zone.temperature}°C (Heat Index: {zone.heatIndex}°C)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Emergency Dispatch Queue */}
        <div className="fest-card">
          <div className="fest-card-header">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Priority Emergency Feed</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live distress triggers requiring action</p>
            </div>
            <span className="live-pulse"></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{
                padding: '0.85rem',
                borderRadius: '8px',
                backgroundColor: alert.priority === 'critical' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                borderLeft: `4px solid ${alert.priority === 'critical' ? '#f43f5e' : '#f59e0b'}`,
                borderTop: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                borderBottom: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{alert.id} • {alert.type.replace('_', ' ')}</span>
                  <span className={`fest-badge badge-${alert.status}`}>{alert.status}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  {alert.details}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-sub)' }}>
                  <span>Zone: {alert.zone}</span>
                  <span>{alert.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
