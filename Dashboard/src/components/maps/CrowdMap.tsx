import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EventZone, CrowdMetric, DeviceLocation, GeoPoint } from '../../types';

interface CrowdMapProps {
  zones: EventZone[];
  metrics: CrowdMetric[];
  devices: DeviceLocation[];
  isDrawingMode: boolean;
  drawingVertices: GeoPoint[];
  onAddVertex: (point: GeoPoint) => void;
  selectedZoneId?: string | null;
  onSelectZone: (zoneId: string) => void;
  onDeleteZone?: (zoneId: string) => void;
  focusTarget?: [number, number] | null;
}

// Controller to fly smoothly to selected device or coordinate
const MapViewController: React.FC<{
  targetLocation?: [number, number] | null;
}> = ({ targetLocation }) => {
  const map = useMap();
  useEffect(() => {
    if (targetLocation && !isNaN(targetLocation[0]) && !isNaN(targetLocation[1])) {
      map.flyTo(targetLocation, 17, { duration: 1.2 });
    }
  }, [targetLocation, map]);
  return null;
};

// Map click handler when drawing custom digital polygon zones
const DrawingHandler: React.FC<{
  isDrawingMode: boolean;
  onAddVertex: (point: GeoPoint) => void;
}> = ({ isDrawingMode, onAddVertex }) => {
  useMapEvents({
    click(e) {
      if (isDrawingMode) {
        onAddVertex({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

// Calculate polygon centroid to anchor directional flow vector arrow
function calculateCentroid(points: GeoPoint[]): [number, number] {
  if (!points || points.length === 0) return [7.1192, 80.0474];
  let sumLat = 0;
  let sumLng = 0;
  for (const pt of points) {
    sumLat += pt.lat;
    sumLng += pt.lng;
  }
  return [sumLat / points.length, sumLng / points.length];
}

// Custom DivIcon for Wearable Device dot
function createDeviceIcon(speed: number, heading: number, isSelected: boolean, isPhysical: boolean = false) {
  const isMoving = speed >= 1.0;
  const color = isPhysical ? '#6366f1' : (speed >= 6.0 ? '#ef4444' : isMoving ? '#3b82f6' : '#10b981');
  const size = isPhysical ? 22 : 18;

  return L.divIcon({
    className: 'custom-device-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 10px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
      ">
        ${isPhysical ? `
          <div style="
            position: absolute;
            top: -5px;
            left: -5px;
            right: -5px;
            bottom: -5px;
            border: 2px solid ${color};
            border-radius: 50%;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            opacity: 0.6;
          "></div>
        ` : ''}
        ${isMoving ? `
          <div style="
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-bottom: 7px solid #ffffff;
            margin-top: -3px;
          "></div>
        ` : `<div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>`}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Custom DivIcon for Dominant Flow Vector Arrow over Zone Centroid
function createFlowVectorIcon(headingDeg: number, speedKmH: number, coherence: number, status: string) {
  const isSurge = status === 'CRITICAL_SURGE';
  const isElevated = status === 'ELEVATED_FLOW';
  const bgColor = isSurge ? '#ef4444' : isElevated ? '#f59e0b' : '#6366f1';
  const pulseClass = isSurge ? 'animate-pulse' : '';

  return L.divIcon({
    className: `flow-vector-marker ${pulseClass}`,
    html: `
      <div style="
        background: rgba(15, 23, 42, 0.9);
        border: 2px solid ${bgColor};
        border-radius: 20px;
        padding: 4px 8px;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.5);
        white-space: nowrap;
      ">
        <div style="
          transform: rotate(${headingDeg}deg);
          display: inline-block;
          font-size: 14px;
          color: ${bgColor};
          font-weight: 900;
        ">⬆</div>
        <span>${speedKmH} km/h</span>
        <span style="opacity: 0.7; font-size: 9px;">(${(coherence * 100).toFixed(0)}% align)</span>
      </div>
    `,
    iconSize: [110, 26],
    iconAnchor: [55, 13],
  });
}

export const CrowdMap: React.FC<CrowdMapProps> = ({
  zones,
  metrics,
  devices,
  isDrawingMode,
  drawingVertices,
  onAddVertex,
  selectedZoneId,
  onSelectZone,
  onDeleteZone,
  focusTarget,
}) => {
  // Center around event location
  const center: [number, number] = [7.1192, 80.0474];
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const [activeTarget, setActiveTarget] = useState<[number, number] | null>(null);

  // Sync external focusTarget if passed
  useEffect(() => {
    if (focusTarget) {
      setActiveTarget(focusTarget);
    }
  }, [focusTarget]);

  const physicalDevice = devices.find(
    (d) => d.deviceId.includes('ESP32') || d.attendeeId === 'ATT-PHYSICAL-01'
  ) || (devices.length > 0 ? devices[0] : null);

  const handleFocusDevice = () => {
    if (physicalDevice) {
      setActiveTarget([physicalDevice.latitude, physicalDevice.longitude]);
    }
  };

  const handleResetCenter = () => {
    setActiveTarget([center[0], center[1]]);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* Map layer switcher & Focus controls */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '4px',
        display: 'flex',
        gap: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
        {physicalDevice && (
          <button
            onClick={handleFocusDevice}
            title="Pan directly to your ESP32 Wearable Band"
            style={{
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: '1px solid #6366f1',
              cursor: 'pointer',
              backgroundColor: '#6366f1',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            🎯 Focus Band ({physicalDevice.deviceId})
          </button>
        )}
        <button
          onClick={handleResetCenter}
          title="Center on Festival Grounds"
          style={{
            padding: '5px 10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: '#ffffff',
          }}
        >
          🏟️ Venue
        </button>
        <button
          onClick={() => setMapLayer('streets')}
          style={{
            padding: '5px 10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: mapLayer === 'streets' ? '#8b5cf6' : 'transparent',
            color: '#ffffff',
          }}
        >
          🗺️ Streets
        </button>
        <button
          onClick={() => setMapLayer('satellite')}
          style={{
            padding: '5px 10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: mapLayer === 'satellite' ? '#8b5cf6' : 'transparent',
            color: '#ffffff',
          }}
        >
          🛰️ Satellite
        </button>
      </div>

      {/* Map drawing notification banner */}
      {isDrawingMode && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: '#8b5cf6',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>📍 Click on map to add polygon corners ({drawingVertices.length} points defined)</span>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={17}
        style={{ width: '100%', height: '100%', background: '#0b0f17' }}
      >
        <MapViewController targetLocation={activeTarget} />
        <DrawingHandler isDrawingMode={isDrawingMode} onAddVertex={onAddVertex} />

        {/* 100% Free Tile Layers (Zero API Key Required) */}
        {mapLayer === 'streets' ? (
          <TileLayer
            key="osm-streets"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        ) : (
          <TileLayer
            key="esri-satellite"
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        )}

        {/* Render Saved Digital Polygon Zones */}
        {zones.map((zone) => {
          const positions: [number, number][] = zone.polygon.map((p) => [p.lat, p.lng]);
          const isSelected = selectedZoneId === zone.id;
          const metric = metrics.find((m) => m.zoneId === zone.id);
          const isSurge = metric?.surgeDetected;

          return (
            <React.Fragment key={zone.id}>
              <Polygon
                positions={positions}
                pathOptions={{
                  color: isSurge ? '#ef4444' : isSelected ? '#a855f7' : zone.color || '#3b82f6',
                  fillColor: isSurge ? '#ef4444' : zone.color || '#3b82f6',
                  fillOpacity: isSurge ? 0.45 : isSelected ? 0.35 : 0.2,
                  weight: isSurge ? 4 : isSelected ? 3 : 2,
                  dashArray: isSurge ? '6, 6' : undefined,
                }}
                eventHandlers={{
                  click: () => onSelectZone(zone.id),
                }}
              >
                <Popup>
                  <div style={{ color: '#0f172a', minWidth: '180px' }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>{zone.name}</h4>
                    <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#64748b' }}>Type: {zone.type} | ID: {zone.id}</p>
                    <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                      <div><b>Surge Limit:</b> {zone.surgeSpeedThresholdKmH} km/h</div>
                      <div><b>Capacity:</b> {zone.capacity} attendees</div>
                      {metric && (
                        <>
                          <div style={{ marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                            <b>Active Bands:</b> {metric.deviceCount}
                          </div>
                          <div><b>Dominant Flow:</b> {metric.dominantDirectionCardinal} ({metric.dominantHeadingDeg}°)</div>
                          <div><b>Avg Speed:</b> {metric.averageSpeedKmH} km/h</div>
                          <div><b>Alignment:</b> {(metric.coherenceScore * 100).toFixed(0)}%</div>
                        </>
                      )}
                    </div>
                    {onDeleteZone && (
                      <button
                        onClick={() => onDeleteZone(zone.id)}
                        style={{
                          marginTop: '8px',
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          width: '100%',
                        }}
                      >
                        🗑️ Delete Zone
                      </button>
                    )}
                  </div>
                </Popup>
              </Polygon>

              {/* Render Dominant Crowd Vector Arrow over Zone Centroid */}
              {metric && metric.sampleSize >= 3 && metric.averageSpeedKmH >= 1.0 && (
                <Marker
                  position={calculateCentroid(zone.polygon)}
                  icon={createFlowVectorIcon(
                    metric.dominantHeadingDeg,
                    metric.averageSpeedKmH,
                    metric.coherenceScore,
                    metric.status
                  )}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Live Temporary Drawing Polygon Preview */}
        {isDrawingMode && drawingVertices.length > 0 && (
          <Polygon
            positions={drawingVertices.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: '#8b5cf6',
              fillColor: '#8b5cf6',
              fillOpacity: 0.3,
              weight: 2,
              dashArray: '4, 4',
            }}
          />
        )}

        {/* Render Live Device Markers */}
        {devices.map((device) => {
          const isPhysical = device.deviceId.includes('ESP32') || device.attendeeId === 'ATT-PHYSICAL-01';
          return (
            <Marker
              key={device.deviceId}
              position={[device.latitude, device.longitude]}
              icon={createDeviceIcon(device.speed, device.heading, false, isPhysical)}
            >
              <Popup>
                <div style={{ color: '#0f172a', fontSize: '0.82rem', minWidth: '190px' }}>
                  <div style={{ fontWeight: 800, color: '#4f46e5', marginBottom: '4px', fontSize: '0.88rem' }}>
                    📡 {device.deviceId} {isPhysical ? '(Physical Wearable)' : ''}
                  </div>
                  <div><b>Attendee:</b> {device.attendeeId || 'N/A'}</div>
                  <div><b>Coordinates:</b> {device.latitude.toFixed(6)}, {device.longitude.toFixed(6)}</div>
                  <div>
                    <b>GPS Quality:</b>{' '}
                    <span style={{ color: device.fixQuality === 'Valid' ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                      {device.fixQuality === 'Valid' ? `✓ Satellite Fix (${device.satellites} sats)` : '⚠ Fallback / Indoor'}
                    </span>
                  </div>
                  <div><b>Speed:</b> {device.speed} km/h | <b>Heading:</b> {device.heading}°</div>
                  <div><b>Zone:</b> {device.currentZoneId || 'Outside Defined Zones'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                    Last Ping: {new Date(device.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
