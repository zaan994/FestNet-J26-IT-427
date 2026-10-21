import React from 'react';
import { ArrowUp } from 'lucide-react';
import styles from '../styles/CrowdMonitoring.module.css';

interface LegendItemProps {
  type: 'dot' | 'icon';
  color?: 'blue' | 'red';
  icon?: React.ReactNode;
  label: string;
  condition?: string;
}

const LegendItem: React.FC<LegendItemProps> = ({ type, color, icon, label, condition }) => {
  return (
    <span className={styles.legendItem}>
      {type === 'dot' && color && (
        <span className={`${styles.legendDot} ${styles[color]}`} />
      )}
      {type === 'icon' && (
        <span className={styles.legendIcon}>{icon}</span>
      )}
      <span>
        {label}
        {condition && ` (${condition})`}
      </span>
    </span>
  );
};

export const MapLegend: React.FC = () => {
  return (
    <div className={styles.mapLegend}>
      <LegendItem
        type="dot"
        color="blue"
        label="Walking"
        condition="< 6 km/h"
      />
      <LegendItem
        type="dot"
        color="red"
        label="High Speed"
        condition="≥ 6 km/h"
      />
      <LegendItem
        type="icon"
        icon={<ArrowUp size={14} />}
        label="Flow Direction"
      />
    </div>
  );
};
