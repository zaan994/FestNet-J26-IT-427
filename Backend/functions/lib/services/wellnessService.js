"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wellnessService = void 0;
const wellnessCalculator_1 = require("../utils/wellnessCalculator");
const wellnessRepository_1 = require("../repositories/wellnessRepository");
// ─── Wellness Service ─────────────────────────────────────────────────────────
class WellnessService {
    /**
     * Ingest a wellness reading from a wearable device.
     * Computes WBGT index, classifies heat stress level, persists, and
     * updates the dynamic hydration reminder interval.
     */
    async ingestWellnessReading(dto) {
        if (!dto.deviceId)
            return { success: false, error: 'deviceId is required.' };
        if (dto.bpm < 20 || dto.bpm > 300)
            return { success: false, error: 'bpm out of valid range (20–300).' };
        if (dto.bodyTemperature < 30 || dto.bodyTemperature > 43) {
            return { success: false, error: 'bodyTemperature out of valid range (30–43°C).' };
        }
        const wbgtIndex = (0, wellnessCalculator_1.calculateWBGT)(dto.bpm, dto.bodyTemperature);
        const level = (0, wellnessCalculator_1.classifyHeatStress)(wbgtIndex);
        const timestamp = dto.timestamp || new Date().toISOString();
        const reading = {
            id: `WSR-${dto.deviceId}-${Date.now()}`,
            deviceId: dto.deviceId,
            attendeeId: dto.attendeeId,
            bpm: dto.bpm,
            bodyTemperature: dto.bodyTemperature,
            wbgtIndex,
            level,
            timestamp,
        };
        await wellnessRepository_1.wellnessRepository.saveHeatStressReading(reading);
        // Recompute dynamic reminder interval based on BPM trend
        const recent = await wellnessRepository_1.wellnessRepository.getHeatStressHistory(dto.deviceId, 30);
        const recentBpms = recent.map(r => r.bpm);
        const bpmGradient = (0, wellnessCalculator_1.calculateBpmGradient)(recentBpms);
        const intervalMinutes = (0, wellnessCalculator_1.computeReminderInterval)(bpmGradient);
        const existingReminder = await wellnessRepository_1.wellnessRepository.getReminderState(dto.deviceId);
        const nextReminderAt = existingReminder
            ? existingReminder.nextReminderAt // keep existing schedule unless expired
            : new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
        // If existing reminder is past-due, recalculate
        const isOverdue = existingReminder && new Date(existingReminder.nextReminderAt) < new Date();
        const updatedNextReminderAt = isOverdue
            ? new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString()
            : nextReminderAt;
        const reminder = {
            deviceId: dto.deviceId,
            nextReminderAt: updatedNextReminderAt,
            intervalMinutes,
            bpmGradient,
            lastUpdated: timestamp,
        };
        await wellnessRepository_1.wellnessRepository.saveReminderState(reminder);
        return { success: true, reading, reminder };
    }
    /**
     * Log a manual water intake entry and return the updated hydration compliance score.
     */
    async logHydration(dto) {
        if (!dto.deviceId)
            return { success: false, error: 'deviceId is required.' };
        if (!dto.amountMl || dto.amountMl <= 0)
            return { success: false, error: 'amountMl must be > 0.' };
        const log = {
            id: `HYD-${dto.deviceId}-${Date.now()}`,
            deviceId: dto.deviceId,
            attendeeId: dto.attendeeId,
            amountMl: dto.amountMl,
            timestamp: new Date().toISOString(),
            note: dto.note,
        };
        await wellnessRepository_1.wellnessRepository.saveHydrationLog(log);
        // Recompute compliance score for today
        const todaysLogs = await wellnessRepository_1.wellnessRepository.getHydrationLogs(dto.deviceId, 24);
        const totalMl = todaysLogs.reduce((sum, l) => sum + l.amountMl, 0);
        const hydrationScore = (0, wellnessCalculator_1.computeHydrationScore)(totalMl);
        return { success: true, log, hydrationScore, totalMl };
    }
    /**
     * Get the current hydration reminder state for a device.
     * Also updates the interval if the BPM trend has changed significantly.
     */
    async getHydrationReminder(deviceId) {
        return wellnessRepository_1.wellnessRepository.getReminderState(deviceId);
    }
    /**
     * Build the full wellness dashboard for a device:
     * - Hourly BPM trend & SpO2 history
     * - Heat stress history
     * - Hydration compliance score
     */
    async getWellnessDashboard(deviceId) {
        const [readings, hydrationLogs, reminder] = await Promise.all([
            wellnessRepository_1.wellnessRepository.getHeatStressHistory(deviceId, 12 * 60), // last 12 hours
            wellnessRepository_1.wellnessRepository.getHydrationLogs(deviceId, 24),
            wellnessRepository_1.wellnessRepository.getReminderState(deviceId),
        ]);
        // Build hourly snapshots
        const hourlyMap = new Map();
        for (const r of readings) {
            const hourKey = new Date(r.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
            const entry = hourlyMap.get(hourKey) || { bpms: [], spO2s: [], wbgts: [], levels: [], hydrationMl: 0 };
            entry.bpms.push(r.bpm);
            entry.wbgts.push(r.wbgtIndex);
            entry.levels.push(r.level);
            hourlyMap.set(hourKey, entry);
        }
        for (const l of hydrationLogs) {
            const hourKey = new Date(l.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
            const entry = hourlyMap.get(hourKey) || { bpms: [], spO2s: [], wbgts: [], levels: [], hydrationMl: 0 };
            entry.hydrationMl += l.amountMl;
            hourlyMap.set(hourKey, entry);
        }
        const levelOrder = ['Low', 'Moderate', 'High', 'Critical'];
        const hourlySnapshots = Array.from(hourlyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([hour, data]) => ({
            deviceId,
            hour,
            avgBpm: data.bpms.length > 0 ? Math.round(data.bpms.reduce((s, v) => s + v, 0) / data.bpms.length) : 0,
            peakBpm: data.bpms.length > 0 ? Math.max(...data.bpms) : 0,
            avgSpO2: data.spO2s.length > 0 ? Math.round(data.spO2s.reduce((s, v) => s + v, 0) / data.spO2s.length) : 0,
            avgHeatStressIndex: data.wbgts.length > 0 ? Math.round(data.wbgts.reduce((s, v) => s + v, 0) / data.wbgts.length * 10) / 10 : 0,
            dominantLevel: data.levels.length > 0
                ? data.levels.sort((a, b) => levelOrder.indexOf(b) - levelOrder.indexOf(a))[0]
                : 'Low',
            hydrationMl: data.hydrationMl,
        }));
        const totalHydrationMl = hydrationLogs.reduce((sum, l) => sum + l.amountMl, 0);
        const hydrationComplianceScore = (0, wellnessCalculator_1.computeHydrationScore)(totalHydrationMl);
        const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
        return {
            deviceId,
            generatedAt: new Date().toISOString(),
            hourlySnapshots,
            hydrationComplianceScore,
            totalHydrationMl,
            dailyTargetMl: 2500,
            currentHeatStressLevel: latestReading?.level ?? 'Low',
            currentWbgtIndex: latestReading?.wbgtIndex ?? 0,
            latestBpm: latestReading?.bpm ?? 0,
            latestSpO2: 0, // SpO2 not tracked in heat stress readings directly
            reminderState: reminder,
        };
    }
    /**
     * Generate a post-event wellness report covering the entire event timeline.
     */
    async generatePostEventReport(deviceId, eventStart, eventEnd, attendeeId) {
        const [allReadings, allHydrationLogs] = await Promise.all([
            wellnessRepository_1.wellnessRepository.getHeatStressHistory(deviceId, 48 * 60), // up to 48h
            wellnessRepository_1.wellnessRepository.getHydrationLogs(deviceId, 48),
        ]);
        const startTime = new Date(eventStart).getTime();
        const endTime = new Date(eventEnd).getTime();
        const readings = allReadings.filter(r => {
            const t = new Date(r.timestamp).getTime();
            return t >= startTime && t <= endTime;
        });
        const hydrationLogs = allHydrationLogs.filter(l => {
            const t = new Date(l.timestamp).getTime();
            return t >= startTime && t <= endTime;
        });
        // BPM peaks: readings where BPM is in the top 10%
        const sortedBpms = readings.map(r => r.bpm).sort((a, b) => b - a);
        const peakThreshold = sortedBpms[Math.floor(sortedBpms.length * 0.1)] || 0;
        const bpmPeaks = readings
            .filter(r => r.bpm >= peakThreshold && r.bpm > 100)
            .map(r => ({ timestamp: r.timestamp, bpm: r.bpm, heatStressLevel: r.level }))
            .slice(0, 20); // top 20 peaks
        // Heat stress periods: group consecutive readings by level
        const heatStressPeriods = [];
        let periodStart = null;
        let currentLevel = null;
        let peakWbgt = 0;
        for (const r of readings) {
            if (r.level !== 'Low') {
                if (currentLevel !== r.level) {
                    if (periodStart && currentLevel) {
                        heatStressPeriods.push({
                            startTime: periodStart,
                            endTime: r.timestamp,
                            level: currentLevel,
                            peakWbgt,
                        });
                    }
                    periodStart = r.timestamp;
                    currentLevel = r.level;
                    peakWbgt = r.wbgtIndex;
                }
                else {
                    peakWbgt = Math.max(peakWbgt, r.wbgtIndex);
                }
            }
            else if (periodStart && currentLevel) {
                heatStressPeriods.push({
                    startTime: periodStart,
                    endTime: r.timestamp,
                    level: currentLevel,
                    peakWbgt,
                });
                periodStart = null;
                currentLevel = null;
                peakWbgt = 0;
            }
        }
        // Close open period
        if (periodStart && currentLevel) {
            heatStressPeriods.push({
                startTime: periodStart,
                endTime: readings[readings.length - 1]?.timestamp ?? eventEnd,
                level: currentLevel,
                peakWbgt,
            });
        }
        const totalHydrationMl = hydrationLogs.reduce((sum, l) => sum + l.amountMl, 0);
        const hydrationScore = (0, wellnessCalculator_1.computeHydrationScore)(totalHydrationMl);
        const avgBpm = readings.length > 0
            ? Math.round(readings.reduce((s, r) => s + r.bpm, 0) / readings.length)
            : 0;
        const levelOrder = ['Low', 'Moderate', 'High', 'Critical'];
        const maxHeatStressLevel = readings.length > 0
            ? readings.reduce((max, r) => levelOrder.indexOf(r.level) > levelOrder.indexOf(max) ? r.level : max, 'Low')
            : 'Low';
        const alertHistory = [];
        for (const r of readings) {
            if (r.level === 'Critical') {
                alertHistory.push(`[${r.timestamp}] CRITICAL heat stress — WBGT ${r.wbgtIndex}°, BPM ${r.bpm}, Temp ${r.bodyTemperature}°C`);
            }
            else if (r.level === 'High') {
                alertHistory.push(`[${r.timestamp}] HIGH heat stress — WBGT ${r.wbgtIndex}°, BPM ${r.bpm}`);
            }
        }
        return {
            deviceId,
            attendeeId,
            eventStart,
            eventEnd,
            generatedAt: new Date().toISOString(),
            bpmPeaks,
            heatStressPeriods,
            hydrationScore,
            totalHydrationMl,
            hydrationLogs,
            alertHistory,
            averageBpm: avgBpm,
            averageSpO2: 0,
            maxHeatStressLevel,
        };
    }
}
exports.wellnessService = new WellnessService();
//# sourceMappingURL=wellnessService.js.map