import React from 'react';
import { SurgeAlert } from '../../../types';
import { ShieldAlert, Compass, Gauge, Users, CheckCircle } from 'lucide-react';
import styles from '../styles/SurgeAlertBanner.module.css';

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
    <div className={styles.container}>
      {activeAlerts.map((alert) => (
        <div key={alert.id} className={styles.alertCard}>
          <div className={styles.alertContent}>
            <div className={styles.iconWrapper}>
              <ShieldAlert size={24} color="#ffffff" />
            </div>

            <div className={styles.alertInfo}>
              <div className={styles.alertHeader}>
                <span className={styles.badge}>CRITICAL SURGE WARNING</span>
                <span className={styles.timestamp}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <h4 className={styles.alertTitle}>
                {alert.zoneName}: Rapid Unidirectional Movement
              </h4>

              <p className={styles.alertMessage}>{alert.message}</p>
            </div>
          </div>

          <div className={styles.alertActions}>
            <div className={styles.metrics}>
              <div className={styles.metricItem}>
                <Compass size={16} color="#fb7185" />
                <span>
                  <b>{alert.dominantDirectionCardinal}</b> ({alert.dominantHeadingDeg}°)
                </span>
              </div>

              <div className={styles.metricItem}>
                <Gauge size={16} color="#fb7185" />
                <span>
                  <b>{alert.averageSpeedKmH} km/h</b> (limit: {alert.speedThresholdKmH})
                </span>
              </div>

              <div className={styles.metricItem}>
                <Users size={16} color="#fb7185" />
                <span><b>{alert.deviceCount}</b> bands</span>
              </div>
            </div>

            <button onClick={() => onResolveAlert(alert.id)} className={styles.resolveButton}>
              <CheckCircle size={16} />
              Resolve / Acknowledge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
