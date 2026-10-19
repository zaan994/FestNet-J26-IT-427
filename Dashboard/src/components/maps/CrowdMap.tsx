import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents } from 'react-leaflet';
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
}

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
function createDeviceIcon(speed: number, heading: number, isSelected: boolean) {
  const isMoving = speed >= 1.0;
  const color = speed >= 6.0 ? '#ef4444' : isMoving ? '#3b82f6' : '#10b981';

  return L.divIcon({
    className: 'custom-device-marker',
    html: `
      <div style="
        position: relative;
        width: 18px;
        height: 18px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 8px ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
      ">
        ${isMoving ? `
          <div style="
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-bottom: 7px solid #ffffff;
            margin-top: -3px;
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
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
}) => {
  // Center around event location
  const center: [number, number] = [7.1192, 80.0474];
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');

  return (
    <div style={{ position: 'relative', width: '100%', height: '520px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* Map layer switcher (Streets / Satellite) */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '3px',
        display: 'flex',
        gap: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}>
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
          🗺️ Streets (OSM)
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
        {devices.map((device) => (
          <Marker
            key={device.deviceId}
            position={[device.latitude, device.longitude]}
            icon={createDeviceIcon(device.speed, device.heading, false)}
          >
            <Popup>
              <div style={{ color: '#0f172a', fontSize: '0.8rem' }}>
                <b>Band ID:</b> {device.deviceId}<br />
                <b>Speed:</b> {device.speed} km/h<br />
                <b>Heading:</b> {device.heading}°<br />
                <b>Satellites:</b> {device.satellites}<br />
                <b>Zone:</b> {device.currentZoneId || 'None'}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
