import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import styles from '../styles/CrowdMonitoring.module.css';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Unable to load crowd monitoring data. Please check your connection.',
  onRetry
}) => {
  return (
    <div className={styles.errorContainer}>
      <AlertTriangle size={48} className={styles.errorIcon} />
      <h3 className={styles.errorTitle}>Connection Error</h3>
      <p className={styles.errorMessage}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className={styles.retryButton}>
          <RefreshCw size={16} />
          Retry Connection
        </button>
      )}
    </div>
  );
};
