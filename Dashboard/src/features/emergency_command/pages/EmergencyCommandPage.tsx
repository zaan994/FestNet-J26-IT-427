import React from 'react';
import { EmergencyAlert, Responder } from '../../../types';
import { AlertOctagon, Send, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  alerts: EmergencyAlert[];
  responders: Responder[];
  onDispatch: (alertId: string, responderName: string) => void;
  onResolve: (alertId: string) => void;
  onSimulateSOS: () => void;
}

export const EmergencyCommandPage: React.FC<Props> = ({
  alerts,
  responders,
  onDispatch,
  onResolve,
  onSimulateSOS
}) => {
  const availableResponders = responders.filter(r => r.status === 'available');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertOctagon size={28} /> Emergency Triage & Dispatch Command
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Real-time incident response management, instant paramedic dispatch, and crowd alarm coordination.
          </p>
        </div>

        <button
          onClick={onSimulateSOS}
          className="btn-danger"
          style={{ padding: '0.65rem 1.25rem' }}
        >
          <ShieldAlert size={18} />
          Trigger Simulated SOS Beacon
        </button>
      </div>

      {/* Incident List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="fest-card"
            style={{
              borderLeft: `6px solid ${
                alert.status === 'resolved'
                  ? '#10b981'
                  : alert.priority === 'critical'
                  ? '#f43f5e'
                  : '#f59e0b'
              }`,
              backgroundColor: alert.status === 'pending' ? 'rgba(244, 63, 94, 0.05)' : 'var(--bg-card)'
            }}
          >
            <div className="fest-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{alert.id}</span>
                <span className={`fest-badge badge-${alert.priority}`}>
                  {alert.priority} Priority
                </span>
                <span className={`fest-badge badge-${alert.status}`}>
                  {alert.status}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                Triggered at {alert.timestamp}
              </span>
            </div>

            <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0.5rem 0 1rem 0' }}>
              {alert.details}
            </p>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.85rem'
            }}>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Location: <strong style={{ color: '#fff' }}>{alert.zone}</strong></span>
                {alert.attendeeName && (
                  <span>Attendee: <strong style={{ color: '#fff' }}>{alert.attendeeName}</strong></span>
                )}
                {alert.assignedResponder && (
                  <span>Assigned Unit: <strong style={{ color: '#60a5fa' }}>{alert.assignedResponder}</strong></span>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {alert.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      id={`resp-select-${alert.id}`}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                      defaultValue={availableResponders[0]?.name || ''}
                    >
                      {availableResponders.map(r => (
                        <option key={r.id} value={r.name} style={{ background: '#111827' }}>
                          {r.name} ({r.role})
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const sel = document.getElementById(`resp-select-${alert.id}`) as HTMLSelectElement;
                        const resp = sel ? sel.value : 'Medic Squad Alpha';
                        onDispatch(alert.id, resp);
                      }}
                    >
                      <Send size={14} /> Dispatch
                    </button>
                  </div>
                )}

                {alert.status === 'dispatched' && (
                  <button
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    onClick={() => onResolve(alert.id)}
                  >
                    <CheckCircle2 size={14} /> Mark Incident Resolved
                  </button>
                )}

                {alert.status === 'resolved' && (
                  <span style={{ fontSize: '0.85rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={16} /> Resolved
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
