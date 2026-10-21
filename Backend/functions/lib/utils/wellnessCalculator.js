"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateWBGT = calculateWBGT;
exports.classifyHeatStress = classifyHeatStress;
exports.calculateBpmGradient = calculateBpmGradient;
exports.computeReminderInterval = computeReminderInterval;
exports.computeHydrationScore = computeHydrationScore;
exports.getHeatStressColour = getHeatStressColour;
/**
 * WBGT-Inspired Heat Stress Index Calculator
 *
 * Formula rationale:
 *   The standard Wet Bulb Globe Temperature formula:
 *     WBGT = 0.7 × Tw + 0.2 × Tg + 0.1 × Ta
 *   For a wearable-only context (no globe or ambient sensor), we derive a
 *   physiological analogue:
 *     - bodyTemperature acts as the wet-bulb proxy (Tw) — dominant weight (0.7)
 *     - BPM contributes a cardiovascular load factor (0.1 × bpm / 5)
 *       rationale: resting BPM ~60 contributes ~1.2°C equivalent; elevated BPM ~150 ~3°C
 *     - A baseline offset of 3.94 (matching environmental WBGT at moderate conditions)
 *
 *   Result is a unitless index on the WBGT scale (°C equivalent):
 *     < 26 → Low
 *     26–32 → Moderate
 *     32–38 → High
 *     > 38 → Critical
 */
function calculateWBGT(bpm, bodyTemperature) {
    const wetBulbProxy = bodyTemperature; // dominant term
    const cardioLoadFactor = (bpm / 5) * 0.1; // BPM physiological contribution
    const baselineOffset = 3.94;
    const wbgt = 0.7 * wetBulbProxy + cardioLoadFactor + baselineOffset;
    return Math.round(wbgt * 10) / 10;
}
/**
 * Classify WBGT index into one of four severity tiers.
 * Thresholds align with ISO 7243 WBGT occupational standards adapted for festival settings.
 */
function classifyHeatStress(wbgtIndex) {
    if (wbgtIndex < 26)
        return 'Low';
    if (wbgtIndex < 32)
        return 'Moderate';
    if (wbgtIndex < 38)
        return 'High';
    return 'Critical';
}
/**
 * Calculate BPM trend gradient using linear least-squares regression.
 *
 * @param recentBpms - Array of recent BPM readings (chronological order, oldest first)
 * @returns gradient in bpm/reading (positive = rising, negative = falling)
 */
function calculateBpmGradient(recentBpms) {
    const n = recentBpms.length;
    if (n < 2)
        return 0;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += recentBpms[i];
        sumXY += i * recentBpms[i];
        sumXX += i * i;
    }
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0)
        return 0;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    return Math.round(slope * 100) / 100;
}
/**
 * Compute the next hydration reminder interval based on the BPM gradient.
 *
 * Design:
 *   - Baseline interval: 30 minutes (physiologically appropriate at rest/low activity)
 *   - As BPM gradient rises (trend upward), reduce interval toward minimum 10 minutes
 *   - Gradient thresholds:
 *       gradient ≤ 0     → 30 min (stable or falling — no urgency)
 *       gradient 0–2     → 25 min (slowly rising BPM)
 *       gradient 2–5     → 20 min (moderately rising)
 *       gradient 5–10    → 15 min (rapidly rising)
 *       gradient > 10    → 10 min (very steep BPM increase — dehydration risk high)
 *
 * @param bpmGradient - slope from calculateBpmGradient()
 * @returns interval in minutes
 */
function computeReminderInterval(bpmGradient) {
    if (bpmGradient <= 0)
        return 30;
    if (bpmGradient <= 2)
        return 25;
    if (bpmGradient <= 5)
        return 20;
    if (bpmGradient <= 10)
        return 15;
    return 10;
}
/**
 * Compute hydration compliance score (0–100) for the day.
 * Based on WHO guidance of ~2500 ml/day for adults in warm environments.
 *
 * @param totalMl - total millilitres consumed
 * @param targetMl - daily target (default 2500 ml)
 */
function computeHydrationScore(totalMl, targetMl = 2500) {
    const score = Math.min(100, Math.round((totalMl / targetMl) * 100));
    return score;
}
/**
 * Get human-readable colour code and CSS variable name for a heat stress level.
 */
function getHeatStressColour(level) {
    switch (level) {
        case 'Low': return { hex: '#10b981', label: 'emerald' };
        case 'Moderate': return { hex: '#f59e0b', label: 'amber' };
        case 'High': return { hex: '#f97316', label: 'orange' };
        case 'Critical': return { hex: '#ef4444', label: 'red' };
    }
}
//# sourceMappingURL=wellnessCalculator.js.map