import React from 'react';
import styles from '../styles/CrowdMonitoring.module.css';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading crowd data...'
}) => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner} />
      <p className={styles.loadingText}>{message}</p>
    </div>
  );
};
