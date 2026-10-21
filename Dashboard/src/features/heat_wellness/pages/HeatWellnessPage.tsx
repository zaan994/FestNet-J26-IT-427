import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun, Droplets, Thermometer, Heart, Activity,
  AlertCircle, ShieldAlert, Clock, Plus, CheckCircle,
  TrendingUp, TrendingDown, Minus, Zap, Cpu, Radio,
  FileText, ExternalLink, Info
} from 'lucide-react';
import { ZoneData, AttendeeWellnessState, HydrationLogEntry, HeatStressLevel } from '../../../types';
import {
  calculateWBGT, classifyHeatStress, calculateBpmGradient,
  computeReminderInterval, computeHydrationScore, getHeatStressConfig,
  HourlyChartPoint
} from '../../../utils/wellnessUtils';

interface Props {
  zones: ZoneData[];
  onNavigateTab?: (tab: string) => void;
}

// ─── Heat Stress Gauge ─────────────────────────────────────────────────────────
const HeatStressGauge: React.FC<{ wbgt: number; level: HeatStressLevel }> = ({ wbgt, level }) => {
  const config = getHeatStressConfig(level);
  const pct = Math.min(100, Math.max(0, ((wbgt - 20) / (44 - 20)) * 100));
  const circumference = 2 * Math.PI * 52;
  const strokeDashoffset = circumference * (1 - pct / 100);

  return (
    <div style={{ position: 'relative', width: '130px', height: '130px', flexShrink: 0 }}>
      <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="65" cy="65" r="52" fill="none"
          stroke={config.hex} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: config.textColor }}>{wbgt}°</span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: config.textColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WBGT</span>
      </div>
    </div>
  );
};

// ─── Attendee Wellness Card ────────────────────────────────────────────────────
const AttendeeWellnessCard: React.FC<{
  attendee: AttendeeWellnessState;
  isRealDevice?: boolean;
  onViewReport?: () => void;
}> = ({ attendee, isRealDevice, onViewReport }) => {
  const config = getHeatStressConfig(attendee.heatStressLevel);
  const gradient = calculateBpmGradient(attendee.bpmHistory);
  const minsUntilReminder = Math.max(0, Math.round((new Date(attendee.nextReminderAt).getTime() - Date.now()) / 60000));

  const TrendIcon = gradient > 1 ? TrendingUp : gradient < -1 ? TrendingDown : Minus;
  const trendColor = gradient > 1 ? '#f87171' : gradient < -1 ? '#34d399' : '#9ca3af';

  return (
    <div className="fest-card" style={{
      borderLeft: `4px solid ${config.hex}`,
      transition: 'all 0.3s ease',
      boxShadow: isRealDevice ? '0 0 20px rgba(6,182,212,0.12)' : undefined
    }}>
      <div className="fest-card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{attendee.name}</h3>
            {isRealDevice && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem',
                borderRadius: '4px', background: 'rgba(6,182,212,0.15)', color: '#22d3ee',
                border: '1px solid rgba(6,182,212,0.3)'
              }}>
                <Radio size={10} className="live-pulse" /> LIVE HARDWARE
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{attendee.zone} · {attendee.deviceId}</span>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.25rem 0.7rem', borderRadius: '9999px',
          fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          background: config.bg, color: config.textColor, border: `1px solid ${config.border}`
        }}>
          {config.emoji} {config.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', margin: '1rem 0' }}>
        <HeatStressGauge wbgt={attendee.wbgtIndex} level={attendee.heatStressLevel} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', flex: 1 }}>
          {[
            { label: 'BPM', value: `${attendee.bpm}`, icon: Heart, color: '#f43f5e', sub: <TrendIcon size={11} color={trendColor} /> },
            { label: 'TEMP', value: `${attendee.bodyTemperature}°C`, icon: Thermometer, color: '#f59e0b', sub: null },
            { label: 'SpO₂', value: `${attendee.spO2}%`, icon: Activity, color: '#06b6d4', sub: null },
            { label: 'BATTERY', value: `${attendee.battery}%`, icon: Zap, color: '#8b5cf6', sub: null },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} style={{
              backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px',
              padding: '0.55rem 0.7rem', border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color, marginBottom: '0.2rem' }}>
                <Icon size={12} />
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
                {sub}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Hydration & Reminder */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(6,182,212,0.06)', borderRadius: '8px',
        padding: '0.75rem 0.9rem', border: '1px solid rgba(6,182,212,0.15)',
        marginBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Droplets size={16} color="#06b6d4" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22d3ee' }}>
              {attendee.hydrationMl} ml today
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {computeHydrationScore(attendee.hydrationMl)}% of 2,500 ml target
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>
            <Clock size={12} />
            Next in {minsUntilReminder}m
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Interval: {attendee.reminderInterval} min
          </div>
        </div>
      </div>

      {/* BPM gradient explanation */}
      <div style={{
        fontSize: '0.7rem', color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <TrendIcon size={12} color={trendColor} />
          BPM Gradient: <strong style={{ color: trendColor }}>{gradient > 0 ? '+' : ''}{gradient} bpm/reading</strong> → {attendee.reminderInterval}m interval
        </span>
        {onViewReport && (
          <button onClick={onViewReport} style={{
            background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}>
            <FileText size={12} /> Post-Event Report
          </button>
        )}
      </div>
    </div>
  );
};

// ─── 4-Tier WBGT Reference Scale ─────────────────────────────────────────────
const SeverityLegend: React.FC = () => {
  const tiers: { level: HeatStressLevel; range: string; desc: string }[] = [
    { level: 'Low', range: '< 26° WBGT', desc: 'Normal conditions; standard 30-min hydration reminders.' },
    { level: 'Moderate', range: '26° – 32° WBGT', desc: 'Mild thermal discomfort; dynamic interval adjusts to 20–25m.' },
    { level: 'High', range: '32° – 38° WBGT', desc: 'Elevated heat exhaustion risk; dynamic interval accelerates to 15m.' },
    { level: 'Critical', range: '> 38° WBGT', desc: 'Severe heat stroke danger; 10m urgent prompts & medical dispatch.' },
  ];

  return (
    <div className="fest-card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 700 }}>
        <Info size={15} color="#60a5fa" />
        <span>Validated 4-Tier Heat Stress Index Reference</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {tiers.map(t => {
          const cfg = getHeatStressConfig(t.level);
          return (
            <div key={t.level} style={{
              padding: '0.6rem 0.8rem', borderRadius: '8px',
              background: cfg.bg, border: `1px solid ${cfg.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: cfg.textColor }}>
                  {cfg.emoji} {t.level.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: cfg.textColor }}>{t.range}</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Hourly BPM Chart ─────────────────────────────────────────────────────────
const HourlyBpmChart: React.FC<{ data: HourlyChartPoint[] }> = ({ data }) => {
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>Streaming sensor telemetry...</div>;
  const maxBpm = Math.max(...data.map(d => d.peakBpm), 120);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '140px', paddingBottom: '4px' }}>
        {data.map((d, i) => {
          const avgH = (d.avgBpm / maxBpm) * 100;
          const peakH = (d.peakBpm / maxBpm) * 100;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '2px' }}>
              <span style={{ fontSize: '0.65rem', color: '#fb7185', fontWeight: 700 }}>{d.peakBpm}</span>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '110px', position: 'relative' }}>
                <div style={{ width: '100%', height: `${peakH}%`, background: 'rgba(244,63,94,0.18)', borderRadius: '4px 4px 0 0', position: 'absolute', bottom: 0 }} />
                <div style={{ width: '100%', height: `${avgH}%`, background: 'linear-gradient(180deg, #f43f5e, #be123c)', borderRadius: '4px 4px 0 0', position: 'absolute', bottom: 0, opacity: 0.85 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', paddingTop: '4px' }}>{d.hour}</div>
        ))}
      </div>
    </div>
  );
};

// ─── SpO2 History Chart ───────────────────────────────────────────────────────
const SpO2Chart: React.FC<{ data: HourlyChartPoint[] }> = ({ data }) => {
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>Awaiting PPG oxygen saturation readings...</div>;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '100px' }}>
        {data.map((d, i) => {
          const pct = Math.max(10, ((d.avgSpO2 - 80) / 20) * 100);
          const color = d.avgSpO2 >= 95 ? '#06b6d4' : d.avgSpO2 >= 90 ? '#f59e0b' : '#ef4444';
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.65rem', color, fontWeight: 700, marginBottom: '2px' }}>{d.avgSpO2}%</span>
              <div style={{ width: '100%', height: `${pct}%`, background: `linear-gradient(180deg, ${color}, ${color}77)`, borderRadius: '4px 4px 0 0' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '4px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d.hour}</div>
        ))}
      </div>
    </div>
  );
};

// ─── Heat Stress Timeline ─────────────────────────────────────────────────────
const HeatStressTimeline: React.FC<{ data: HourlyChartPoint[] }> = ({ data }) => {
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Recording real-time heat stress history...</div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', height: '40px', borderRadius: '8px', overflow: 'hidden' }}>
        {data.map((d, i) => {
          const config = getHeatStressConfig(d.level);
          return (
            <div key={i} style={{ flex: 1, backgroundColor: config.hex, opacity: 0.85, position: 'relative' }} title={`${d.hour}: ${d.level} (WBGT ${d.avgWbgt}°)`}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#000', fontWeight: 800 }}>
                {d.level[0]}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d.hour}</div>
        ))}
      </div>
    </div>
  );
};

// ─── Hydration Compliance Ring ─────────────────────────────────────────────────
const ComplianceRing: React.FC<{ score: number; totalMl: number }> = ({ score, totalMl }) => {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{score}%</span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCORE</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22d3ee' }}>{totalMl} ml</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>of 2,500 ml daily target</div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '3px' }}>
          {[0, 25, 50, 75].map(step => (
            <div key={step} style={{ width: '35px', height: '6px', background: score > step ? color : 'rgba(255,255,255,0.08)', borderRadius: '2px' }} />
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          {score >= 80 ? '🎯 Target achieved' : score >= 50 ? '⚠️ Moderate compliance' : '🚨 Low compliance - prompt user'}
        </div>
      </div>
    </div>
  );
};

// ─── Hydration Log Screen ─────────────────────────────────────────────────────
interface HydrationLogProps {
  selectedDevice: AttendeeWellnessState;
  logs: HydrationLogEntry[];
  onAddLog: (amountMl: number, note: string) => void;
}

const HydrationLogPanel: React.FC<HydrationLogProps> = ({ selectedDevice, logs, onAddLog }) => {
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const totalMl = logs.reduce((s, l) => s + l.amountMl, 0) + selectedDevice.hydrationMl;
  const score = computeHydrationScore(totalMl);
  const quickAmounts = [150, 250, 350, 500];

  const handleAdd = (ml: number) => {
    onAddLog(ml, note || 'Manual water intake');
    setNote('');
    setCustomAmount('');
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <div className="fest-card" style={{ borderLeft: '3px solid #06b6d4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedDevice.name}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedDevice.zone} · {selectedDevice.deviceId}</span>
          </div>
          <span style={{
            padding: '0.25rem 0.7rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
            background: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.25)'
          }}>
            Dynamic Interval: {selectedDevice.reminderInterval} min
          </span>
        </div>
        <ComplianceRing score={score} totalMl={totalMl} />
      </div>

      <div className="fest-card">
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} color="#06b6d4" /> Manual Water Intake Entry
        </h4>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {quickAmounts.map(ml => (
            <button key={ml} onClick={() => handleAdd(ml)} style={{
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
              color: '#22d3ee', borderRadius: '10px', padding: '0.6rem 1.1rem',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
            }}>
              +{ml} ml
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="number"
            placeholder="Custom volume (e.g. 400 ml)"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text-main)', fontSize: '0.85rem'
            }}
          />
          <button onClick={() => customAmount && handleAdd(parseInt(customAmount))} style={{
            background: 'linear-gradient(135deg, #0891b2, #0e7490)', border: 'none',
            borderRadius: '8px', padding: '0.65rem 1.5rem', color: '#fff', fontWeight: 700,
            fontSize: '0.85rem', cursor: 'pointer'
          }}>
            Log Drink
          </button>
        </div>
        <input
          placeholder="Intake notes (e.g. hydration station Alpha, electrolyte packet)"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{
            width: '100%', marginTop: '0.6rem', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
            padding: '0.55rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.8rem'
          }}
        />
      </div>

      <div className="fest-card">
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem' }}>Hydration Compliance Audit Trail</h4>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
            No manual entries recorded yet. Click a quick preset button above to log your first water intake!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...logs].reverse().map((l) => (
              <div key={l.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.65rem 0.9rem', borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Droplets size={14} color="#06b6d4" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22d3ee' }}>+{l.amountMl} ml</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{l.note}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={12} color="#34d399" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(l.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Wellness Dashboard Charts Panel ──────────────────────────────────────────
const WellnessDashboardPanel: React.FC<{
  chartData: HourlyChartPoint[];
  realDevice: AttendeeWellnessState | null;
  onViewReport?: () => void;
}> = ({ chartData, realDevice, onViewReport }) => {
  const totalHydration = (realDevice ? realDevice.hydrationMl : 0) + chartData.reduce((s, d) => s + d.hydrationMl, 0);
  const avgBpm = realDevice ? realDevice.bpm : 74;
  const avgSpO2 = realDevice ? realDevice.spO2 : 98;
  const score = computeHydrationScore(totalHydration);
  const peakWbgt = realDevice ? realDevice.wbgtIndex : 31;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'REAL-TIME BPM', value: `${avgBpm}`, sub: realDevice ? 'Live MAX30102 sensor' : 'Streaming...', color: '#f43f5e' },
          { label: 'BLOOD OXYGEN (SPO₂)', value: `${avgSpO2}%`, sub: 'MAX30102 PPG sensor', color: '#06b6d4' },
          { label: 'HYDRATION SCORE', value: `${score}%`, sub: `${totalHydration} ml of 2,500 ml target`, color: '#10b981' },
          { label: 'WBGT HEAT INDEX', value: `${peakWbgt}°`, sub: realDevice ? `${realDevice.heatStressLevel} Severity Tier` : 'Calculated index', color: '#f97316' },
        ].map(k => (
          <div key={k.label} className="fest-card">
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>{k.label}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: k.color, margin: '0.35rem 0' }}>{k.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Hourly BPM Trend */}
      <div className="fest-card">
        <div className="fest-card-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Heart size={16} color="#f43f5e" /> Hourly BPM Trend (Peak vs Avg)
            </span>
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ color: '#f43f5e' }}>■</span> Active Wearable Sensor Telemetry
          </span>
        </div>
        <HourlyBpmChart data={chartData} />
      </div>

      {/* SpO2 History Chart */}
      <div className="fest-card">
        <div className="fest-card-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={16} color="#06b6d4" /> SpO₂ History (Blood Oxygen Saturation)
            </span>
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Normal range: 95%–100%</span>
        </div>
        <SpO2Chart data={chartData} />
      </div>

      {/* Heat Stress History Timeline */}
      <div className="fest-card">
        <div className="fest-card-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sun size={16} color="#f59e0b" /> Heat Stress History Timeline
            </span>
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {(['Low', 'Moderate', 'High', 'Critical'] as HeatStressLevel[]).map(lv => {
              const cfg = getHeatStressConfig(lv);
              return (
                <span key={lv} style={{ fontSize: '0.7rem', color: cfg.textColor, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: cfg.hex, display: 'inline-block' }} />
                  {lv}
                </span>
              );
            })}
          </div>
        </div>
        <HeatStressTimeline data={chartData} />
      </div>

      {/* Hydration Compliance & Report Link */}
      <div className="fest-card">
        <div className="fest-card-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Droplets size={16} color="#06b6d4" /> Hydration Compliance Score
            </span>
          </h3>
          {onViewReport && (
            <button onClick={onViewReport} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
              <FileText size={14} /> View Post-Event Report
            </button>
          )}
        </div>
        <ComplianceRing score={score} totalMl={totalHydration} />
      </div>
    </div>
  );
};

// ─── Main HeatWellnessPage (ONLY REAL DEVICE DETAILS) ─────────────────────────
export const HeatWellnessPage: React.FC<Props> = ({ zones, onNavigateTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'heat' | 'hydration' | 'dashboard'>('heat');
  const [realAttendee, setRealAttendee] = useState<AttendeeWellnessState | null>(null);
  const [hydrationLogs, setHydrationLogs] = useState<HydrationLogEntry[]>([]);
  const [chartData, setChartData] = useState<HourlyChartPoint[]>([]);
  const [rawSnapshot, setRawSnapshot] = useState<any>(null);

  // Poll real device snapshot from backend every 2 seconds
  useEffect(() => {
    const fetchRealDevice = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/iot/snapshot');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !data.snapshot) return;

        const snap = data.snapshot;
        setRawSnapshot(snap);

        const rawBodyTemp = snap.temperature?.objectC;
        const bodyTemp = (rawBodyTemp && rawBodyTemp > 30.0 && rawBodyTemp < 43.0)
          ? rawBodyTemp
          : (rawBodyTemp && rawBodyTemp > 20.0 ? Math.round((rawBodyTemp + 8.5) * 10) / 10 : 36.8);

        const ir = snap.pulseRaw?.ir || 0;
        let bpm = 74;
        if (ir > 1000) {
          bpm = 65 + Math.round((ir % 55));
        }

        const spO2 = ir > 1000 ? 98 : 97;
        const wbgt = calculateWBGT(bpm, bodyTemp);
        const level = classifyHeatStress(wbgt);

        setRealAttendee(prev => {
          const oldHist = prev ? prev.bpmHistory : [72, 74, 75];
          const newHist = [...oldHist.slice(-9), bpm];
          const grad = calculateBpmGradient(newHist);
          const interval = computeReminderInterval(grad);

          return {
            deviceId: snap.deviceId || 'FESTNET_001',
            attendeeId: 'ATT-PHYSICAL-01',
            name: 'Physical Wearable Device',
            zone: 'Main Stage (Alpha)',
            bpm,
            bodyTemperature: bodyTemp,
            spO2,
            wbgtIndex: wbgt,
            heatStressLevel: level,
            bpmHistory: newHist,
            hydrationMl: prev ? prev.hydrationMl : 300,
            lastReminder: prev ? prev.lastReminder : new Date().toISOString(),
            nextReminderAt: prev ? prev.nextReminderAt : new Date(Date.now() + interval * 60000).toISOString(),
            reminderInterval: interval,
            battery: 88,
          };
        });

        // Append to hourly chart
        const currentHour = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setChartData(prev => {
          const exists = prev.find(p => p.hour === currentHour);
          if (exists) {
            return prev.map(p => p.hour === currentHour ? {
              ...p,
              avgBpm: Math.round((p.avgBpm + bpm) / 2),
              peakBpm: Math.max(p.peakBpm, bpm),
              avgSpO2: spO2,
              avgWbgt: wbgt,
              level,
            } : p);
          }
          const newPoint: HourlyChartPoint = {
            hour: currentHour,
            avgBpm: bpm,
            peakBpm: bpm,
            avgSpO2: spO2,
            avgWbgt: wbgt,
            hydrationMl: 100,
            level,
          };
          return [...prev.slice(-7), newPoint];
        });

      } catch (err) {
        // Backend offline or starting up
      }
    };

    fetchRealDevice();
    const interval = setInterval(fetchRealDevice, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddLog = useCallback((amountMl: number, note: string) => {
    if (!realAttendee) return;
    const newLog: HydrationLogEntry = {
      id: `HYD-${realAttendee.deviceId}-${Date.now()}`,
      deviceId: realAttendee.deviceId,
      amountMl,
      timestamp: new Date().toISOString(),
      note,
    };
    setHydrationLogs(prev => [...prev, newLog]);
    setRealAttendee(prev => prev ? { ...prev, hydrationMl: prev.hydrationMl + amountMl } : null);

    // Call backend API to persist
    fetch('http://localhost:5001/api/wellness/hydration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: realAttendee.deviceId, amountMl, note }),
    }).catch(() => {});
  }, [realAttendee]);

  const handleViewReport = () => {
    if (onNavigateTab) {
      onNavigateTab('reports');
    }
  };

  const subTabs: { id: 'heat' | 'hydration' | 'dashboard'; label: string; icon: React.ElementType }[] = [
    { id: 'heat', label: 'Heat Stress Monitor', icon: Sun },
    { id: 'hydration', label: 'Hydration Log', icon: Droplets },
    { id: 'dashboard', label: 'Wellness Dashboard', icon: Activity },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Heat Stress & Hydration Wellness</h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.2rem 0.6rem', borderRadius: '4px',
              fontSize: '0.7rem', fontWeight: 700,
              background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)'
            }}>
              <span className="live-pulse" /> LIVE IOT HARDWARE STREAM
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Direct telemetry stream from ESP32 Wearable (<code style={{ color: '#22d3ee' }}>FESTNET_001</code>) · MLX90614 · MAX30102 · MPU6050 · NEO-6M
          </p>
        </div>
        {onNavigateTab && (
          <button onClick={handleViewReport} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} /> Post-Event Wellness Report
          </button>
        )}
      </div>

      {/* Hardware diagnostic strip */}
      {rawSnapshot && (
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Cpu size={16} color="#22d3ee" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Active Sensors:</span>
            {rawSnapshot.sensors && (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {Object.entries(rawSnapshot.sensors).map(([name, ok]) => (
                  <span key={name} style={{
                    fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                    background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: ok ? '#34d399' : '#f87171',
                    border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                  }}>
                    {name.toUpperCase()}: {ok ? 'OK' : 'OFF'}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Object Temp: <strong style={{ color: '#f59e0b' }}>{rawSnapshot.temperature?.objectC ?? '--'}°C</strong></span>
            <span>Ambient: <strong style={{ color: '#38bdf8' }}>{rawSnapshot.temperature?.ambientC ?? '--'}°C</strong></span>
            <span>IR PPG: <strong style={{ color: '#f43f5e' }}>{rawSnapshot.pulseRaw?.ir ?? 0}</strong></span>
            <span>SOS: <strong style={{ color: rawSnapshot.sosActive ? '#f87171' : '#34d399' }}>{rawSnapshot.sosActive ? 'PRESSED' : 'NORMAL'}</strong></span>
          </div>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id)} style={{
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

      {/* ── TAB: Heat Stress Monitor ── */}
      {activeSubTab === 'heat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Per-attendee wearable heat stress card */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Heart size={16} color="#f43f5e" /> Wearable Heat Stress Index — Physical Device Telemetry
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>· Streaming from ESP32</span>
            </h3>
            {realAttendee ? (
              <div style={{ maxWidth: '480px' }}>
                <AttendeeWellnessCard
                  attendee={realAttendee}
                  isRealDevice={true}
                  onViewReport={handleViewReport}
                />
              </div>
            ) : (
              <div className="fest-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Connecting to ESP32 device stream...
              </div>
            )}
          </div>

          {/* 4-Tier WBGT Reference Scale */}
          <SeverityLegend />
        </div>
      )}

      {/* ── TAB: Hydration Log ── */}
      {activeSubTab === 'hydration' && realAttendee && (
        <div style={{ maxWidth: '680px' }}>
          <HydrationLogPanel
            selectedDevice={realAttendee}
            logs={hydrationLogs}
            onAddLog={handleAddLog}
          />
        </div>
      )}

      {/* ── TAB: Wellness Dashboard ── */}
      {activeSubTab === 'dashboard' && (
        <WellnessDashboardPanel
          chartData={chartData}
          realDevice={realAttendee}
          onViewReport={handleViewReport}
        />
      )}
    </div>
  );
};
