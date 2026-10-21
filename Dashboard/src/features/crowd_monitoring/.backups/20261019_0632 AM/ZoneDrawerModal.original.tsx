import React, { useState } from 'react';
import { EventZone, GeoPoint, ZoneCategory } from '../../../types';
import { Layers, X, Check } from 'lucide-react';

interface ZoneDrawerModalProps {
  isOpen: boolean;
  vertices: GeoPoint[];
  onClose: () => void;
  onSave: (zone: Partial<EventZone>) => Promise<void>;
}

export const ZoneDrawerModal: React.FC<ZoneDrawerModalProps> = ({
  isOpen,
  vertices,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ZoneCategory>('STAGE');
  const [capacity, setCapacity] = useState(1500);
  const [surgeThreshold, setSurgeThreshold] = useState(6.0);
  const [color, setColor] = useState('#8b5cf6');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        capacity,
        surgeSpeedThresholdKmH: surgeThreshold,
        color,
        polygon: vertices,
      });
      onClose();
    } catch (err) {
      console.error('Failed to create zone:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div className="fest-card" style={{ width: '100%', maxWidth: '480px', margin: '1rem' }}>
        <div className="fest-card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="#8b5cf6" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Save Digital Polygon Zone</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Zone Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. VIP Lounge, South Ingress, Stage B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Zone Category
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ZoneCategory)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: '#1e293b',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                }}
              >
                <option value="STAGE">Stage / Arena</option>
                <option value="EXIT">Exit / Pathway</option>
                <option value="FIRST_AID">Medical Tent</option>
                <option value="RESTROOM">Restrooms</option>
                <option value="FOOD_BEVERAGE">Food Village</option>
                <option value="SECURITY">Security / Command</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Max Capacity
              </label>
              <input
                type="number"
                min="50"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Surge Trigger Speed (km/h)
              </label>
              <input
                type="number"
                step="0.5"
                min="3.0"
                max="15.0"
                value={surgeThreshold}
                onChange={(e) => setSurgeThreshold(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Polygon Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'none',
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{color}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px' }}>
            Boundaries: <b>{vertices.length} vertices</b> recorded from map clicks.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                background: '#8b5cf6',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Check size={16} />
              {isSaving ? 'Saving...' : 'Save Zone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
