import React from 'react';
import { EventZone, CrowdMetric } from '../../../types';
import { Compass, Gauge, Users, TrendingUp, ShieldAlert, AlertTriangle } from 'lucide-react';
import { CROWD_STATUS_COLORS } from '../constants/crowdConstants';
import styles from '../styles/CrowdMonitoring.module.css';

interface ZoneMetricCardProps {
  zone: EventZone;
  metric?: CrowdMetric;
}

export const ZoneMetricCard: React.FC<ZoneMetricCardProps> = ({ zone, metric }) => {
  const isSurge = metric?.status === 'CRITICAL_SURGE';
  const isElevated = metric?.status === 'ELEVATED_FLOW';
  const isCoordinated = metric?.status === 'COORDINATED_FLOW';

  const statusColor = metric?.status
    ? CROWD_STATUS_COLORS[metric.status]
    : CROWD_STATUS_COLORS.NORMAL_STATIC;

  const getStatusIndicatorClass = () => {
    if (isSurge) return styles.surge;
    if (isElevated) return styles.elevated;
    if (isCoordinated) return styles.coordinated;
    return styles.normal;
  };

  const getCardClass = () => {
    const classes = [styles.zoneCard];
    if (isSurge) classes.push(styles.surge);
    if (isElevated) classes.push(styles.elevated);
    return classes.join(' ');
  };

  const getTopBorderColor = () => {
    if (isSurge) return '#ef4444';
    if (isElevated) return '#f59e0b';
    return zone.color || '#3b82f6';
  };

  const getBadgeStyle = () => ({
    backgroundColor: statusColor.bg,
    color: statusColor.text,
  });

  const occupancy = Math.round(((metric?.deviceCount || 0) / zone.capacity) * 100);

  return (
    <div className={getCardClass()}>
      {/* Top Border Indicator */}
      <div
        className={styles.zoneTopBorder}
        style={{ backgroundColor: getTopBorderColor() }}
      />

      {/* Header */}
      <div className={styles.zoneCardHeader}>
        <div className={styles.zoneInfo}>
          <h4>{zone.name}</h4>
          <span className={styles.zoneType}>Type: {zone.type}</span>
        </div>

        <span className={styles.zoneBadge} style={getBadgeStyle()}>
          {metric?.status || 'NORMAL_STATIC'}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>
            <Compass size={13} />
            <span>DOMINANT FLOW</span>
          </div>
          <p className={styles.metricValue}>
            {metric
              ? `${metric.dominantDirectionCardinal} (${metric.dominantHeadingDeg}°)`
              : 'Static'}
          </p>
        </div>

        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>
            <Gauge size={13} />
            <span>AVG VELOCITY</span>
          </div>
          <p className={`${styles.metricValue} ${isSurge ? styles.critical : ''}`}>
            {metric?.averageSpeedKmH || 0} km/h
          </p>
        </div>

        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>
            <TrendingUp size={13} />
            <span>COHERENCE (R)</span>
          </div>
          <p className={styles.metricValue}>
            {metric ? `${(metric.coherenceScore * 100).toFixed(0)}%` : '0%'}
          </p>
        </div>

        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>
            <Users size={13} />
            <span>BANDS IN ZONE</span>
          </div>
          <p className={styles.metricValue}>
            {metric?.deviceCount || 0} active
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className={styles.zoneFooterInfo}>
        <span>
          Surge Threshold: <b>{zone.surgeSpeedThresholdKmH} km/h</b>
        </span>
        <span>
          Capacity: <b>{zone.capacity}</b>
        </span>
      </div>

      {/* Status Evaluation */}
      <div className={`${styles.statusIndicator} ${getStatusIndicatorClass()}`}>
        {isSurge ? (
          <>
            <ShieldAlert size={15} />
            <span><b>SURGE DETECTED!</b> Rapid crowd displacement.</span>
          </>
        ) : isElevated ? (
          <>
            <AlertTriangle size={15} />
            <span>Elevated velocity approaching trigger threshold.</span>
          </>
        ) : isCoordinated ? (
          <>
            <Compass size={15} />
            <span>Synchronized migration toward {metric?.dominantDirectionCardinal}.</span>
          </>
        ) : (
          <span>Normal dispersed movement within safe parameters.</span>
        )}
      </div>
    </div>
  );
};
