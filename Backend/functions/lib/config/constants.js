"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
    // Research Algorithm Parameters
    MIN_DEVICES_FOR_FLOW_ANALYSIS: 5, // Minimum samples required to compute reliable crowd vector
    MIN_MOTION_SPEED_KMH: 0.5, // GPS noise filter: ignore device heading if stationary
    DEFAULT_SURGE_SPEED_KMH: 6.0, // Speed threshold exceeding typical walking velocity (~4 km/h)
    SURGE_COHERENCE_THRESHOLD: 0.75, // Order parameter R >= 0.75 indicates unified mass movement
    WARNING_COHERENCE_THRESHOLD: 0.65,
    DATA_STALENESS_SECONDS: 45, // Window for real-time crowd calculation
    // Spatial Constants
    EARTH_RADIUS_METERS: 6371000,
    // Server defaults
    PORT: parseInt(process.env.PORT || '5001', 10),
    CROWD_ANALYSIS_INTERVAL_MS: 3000, // Recompute crowd metrics every 3 seconds
};
//# sourceMappingURL=constants.js.map