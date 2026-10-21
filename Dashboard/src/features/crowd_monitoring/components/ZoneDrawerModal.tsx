import React, { useState } from 'react';
import { EventZone, GeoPoint, ZoneCategory } from '../../../types';
import { Layers, X, Check } from 'lucide-react';
import { ZONE_TYPE_LABELS } from '../constants/crowdConstants';
import styles from '../styles/ZoneDrawerModal.module.css';

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
      // Reset form
      setName('');
      setType('STAGE');
      setCapacity(1500);
      setSurgeThreshold(6.0);
      setColor('#8b5cf6');
      onClose();
    } catch (err) {
      console.error('Failed to create zone:', err);
      alert('Failed to create zone. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={`fest-card ${styles.modal}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Layers size={20} color="#8b5cf6" />
            <h3 className={styles.title}>Save Digital Polygon Zone</h3>
          </div>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Zone Name */}
          <div className={styles.formGroup}>
            <label htmlFor="zoneName" className={styles.label}>
              Zone Name
            </label>
            <input
              id="zoneName"
              type="text"
              required
              placeholder="e.g. VIP Lounge, South Ingress, Stage B"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Two Column Layout */}
          <div className={styles.twoColumn}>
            {/* Zone Category */}
            <div className={styles.formGroup}>
              <label htmlFor="zoneType" className={styles.label}>
                Zone Category
              </label>
              <select
                id="zoneType"
                value={type}
                onChange={(e) => setType(e.target.value as ZoneCategory)}
                className={styles.select}
              >
                {Object.entries(ZONE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Max Capacity */}
            <div className={styles.formGroup}>
              <label htmlFor="capacity" className={styles.label}>
                Max Capacity
              </label>
              <input
                id="capacity"
                type="number"
                min="50"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={styles.input}
              />
            </div>
          </div>

          {/* Two Column Layout */}
          <div className={styles.twoColumn}>
            {/* Surge Threshold */}
            <div className={styles.formGroup}>
              <label htmlFor="surgeThreshold" className={styles.label}>
                Surge Trigger Speed (km/h)
              </label>
              <input
                id="surgeThreshold"
                type="number"
                step="0.5"
                min="3.0"
                max="15.0"
                value={surgeThreshold}
                onChange={(e) => setSurgeThreshold(Number(e.target.value))}
                className={styles.input}
              />
            </div>

            {/* Polygon Color */}
            <div className={styles.formGroup}>
              <label htmlFor="color" className={styles.label}>
                Polygon Color
              </label>
              <div className={styles.colorPicker}>
                <input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className={styles.colorInput}
                />
                <span className={styles.colorValue}>{color}</span>
              </div>
            </div>
          </div>

          {/* Vertex Info */}
          <div className={styles.infoBox}>
            Boundaries: <b>{vertices.length} vertices</b> recorded from map clicks.
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className={styles.saveButton}
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
