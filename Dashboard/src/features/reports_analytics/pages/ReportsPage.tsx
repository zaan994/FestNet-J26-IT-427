import React, { useState, useMemo } from 'react';
import {
  BarChart3, Download, Heart, Droplets, Sun, AlertCircle,
  TrendingUp, Activity, Shield, Clock, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  WellnessReport, BpmPeak, HeatStressPeriod, HeatStressLevel, HydrationLogEntry
} from '../../../types';
import {
  getHeatStressConfig, computeHydrationScore, generateInitialWellnessStates
} from '../../../utils/wellnessUtils';

// ─── Generate a mock post-event wellness report ────────────────────────────────
function generateMockReport(): WellnessReport {
  const eventStart = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const eventEnd   = new Date().toISOString();

  const bpmPeaks: BpmPeak[] = [
    { timestamp: new Date(Date.now() - 7.5 * 3600000).toISOString(), bpm: 162, heatStressLevel: 'Critical' },
    { timestamp: new Date(Date.now() - 6.2 * 3600000).toISOString(), bpm: 155, heatStressLevel: 'Critical' },
    { timestamp: new Date(Date.now() - 4.8 * 3600000).toISOString(), bpm: 148, heatStressLevel: 'High' },
    { timestamp: new Date(Date.now() - 3.1 * 3600000).toISOString(), bpm: 141, heatStressLevel: 'High' },
    { timestamp: new Date(Date.now() - 2.0 * 3600000).toISOString(), bpm: 138, heatStressLevel: 'Moderate' },
    { timestamp: new Date(Date.now() - 0.8 * 3600000).toISOString(), bpm: 133, heatStressLevel: 'Moderate' },
  ];

  const heatStressPeriods: HeatStressPeriod[] = [
    {
      startTime: new Date(Date.now() - 7.8 * 3600000).toISOString(),
      endTime:   new Date(Date.now() - 6.5 * 3600000).toISOString(),
      level: 'Critical', peakWbgt: 40.3
    },
    {
      startTime: new Date(Date.now() - 5.5 * 3600000).toISOString(),
      endTime:   new Date(Date.now() - 3.8 * 3600000).toISOString(),
      level: 'High', peakWbgt: 37.1
    },
    {
      startTime: new Date(Date.now() - 3.0 * 3600000).toISOString(),
      endTime:   new Date(Date.now() - 1.5 * 3600000).toISOString(),
      level: 'Moderate', peakWbgt: 31.4
    },
    {
      startTime: new Date(Date.now() - 1.2 * 3600000).toISOString(),
      endTime:   new Date().toISOString(),
      level: 'Low', peakWbgt: 25.2
    },
  ];

  const hydrationLogs: HydrationLogEntry[] = [
    { id: 'r1', deviceId: 'DEV-8821', amountMl: 250, timestamp: new Date(Date.now() - 7 * 3600000).toISOString(), note: 'Event start' },
    { id: 'r2', deviceId: 'DEV-8821', amountMl: 350, timestamp: new Date(Date.now() - 5.5 * 3600000).toISOString(), note: 'After reminder' },
    { id: 'r3', deviceId: 'DEV-8821', amountMl: 500, timestamp: new Date(Date.now() - 4 * 3600000).toISOString(), note: 'Water station' },
    { id: 'r4', deviceId: 'DEV-8821', amountMl: 200, timestamp: new Date(Date.now() - 2.5 * 3600000).toISOString(), note: 'After reminder' },
    { id: 'r5', deviceId: 'DEV-8821', amountMl: 300, timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), note: 'Manual entry' },
    { id: 'r6', deviceId: 'DEV-8821', amountMl: 150, timestamp: new Date(Date.now() - 0.3 * 3600000).toISOString(), note: 'After reminder' },
  ];

  const alertHistory = [
    `[${new Date(Date.now() - 7.5 * 3600000).toLocaleTimeString()}] CRITICAL heat stress — WBGT 40.3°, BPM 162, Temp 39.2°C`,
    `[${new Date(Date.now() - 6.2 * 3600000).toLocaleTimeString()}] CRITICAL heat stress — WBGT 39.8°, BPM 155, Temp 38.9°C`,
    `[${new Date(Date.now() - 4.8 * 3600000).toLocaleTimeString()}] HIGH heat stress — WBGT 37.1°, BPM 148`,
    `[${new Date(Date.now() - 3.1 * 3600000).toLocaleTimeString()}] HIGH heat stress — WBGT 35.8°, BPM 141`,
  ];

  const totalMl = hydrationLogs.reduce((s, l) => s + l.amountMl, 0);

  return {
    deviceId: 'DEV-8821',
    attendeeId: 'ATT-1029',
    eventStart,
    eventEnd,
    generatedAt: new Date().toISOString(),
    bpmPeaks,
    heatStressPeriods,
    hydrationScore: computeHydrationScore(totalMl),
    totalHydrationMl: totalMl,
    hydrationLogs,
    alertHistory,
    averageBpm: 118,
    averageSpO2: 95,
    maxHeatStressLevel: 'Critical',
  };
}

// ─── BPM Peak Timeline ─────────────────────────────────────────────────────────
const BpmPeakTimeline: React.FC<{ peaks: BpmPeak[] }> = ({ peaks }) => {
  const maxBpm = Math.max(...peaks.map(p => p.bpm), 100);
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {peaks.map((peak, i) => {
        const cfg = getHeatStressConfig(peak.heatStressLevel);
        const barWidth = (peak.bpm / maxBpm) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '48px', textAlign: 'right', flexShrink: 0 }}>
              {fmtTime(peak.timestamp)}
            </span>
            <div style={{ flex: 1, height: '22px', position: 'relative', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{
                width: `${barWidth}%`, height: '100%', borderRadius: '4px',
                background: `linear-gradient(90deg, ${cfg.hex}99, ${cfg.hex})`,
                transition: 'width 0.5s ease'
              }} />
              <span style={{
                position: 'absolute', left: `${Math.min(barWidth + 1, 90)}%`, top: '50%',
                transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: 700, color: cfg.textColor,
                whiteSpace: 'nowrap'
              }}>
                {peak.bpm} bpm
              </span>
            </div>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, color: cfg.textColor,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              padding: '0.15rem 0.45rem', borderRadius: '9999px', flexShrink: 0
            }}>
              {peak.heatStressLevel}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Heat Stress Period Timeline Bar ─────────────────────────────────────────
const HeatStressPeriodBar: React.FC<{ periods: HeatStressPeriod[]; eventStart: string; eventEnd: string }> = ({
  periods, eventStart, eventEnd
}) => {
  const totalMs = new Date(eventEnd).getTime() - new Date(eventStart).getTime();
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div style={{ display: 'flex', height: '36px', borderRadius: '8px', overflow: 'hidden', gap: '2px' }}>
        {periods.map((p, i) => {
          const pStartMs = new Date(p.startTime).getTime() - new Date(eventStart).getTime();
          const pDurMs   = new Date(p.endTime).getTime()   - new Date(p.startTime).getTime();
          const leftPct  = (pStartMs / totalMs) * 100;
          const widthPct = (pDurMs  / totalMs) * 100;
          const cfg = getHeatStressConfig(p.level);
          return (
            <div key={i} style={{
              position: 'relative', height: '100%', borderRadius: '4px',
              width: `${widthPct}%`, backgroundColor: cfg.hex, opacity: 0.85,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.7)',
              flexShrink: 0
            }} title={`${p.level}: ${fmtTime(p.startTime)} – ${fmtTime(p.endTime)} · Peak WBGT ${p.peakWbgt}°`}>
              {widthPct > 12 ? p.level[0] : ''}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
        <span>{fmtTime(eventStart)}</span>
        <span>{fmtTime(eventEnd)}</span>
      </div>
      {/* Period details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        {periods.map((p, i) => {
          const cfg = getHeatStressConfig(p.level);
          const durMin = Math.round((new Date(p.endTime).getTime() - new Date(p.startTime).getTime()) / 60000);
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.5rem 0.75rem', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.border}`
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.textColor, width: '70px' }}>{p.level}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>
                {fmtTime(p.startTime)} – {fmtTime(p.endTime)} ({durMin} min)
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: cfg.textColor }}>
                Peak WBGT {p.peakWbgt}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── ReportsPage ───────────────────────────────────────────────────────────────
export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'incident' | 'wellness'>('incident');
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const report = useMemo(() => generateMockReport(), []);
  const maxCfg = getHeatStressConfig(report.maxHeatStressLevel);
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Reports & Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Historical health trends, incident analytics, and post-event wellness summaries.
          </p>
        </div>
        <button className="btn-primary">
          <Download size={16} /> Export Report (PDF)
        </button>
      </div>

      {/* Report type tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        {[
          { id: 'incident' as const, label: 'Incident & Crowd Report', icon: BarChart3 },
          { id: 'wellness' as const, label: 'Post-Event Wellness Report', icon: FileText },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveReport(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: isActive ? 'rgba(37,99,235,0.15)' : 'transparent',
              color: isActive ? '#60a5fa' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500, fontSize: '0.85rem',
              outline: isActive ? '1px solid rgba(59,130,246,0.3)' : 'none', transition: 'all 0.15s'
            }}>
              <Icon size={15} color={isActive ? '#60a5fa' : '#6b7280'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── INCIDENT REPORT (existing content) ── */}
      {activeReport === 'incident' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {[
              { label: 'AVG PARAMEDIC RESPONSE TIME', value: '2.4 min', sub: '↓ 35% faster than conventional radio dispatch', color: '#3b82f6' },
              { label: 'TOTAL RESOLVED INCIDENTS', value: '47', sub: 'Over last 12 hours of festival', color: '#10b981' },
              { label: 'HEAT STROKE PREVENTIONS', value: '19', sub: 'Automated early vitals warnings triggered', color: '#f59e0b' },
              { label: 'PEAK FESTIVAL OCCUPANCY', value: '22,480', sub: 'Occurred at 19:30 during DJ headliner', color: '#8b5cf6' },
            ].map(k => (
              <div key={k.label} className="fest-card">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{k.label}</span>
                <p style={{ fontSize: '2rem', fontWeight: 800, color: k.color, marginTop: '0.5rem' }}>{k.value}</p>
                <span style={{ fontSize: '0.72rem', color: '#34d399' }}>{k.sub}</span>
              </div>
            ))}
          </div>

          <div className="fest-card">
            <div className="fest-card-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Peak Crowd Density vs. Medical Incident Correlation</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last 8 Hours (13:00 – 20:00)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '200px', padding: '1rem 0' }}>
              {[
                { hour: '13:00', density: 35, incidents: 1 }, { hour: '14:00', density: 45, incidents: 2 },
                { hour: '15:00', density: 60, incidents: 4 }, { hour: '16:00', density: 72, incidents: 6 },
                { hour: '17:00', density: 85, incidents: 9 }, { hour: '18:00', density: 92, incidents: 14 },
                { hour: '19:00', density: 98, incidents: 18 }, { hour: '20:00', density: 95, incidents: 12 },
              ].map((bar, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: '#fb7185', marginBottom: '0.25rem', fontWeight: 700 }}>{bar.incidents} emg</span>
                  <div style={{
                    width: '100%', height: `${bar.density}%`,
                    background: bar.density > 80 ? 'linear-gradient(180deg, #f43f5e, #be123c)' : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                    borderRadius: '6px 6px 0 0', transition: 'height 0.3s ease'
                  }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{bar.hour}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── POST-EVENT WELLNESS REPORT ── */}
      {activeReport === 'wellness' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Report header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
            border: '1px solid rgba(59,130,246,0.2)', borderRadius: '14px', padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <FileText size={20} color="#60a5fa" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Post-Event Wellness Report</h3>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Device: {report.deviceId} · Attendee: {report.attendeeId}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Event: {fmtTime(report.eventStart)} → {fmtTime(report.eventEnd)} · Generated: {fmtTime(report.generatedAt)}
                </div>
              </div>
              <span style={{
                padding: '0.4rem 1rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700,
                background: maxCfg.bg, color: maxCfg.textColor, border: `1px solid ${maxCfg.border}`
              }}>
                Max Risk: {maxCfg.emoji} {report.maxHeatStressLevel}
              </span>
            </div>
          </div>

          {/* KPI summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'AVG BPM', value: `${report.averageBpm}`, sub: 'Over event duration', color: '#f43f5e', icon: Heart },
              { label: 'AVG SPO₂', value: `${report.averageSpO2}%`, sub: 'Blood oxygen', color: '#06b6d4', icon: Activity },
              { label: 'HYDRATION SCORE', value: `${report.hydrationScore}%`, sub: `${report.totalHydrationMl} ml logged`, color: '#10b981', icon: Droplets },
              { label: 'BPM PEAKS', value: `${report.bpmPeaks.length}`, sub: 'High-intensity episodes', color: '#f97316', icon: TrendingUp },
              { label: 'HEAT PERIODS', value: `${report.heatStressPeriods.filter(p => p.level !== 'Low').length}`, sub: 'Elevated stress episodes', color: '#f59e0b', icon: Sun },
              { label: 'ALERTS', value: `${report.alertHistory.length}`, sub: 'Critical/High triggers', color: '#8b5cf6', icon: AlertCircle },
            ].map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="fest-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: k.color, marginBottom: '0.35rem' }}>
                    <Icon size={14} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>{k.label}</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '0.2rem' }}>{k.sub}</div>
                </div>
              );
            })}
          </div>

          {/* BPM Peak Timeline */}
          <div className="fest-card">
            <div className="fest-card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Heart size={16} color="#f43f5e" /> BPM Peak Episodes
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top BPM readings across event timeline</span>
            </div>
            <BpmPeakTimeline peaks={report.bpmPeaks} />
          </div>

          {/* Heat Stress Timeline */}
          <div className="fest-card">
            <div className="fest-card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sun size={16} color="#f59e0b" /> Heat Stress Periods
              </h3>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                {(['Low', 'Moderate', 'High', 'Critical'] as HeatStressLevel[]).map(lv => {
                  const cfg = getHeatStressConfig(lv);
                  return (
                    <span key={lv} style={{ fontSize: '0.68rem', color: cfg.textColor, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: cfg.hex, display: 'inline-block' }} />
                      {lv}
                    </span>
                  );
                })}
              </div>
            </div>
            <HeatStressPeriodBar periods={report.heatStressPeriods} eventStart={report.eventStart} eventEnd={report.eventEnd} />
          </div>

          {/* Hydration Summary */}
          <div className="fest-card">
            <div className="fest-card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Droplets size={16} color="#06b6d4" /> Hydration Score & Log
              </h3>
              <span style={{
                padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                background: report.hydrationScore >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: report.hydrationScore >= 80 ? '#34d399' : '#fbbf24',
                border: `1px solid ${report.hydrationScore >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
              }}>
                {report.hydrationScore}% compliance
              </span>
            </div>

            {/* Hydration bar chart */}
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
              {report.hydrationLogs.map((l, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.6rem', color: '#22d3ee', fontWeight: 600 }}>{l.amountMl}</span>
                  <div style={{ width: '100%', height: `${(l.amountMl / 500) * 60}px`, background: 'linear-gradient(180deg, #06b6d4, #0e7490)', borderRadius: '4px 4px 0 0' }} />
                  <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                    {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>

            {/* Log list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {report.hydrationLogs.map((l, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem',
                  borderRadius: '7px', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Droplets size={12} color="#06b6d4" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22d3ee' }}>{l.amountMl} ml</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>— {l.note}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {fmtTime(l.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert History */}
          <div className="fest-card">
            <div className="fest-card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={16} color="#8b5cf6" /> Alert History
              </h3>
              <button onClick={() => setAlertsExpanded(p => !p)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem'
              }}>
                {alertsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {alertsExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {alertsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {report.alertHistory.map((alert, i) => (
                  <div key={i} style={{
                    padding: '0.5rem 0.75rem', borderRadius: '7px',
                    background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                    fontSize: '0.77rem', color: '#f87171', fontFamily: 'monospace'
                  }}>
                    {alert}
                  </div>
                ))}
              </div>
            )}
            {!alertsExpanded && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {report.alertHistory.length} alert{report.alertHistory.length !== 1 ? 's' : ''} recorded during the event.
                Click expand to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
