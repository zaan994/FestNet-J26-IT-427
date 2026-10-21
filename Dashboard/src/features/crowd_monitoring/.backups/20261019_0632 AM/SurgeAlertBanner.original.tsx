import React from 'react';
import { SurgeAlert } from '../../../types';
import { ShieldAlert, Compass, Gauge, Users, CheckCircle } from 'lucide-react';

interface SurgeAlertBannerProps {
  alerts: SurgeAlert[];
  onResolveAlert: (id: string) => void;
}

export const SurgeAlertBanner: React.FC<SurgeAlertBannerProps> = ({
  alerts,
  onResolveAlert,
}) => {
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');

  if (activeAlerts.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
      {activeAlerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            animation: 'pulse 2s infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <ShieldAlert size={24} color="#ffffff" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                }}>
                  CRITICAL SURGE WARNING
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '4px 0 2px' }}>
                {alert.zoneName}: Rapid Unidirectional Movement
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#fca5a5', margin: 0 }}>
                {alert.message}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Compass size={16} color="#fb7185" />
                <span><b>{alert.dominantDirectionCardinal}</b> ({alert.dominantHeadingDeg}°)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Gauge size={16} color="#fb7185" />
                <span><b>{alert.averageSpeedKmH} km/h</b> (limit: {alert.speedThresholdKmH})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={16} color="#fb7185" />
                <span><b>{alert.deviceCount}</b> bands</span>
              </div>
            </div>

            <button
              onClick={() => onResolveAlert(alert.id)}
              style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle size={16} />
              Resolve / Acknowledge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
