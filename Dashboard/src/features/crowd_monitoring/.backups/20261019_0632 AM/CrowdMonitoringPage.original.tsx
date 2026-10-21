import React, { useState, useEffect } from 'react';
import { EventZone, CrowdMetric, DeviceLocation, SurgeAlert, GeoPoint } from '../../../types';
import { crowdApi } from '../../../services/crowdApi';
import { CrowdMap } from '../../../components/maps/CrowdMap';
import { ZoneDrawerModal } from '../components/ZoneDrawerModal';
import { SurgeAlertBanner } from '../components/SurgeAlertBanner';
import {
  Layers,
  Compass,
  Gauge,
  Users,
  ShieldAlert,
  AlertTriangle,
  Play,
  RotateCcw,
  PlusCircle,
  TrendingUp,
} from 'lucide-react';

export const CrowdMonitoringPage: React.FC = () => {
  const [zones, setZones] = useState<EventZone[]>([]);
  const [metrics, setMetrics] = useState<CrowdMetric[]>([]);
  const [devices, setDevices] = useState<DeviceLocation[]>([]);
  const [alerts, setAlerts] = useState<SurgeAlert[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Polygon Drawing Mode State
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingVertices, setDrawingVertices] = useState<GeoPoint[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initial load & Polling loop (every 2.5 seconds)
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
        }
      } catch (err) {
        console.error('Error fetching crowd data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handler for adding vertices while drawing on map
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
    const newZone = await crowdApi.createZone(zoneData);
    setZones((prev) => [...prev, newZone]);
    setDrawingVertices([]);
    setIsDrawingMode(false);
  };

  const handleResolveAlert = async (alertId: string) => {
    await crowdApi.resolveAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Local Scenario Simulation: Stampede Surge Test
  const handleSimulateSurge = () => {
    // Generate 10 devices in Main Stage moving rapidly toward North-East (45 deg) at 8.4 km/h
    const surgeDevices: DeviceLocation[] = Array.from({ length: 10 }).map((_, i) => ({
      deviceId: `BAND-SIM-${i + 1}`,
      attendeeId: `ATT-${200 + i}`,
      latitude: 7.1195 + (Math.random() - 0.5) * 0.0004,
      longitude: 80.0475 + (Math.random() - 0.5) * 0.0004,
      speed: 8.4 + (Math.random() - 0.5) * 0.6,
      heading: 45 + (Math.random() - 0.5) * 10,
      satellites: 7,
      fixQuality: 'Valid',
      timestamp: new Date().toISOString(),
      currentZoneId: 'ZONE-MAIN-STAGE',
    }));

    setDevices(surgeDevices);

    // Update metrics with surge
    setMetrics((prev) =>
      prev.map((m) =>
        m.zoneId === 'ZONE-MAIN-STAGE'
          ? {
              ...m,
              deviceCount: 10,
              sampleSize: 10,
              averageSpeedKmH: 8.4,
              dominantHeadingDeg: 45.0,
              dominantDirectionCardinal: 'NE',
              coherenceScore: 0.985,
              status: 'CRITICAL_SURGE',
              surgeDetected: true,
            }
          : m
      )
    );

    const testAlert: SurgeAlert = {
      id: `SURGE-TEST-${Date.now()}`,
      zoneId: 'ZONE-MAIN-STAGE',
      zoneName: 'Main Stage Arena',
      type: 'CROWD_SURGE',
      severity: 'CRITICAL',
      message: 'SIMULATED CROWD SURGE: 10 bands moving North-East (45°) at 8.4 km/h (98% alignment)',
      averageSpeedKmH: 8.4,
      speedThresholdKmH: 6.0,
      dominantHeadingDeg: 45.0,
      dominantDirectionCardinal: 'NE',
      coherenceScore: 0.985,
      deviceCount: 10,
      status: 'ACTIVE',
      timestamp: new Date().toISOString(),
    };

    setAlerts((prev) => [testAlert, ...prev]);
  };

  // Reset to normal dispersed state
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header with Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 4px' }}>
            Location & Crowd-Flow Tracking
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            Real-time GPS wearable tracking, digital polygon zone geofencing, crowd velocity vectors, and surge detection.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isDrawingMode ? (
            <>
              <button
                onClick={handleFinishPolygon}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Complete Polygon ({drawingVertices.length} pts)
              </button>
              <button
                onClick={() => {
                  setIsDrawingMode(false);
                  setDrawingVertices([]);
                }}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsDrawingMode(true)}
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#a78bfa',
                border: '1px solid #8b5cf6',
                borderRadius: '6px',
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <PlusCircle size={16} />
              Draw Digital Zone
            </button>
          )}

          {/* Quick Simulation Trigger Buttons */}
          <button
            onClick={handleSimulateSurge}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Play size={16} />
            Simulate Surge
          </button>

          <button
            onClick={handleResetSimulation}
            title="Reset Simulation"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Critical Surge Warning Banner */}
      <SurgeAlertBanner alerts={alerts} onResolveAlert={handleResolveAlert} />

      {/* Interactive OpenStreetMap Leaflet Container */}
      <div className="fest-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="#8b5cf6" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Event Environment & Crowd-Flow Map</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>🔵 Walking (&lt; 6 km/h)</span>
            <span>🔴 High Speed (&ge; 6 km/h)</span>
            <span>⬆ Flow Direction Arrow</span>
          </div>
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
        />
      </div>

      {/* Sector-by-Sector Crowd Vector & Safety Matrix */}
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>
          Zone Crowd-Flow & Vector Analysis Matrix
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {zones.map((zone) => {
            const metric = metrics.find((m) => m.zoneId === zone.id);
            const isSurge = metric?.status === 'CRITICAL_SURGE';
            const isElevated = metric?.status === 'ELEVATED_FLOW';
            const isCoordinated = metric?.status === 'COORDINATED_FLOW';

            const occupancy = Math.round(((metric?.deviceCount || 0) / zone.capacity) * 100);

            return (
              <div
                key={zone.id}
                className="fest-card"
                style={{
                  borderColor: isSurge ? '#ef4444' : isElevated ? '#f59e0b' : 'var(--border-color)',
                  borderWidth: isSurge ? '2px' : '1px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top border indicator */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  backgroundColor: isSurge ? '#ef4444' : isElevated ? '#f59e0b' : zone.color || '#3b82f6',
                }} />

                <div className="fest-card-header" style={{ marginTop: '4px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{zone.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Type: {zone.type}</span>
                  </div>

                  <span
                    className="fest-badge"
                    style={{
                      backgroundColor: isSurge ? 'rgba(239, 68, 68, 0.2)' : isElevated ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: isSurge ? '#f87171' : isElevated ? '#fbbf24' : '#60a5fa',
                      fontWeight: 800,
                      fontSize: '0.7rem',
                    }}
                  >
                    {metric?.status || 'NORMAL_STATIC'}
                  </span>
                </div>

                {/* Research Metric: Average Vector & Flow Direction */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  margin: '1rem 0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <Compass size={13} />
                      DOMINANT FLOW
                    </div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0' }}>
                      {metric ? `${metric.dominantDirectionCardinal} (${metric.dominantHeadingDeg}°)` : 'Static'}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <Gauge size={13} />
                      AVG VELOCITY
                    </div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0', color: isSurge ? '#f87171' : 'inherit' }}>
                      {metric?.averageSpeedKmH || 0} km/h
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <TrendingUp size={13} />
                      COHERENCE (R)
                    </div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0' }}>
                      {metric ? `${(metric.coherenceScore * 100).toFixed(0)}%` : '0%'}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <Users size={13} />
                      BANDS IN ZONE
                    </div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: '2px 0 0' }}>
                      {metric?.deviceCount || 0} active
                    </p>
                  </div>
                </div>

                {/* Surge Threshold Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <span>Surge Threshold: <b>{zone.surgeSpeedThresholdKmH} km/h</b></span>
                  <span>Capacity: <b>{zone.capacity}</b></span>
                </div>

                {/* Status Evaluation Footer */}
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isSurge
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isElevated
                    ? 'rgba(245, 158, 11, 0.15)'
                    : isCoordinated
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(16, 185, 129, 0.1)',
                  color: isSurge ? '#fca5a5' : isElevated ? '#fde68a' : isCoordinated ? '#bfdbfe' : '#a7f3d0',
                }}>
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
                    <>
                      <span>Normal dispersed movement within safe parameters.</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Polygon Zone Configuration Modal */}
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
