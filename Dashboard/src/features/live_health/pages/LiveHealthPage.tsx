import React, { useState } from 'react';
import { VitalReading } from '../../../types';
import { Heart, Activity, Thermometer, Battery, Search, AlertCircle } from 'lucide-react';

interface Props {
  vitals: VitalReading[];
  onTriggerSimulatedVitals?: () => void;
}

export const LiveHealthPage: React.FC<Props> = ({ vitals }) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'normal'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVitals = vitals.filter(v => {
    const matchesFilter = filter === 'all' || v.status === filter;
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.attendeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.bandId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.zone.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Live Health & Vitals Telemetry</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Continuous biometric streaming from LoRa/Bluetooth wearable wristbands across festival attendees.
          </p>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {(['all', 'critical', 'warning', 'normal'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                backgroundColor: filter === f ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                color: filter === f ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <Search size={16} color="var(--text-sub)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search attendee name, Band ID, or Zone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.55rem 0.85rem 0.55rem 2.25rem',
            color: '#fff',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        />
      </div>

      {/* Grid of Vitals Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {filteredVitals.map((v) => (
          <div
            key={v.attendeeId}
            className="fest-card"
            style={{
              borderColor: v.status === 'critical' ? 'rgba(244, 63, 94, 0.5)' : v.status === 'warning' ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)',
              boxShadow: v.status === 'critical' ? '0 0 15px rgba(244, 63, 94, 0.15)' : 'none'
            }}
          >
            <div className="fest-card-header">
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{v.name}</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {v.attendeeId} • {v.bandId}
                </span>
              </div>
              <span className={`fest-badge badge-${v.status}`}>
                {v.status === 'critical' && <AlertCircle size={12} />}
                {v.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', margin: '1rem 0' }}>
              {/* Heart Rate */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '0.75rem',
                borderRadius: '8px',
                textAlign: 'center',
                border: v.heartRate > 120 ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f43f5e', marginBottom: '0.25rem' }}>
                  <Heart size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>HEART RATE</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{v.heartRate}</div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)' }}>bpm</span>
              </div>

              {/* SpO2 */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '0.75rem',
                borderRadius: '8px',
                textAlign: 'center',
                border: v.spo2 < 94 ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#06b6d4', marginBottom: '0.25rem' }}>
                  <Activity size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>SpO2</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{v.spo2}%</div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)' }}>oxygen</span>
              </div>

              {/* Body Temp */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '0.75rem',
                borderRadius: '8px',
                textAlign: 'center',
                border: v.temperature > 38.0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', color: '#f59e0b', marginBottom: '0.25rem' }}>
                  <Thermometer size={14} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>TEMP</span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{v.temperature}°C</div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)' }}>skin</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <span>Zone: <strong style={{ color: '#fff' }}>{v.zone}</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Battery size={13} color="#10b981" /> {v.battery}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
