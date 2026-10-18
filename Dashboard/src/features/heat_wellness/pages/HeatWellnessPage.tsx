import React from 'react';
import { ZoneData } from '../../../types';
import { Sun, Droplets, Thermometer, AlertCircle, ShieldAlert } from 'lucide-react';

interface Props {
  zones: ZoneData[];
}

export const HeatWellnessPage: React.FC<Props> = ({ zones }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Heat Stress & Environmental Wellness</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Monitoring Wet Bulb Globe Temperature (WBGT), solar radiation, and humidity to mitigate attendee heat exhaustion.
        </p>
      </div>

      {/* Heat Index Advisory Banner */}
      <div style={{
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '0.75rem', borderRadius: '10px' }}>
          <Sun size={28} color="#fbbf24" />
        </div>
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fbbf24' }}>
            High Heat Advisory: EDM Tent & Main Stage
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Ambient heat index has reached 42.1°C inside the EDM Tent due to enclosed crowd body thermal emission. Automated misting fans and water refill stations are active.
          </p>
        </div>
      </div>

      {/* Grid of Zone Thermal Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {zones.map((zone) => {
          const isDanger = zone.heatIndex > 40;
          const isWarning = zone.heatIndex > 35 && zone.heatIndex <= 40;

          return (
            <div key={zone.id} className="fest-card">
              <div className="fest-card-header">
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{zone.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sector Environmental Node</span>
                </div>
                <span className={`fest-badge ${isDanger ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-safe'}`}>
                  {isDanger ? 'DANGER' : isWarning ? 'CAUTION' : 'NORMAL'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', margin: '1.25rem 0' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f59e0b', marginBottom: '0.25rem' }}>
                    <Thermometer size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>AMBIENT</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{zone.temperature}°C</div>
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#06b6d4', marginBottom: '0.25rem' }}>
                    <Droplets size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>HUMIDITY</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{zone.humidity}%</div>
                </div>

                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f43f5e', marginBottom: '0.25rem' }}>
                    <Sun size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>HEAT INDEX</span>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{zone.heatIndex}°C</div>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isDanger ? (
                  <span style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldAlert size={14} /> Risk of heat exhaustion or heat stroke with prolonged exposure.
                  </span>
                ) : (
                  <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertCircle size={14} /> Thermal conditions within standard outdoor safety limits.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
