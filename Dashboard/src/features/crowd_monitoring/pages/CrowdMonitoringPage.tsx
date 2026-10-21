import React, { useState, useEffect } from 'react';
import { EventZone, CrowdMetric, DeviceLocation, SurgeAlert, GeoPoint } from '../../../types';
import { crowdApi } from '../../../services/crowdApi';
import { CrowdMap } from '../../../components/maps/CrowdMap';
import { ZoneDrawerModal } from '../components/ZoneDrawerModal';
import { SurgeAlertBanner } from '../components/SurgeAlertBanner';
import { MapLegend } from '../components/MapLegend';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { ZoneMetricCard } from '../components/ZoneMetricCard';
import {
  Layers,
  Play,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import {
  POLLING_INTERVAL_MS,
  SIMULATION_DEFAULTS
} from '../constants/crowdConstants';
import styles from '../styles/CrowdMonitoring.module.css';

export const CrowdMonitoringPage: React.FC = () => {
  // State Management
  const [zones, setZones] = useState<EventZone[]>([]);
  const [metrics, setMetrics] = useState<CrowdMetric[]>([]);
  const [devices, setDevices] = useState<DeviceLocation[]>([]);
  const [alerts, setAlerts] = useState<SurgeAlert[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<[number, number] | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Polygon Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingVertices, setDrawingVertices] = useState<GeoPoint[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Data Fetching
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [zList, mList, dList, aList] = await Promise.all([
          crowdApi.getZones(),
          crowdApi.getCrowdMetrics(),
          crowdApi.getLiveDevices(),
          crowdApi.getAlerts(),
        ]);

        if (isMounted) {
          setZones(zList);
          setMetrics(mList);
          setDevices(dList);
          setAlerts(aList);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching crowd data:', err);
        if (isMounted) {
          setError('Failed to load crowd monitoring data. Please check your connection.');
          setIsLoading(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, POLLING_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Polygon Drawing Handlers
  const handleAddVertex = (point: GeoPoint) => {
    setDrawingVertices((prev) => [...prev, point]);
  };

  const handleFinishPolygon = () => {
    if (drawingVertices.length >= 3) {
      setIsModalOpen(true);
    } else {
      alert('Please click at least 3 points on the map to define a polygon boundary.');
    }
  };

  const handleSaveZone = async (zoneData: Partial<EventZone>) => {
    try {
      const newZone = await crowdApi.createZone(zoneData);
      setZones((prev) => [...prev, newZone]);
      setDrawingVertices([]);
      setIsDrawingMode(false);
    } catch (err) {
      console.error('Failed to create zone:', err);
      alert('Failed to create zone. Please try again.');
    }
  };

  const handleCancelDrawing = () => {
    setIsDrawingMode(false);
    setDrawingVertices([]);
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await crowdApi.resolveAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // Simulation Handlers
  const handleSimulateSurge = () => {
    const { DEVICE_COUNT, SURGE_SPEED, SURGE_HEADING, SURGE_COHERENCE, ZONE_ID, ZONE_NAME } = SIMULATION_DEFAULTS;

    const surgeDevices: DeviceLocation[] = Array.from({ length: DEVICE_COUNT }).map((_, i) => ({
      deviceId: `BAND-SIM-${i + 1}`,
      attendeeId: `ATT-${200 + i}`,
      latitude: 7.1195 + (Math.random() - 0.5) * 0.0004,
      longitude: 80.0475 + (Math.random() - 0.5) * 0.0004,
      speed: SURGE_SPEED + (Math.random() - 0.5) * 0.6,
      heading: SURGE_HEADING + (Math.random() - 0.5) * 10,
      satellites: 7,
      fixQuality: 'Valid',
      timestamp: new Date().toISOString(),
      currentZoneId: ZONE_ID,
    }));

    setDevices(surgeDevices);

    setMetrics((prev) =>
      prev.map((m) =>
        m.zoneId === ZONE_ID
          ? {
              ...m,
              deviceCount: DEVICE_COUNT,
              sampleSize: DEVICE_COUNT,
              averageSpeedKmH: SURGE_SPEED,
              dominantHeadingDeg: SURGE_HEADING,
              dominantDirectionCardinal: 'NE',
              coherenceScore: SURGE_COHERENCE,
              status: 'CRITICAL_SURGE',
              surgeDetected: true,
            }
          : m
      )
    );

    const testAlert: SurgeAlert = {
      id: `SURGE-TEST-${Date.now()}`,
      zoneId: ZONE_ID,
      zoneName: ZONE_NAME,
      type: 'CROWD_SURGE',
      severity: 'CRITICAL',
      message: `SIMULATED CROWD SURGE: ${DEVICE_COUNT} bands moving North-East (${SURGE_HEADING}°) at ${SURGE_SPEED} km/h (${(SURGE_COHERENCE * 100).toFixed(0)}% alignment)`,
      averageSpeedKmH: SURGE_SPEED,
      speedThresholdKmH: 6.0,
      dominantHeadingDeg: SURGE_HEADING,
      dominantDirectionCardinal: 'NE',
      coherenceScore: SURGE_COHERENCE,
      deviceCount: DEVICE_COUNT,
      status: 'ACTIVE',
      timestamp: new Date().toISOString(),
    };

    setAlerts((prev) => [testAlert, ...prev]);
  };

  const handleResetSimulation = () => {
    setAlerts([]);
    setDevices([]);
    setMetrics((prev) =>
      prev.map((m) => ({
        ...m,
        averageSpeedKmH: 1.5,
        coherenceScore: 0.15,
        status: 'NORMAL_DISPERSED',
        surgeDetected: false,
      }))
    );
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    window.location.reload();
  };

  // Render Loading State
  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingState message="Initializing crowd monitoring system..." />
      </div>
    );
  }

  // Render Error State
  if (error && zones.length === 0) {
    return (
      <div className={styles.container}>
        <ErrorState message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>Location & Crowd-Flow Tracking</h2>
          <p className={styles.subtitle}>
            Real-time GPS wearable tracking, digital polygon zone geofencing, crowd velocity vectors, and surge detection.
          </p>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          {isDrawingMode ? (
            <>
              <button onClick={handleFinishPolygon} className={styles.completeButton}>
                Complete Polygon ({drawingVertices.length} pts)
              </button>
              <button onClick={handleCancelDrawing} className={styles.cancelButton}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsDrawingMode(true)} className={styles.drawButton}>
              <PlusCircle size={16} />
              Draw Digital Zone
            </button>
          )}

          <button onClick={handleSimulateSurge} className={styles.simulateButton}>
            <Play size={16} />
            Simulate Surge
          </button>

          <button
            onClick={handleResetSimulation}
            className={styles.resetButton}
            title="Reset Simulation"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Critical Surge Warning Banner */}
      <SurgeAlertBanner alerts={alerts} onResolveAlert={handleResolveAlert} />

      {/* Live Wearable Telemetry Status Bar */}
      {(() => {
        const physical = devices.find(
          (d) => d.deviceId.includes('ESP32') || d.attendeeId === 'ATT-PHYSICAL-01'
        );
        if (physical) {
          const isGpsValid = physical.fixQuality === 'Valid' && physical.satellites > 0;
          return (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Live Wearable Band: <b>{physical.deviceId}</b></span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: isGpsValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: isGpsValid ? '#10b981' : '#f59e0b',
                        border: `1px solid ${isGpsValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                      }}
                    >
                      {isGpsValid ? `🛰️ Live GPS (${physical.satellites} Sats)` : '🏠 Indoor Fallback Coordinates'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                    Coordinates: <b>{physical.latitude.toFixed(6)}, {physical.longitude.toFixed(6)}</b> &bull; Zone:{' '}
                    <b>{physical.currentZoneId || 'Outside Defined Zones'}</b> &bull; Last Ping:{' '}
                    {new Date(physical.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setFocusTarget([physical.latitude, physical.longitude])}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🎯 Jump to Band on Map
              </button>
            </div>
          );
        }
        return (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(148, 163, 184, 0.08)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: '#94a3b8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📡 Waiting for ESP32 Wearable Telemetry (Ensure Backend is running and ESP32 is powered on)...</span>
            </div>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Auto-refreshes every 2s</span>
          </div>
        );
      })()}

      {/* Interactive Map */}
      <div className="fest-card" style={{ padding: '1rem' }}>
        <div className={styles.mapHeader}>
          <div className={styles.mapTitle}>
            <Layers size={18} color="#8b5cf6" />
            <h3 className={styles.mapTitleText}>Event Environment & Crowd-Flow Map</h3>
          </div>
          <MapLegend />
        </div>

        <CrowdMap
          zones={zones}
          metrics={metrics}
          devices={devices}
          isDrawingMode={isDrawingMode}
          drawingVertices={drawingVertices}
          onAddVertex={handleAddVertex}
          selectedZoneId={selectedZoneId}
          onSelectZone={setSelectedZoneId}
          focusTarget={focusTarget}
        />
      </div>

      {/* Zone Analysis Section */}
      <div className={styles.zoneAnalysisSection}>
        <h3 className={styles.sectionTitle}>
          Zone Crowd-Flow & Vector Analysis Matrix
        </h3>

        <div className={styles.zoneGrid}>
          {zones.map((zone) => {
            const metric = metrics.find((m) => m.zoneId === zone.id);
            return (
              <ZoneMetricCard
                key={zone.id}
                zone={zone}
                metric={metric}
              />
            );
          })}
        </div>
      </div>

      {/* Zone Configuration Modal */}
      <ZoneDrawerModal
        isOpen={isModalOpen}
        vertices={drawingVertices}
        onClose={() => {
          setIsModalOpen(false);
          setDrawingVertices([]);
          setIsDrawingMode(false);
        }}
        onSave={handleSaveZone}
      />
    </div>
  );
};

export default CrowdMonitoringPage;
