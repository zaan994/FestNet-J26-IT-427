import React from 'react';
import { Responder } from '../../../types';
import { ShieldCheck, Phone, MapPin, UserCheck, Clock } from 'lucide-react';

interface Props {
  responders: Responder[];
}

export const ResponderPage: React.FC<Props> = ({ responders }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Field Responder Fleet & Personnel</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Real-time status tracking and dispatch allocation for festival paramedics, marshals, and security teams.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {responders.map((resp) => (
          <div key={resp.id} className="fest-card">
            <div className="fest-card-header">
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{resp.name}</h4>
                <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600 }}>{resp.role}</span>
              </div>
              <span className={`fest-badge badge-${resp.status}`}>
                {resp.status.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <MapPin size={15} color="#3b82f6" />
                <span>Sector: <strong style={{ color: '#fff' }}>{resp.currentZone}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <Phone size={15} color="#10b981" />
                <span>{resp.contactNumber}</span>
              </div>
              {resp.assignedIncidentId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fb7185' }}>
                  <Clock size={15} />
                  <span>En route to Incident: <strong>{resp.assignedIncidentId}</strong></span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-sub)' }}>
              <span>ID: {resp.id}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#34d399' }}>
                <UserCheck size={13} /> Radio Verified
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
