/**
 * Crowd Monitoring Constants
 * Centralized configuration for thresholds, colors, and settings
 */

export const SPEED_THRESHOLDS = {
  STATIONARY: 0.5,
  WALKING: 1.0,
  HIGH_SPEED: 6.0,
} as const;

export const COLORS = {
  // Status Colors
  CRITICAL: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#3b82f6',
  SUCCESS: '#10b981',
  PURPLE: '#8b5cf6',
  INDIGO: '#6366f1',

  // Map Marker Colors
  DEVICE_STATIONARY: '#10b981',
  DEVICE_WALKING: '#3b82f6',
  DEVICE_HIGH_SPEED: '#ef4444',

  // Zone Border Colors
  ZONE_NORMAL: '#3b82f6',
  ZONE_SELECTED: '#a855f7',
  ZONE_SURGE: '#ef4444',
} as const;

export const MAP_CONFIG = {
  CENTER: [7.1192, 80.0474] as [number, number],
  ZOOM: {
    DEFAULT: 17,
    MIN: 14,
    MAX: 19,
  },
  HEIGHT: '520px',
  TILE_LAYERS: {
    STREETS: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    SATELLITE: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
} as const;

export const POLLING_INTERVAL_MS = 2500;

export const SIMULATION_DEFAULTS = {
  DEVICE_COUNT: 10,
  SURGE_SPEED: 8.4,
  SURGE_HEADING: 45, // Northeast
  SURGE_COHERENCE: 0.985,
  ZONE_ID: 'ZONE-MAIN-STAGE',
  ZONE_NAME: 'Main Stage Arena',
} as const;

export const COHERENCE_THRESHOLDS = {
  DISPERSED: 0.45,
  COORDINATED: 0.55,
  SURGE: 0.75,
} as const;

export const CROWD_STATUS_LABELS = {
  NORMAL_STATIC: 'Normal Static',
  NORMAL_DISPERSED: 'Normal Dispersed',
  COORDINATED_FLOW: 'Coordinated Flow',
  ELEVATED_FLOW: 'Elevated Flow',
  CRITICAL_SURGE: 'Critical Surge',
  BOTTLENECK: 'Bottleneck',
} as const;

export const CROWD_STATUS_COLORS = {
  NORMAL_STATIC: { bg: 'rgba(16, 185, 129, 0.1)', text: '#a7f3d0' },
  NORMAL_DISPERSED: { bg: 'rgba(16, 185, 129, 0.1)', text: '#a7f3d0' },
  COORDINATED_FLOW: { bg: 'rgba(59, 130, 246, 0.15)', text: '#bfdbfe' },
  ELEVATED_FLOW: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fde68a' },
  CRITICAL_SURGE: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5' },
  BOTTLENECK: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5' },
} as const;

export const ZONE_TYPE_LABELS = {
  STAGE: 'Stage / Arena',
  EXIT: 'Exit / Pathway',
  FIRST_AID: 'Medical Tent',
  RESTROOM: 'Restrooms',
  FOOD_BEVERAGE: 'Food Village',
  SECURITY: 'Security / Command',
  CAMPING: 'Camping Area',
} as const;
