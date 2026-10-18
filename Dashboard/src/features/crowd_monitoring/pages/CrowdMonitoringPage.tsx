import React from 'react';
import { ZoneData } from '../../../types';
import { Users, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Props {
  zones: ZoneData[];
}

export const CrowdMonitoringPage: React.FC<Props> = ({ zones }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Crowd Density & Capacity Matrix</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Sector-by-sector crowd distribution, bottleneck risk indices, and ingress/egress safety margins.
        </p>
      </div>

      {/* Zone Cards Detailed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {zones.map((zone) => {
          const occupancy = Math.round((zone.currentCount / zone.capacity) * 100);
          const isOvercrowded = occupancy >= 95;
          const isHigh = occupancy >= 80 && occupancy < 95;

          return (
            <div
              key={zone.id}
              className="fest-card"
              style={{
                borderColor: isOvercrowded ? 'rgba(244, 63, 94, 0.4)' : isHigh ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {isOvercrowded && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  backgroundColor: '#f43f5e'
                }} />
              )}

              <div className="fest-card-header">
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{zone.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {zone.id}</span>
                </div>
                <span className={`fest-badge badge-${zone.density}`}>
                  {zone.density}
                </span>
              </div>

              {/* Occupancy bar */}
              <div style={{ margin: '1.25rem 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Occupancy Level</span>
                  <span style={{ fontWeight: 800, color: isOvercrowded ? '#f43f5e' : isHigh ? '#f59e0b' : '#3b82f6' }}>
                    {occupancy}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '5px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min(occupancy, 100)}%`,
                    height: '100%',
                    backgroundColor: isOvercrowded ? '#f43f5e' : isHigh ? '#f59e0b' : '#3b82f6',
                    borderRadius: '5px'
                  }} />
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LIVE HEADCOUNT</span>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{zone.currentCount.toLocaleString()}</p>
                </div>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>MAX CAPACITY</span>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{zone.capacity.toLocaleString()}</p>
                </div>
              </div>

              {/* Status Alert Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: isOvercrowded ? 'rgba(244, 63, 94, 0.1)' : isHigh ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: isOvercrowded ? '#fb7185' : isHigh ? '#fbbf24' : '#34d399'
              }}>
                {isOvercrowded ? (
                  <>
                    <ShieldAlert size={16} />
                    <span>Bottleneck Risk! Recommend diverting crowd to Lawn.</span>
                  </>
                ) : isHigh ? (
                  <>
                    <AlertTriangle size={16} />
                    <span>Approaching capacity threshold (80%+).</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Flow within comfortable regulatory limits.</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
