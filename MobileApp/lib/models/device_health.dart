import 'enums.dart';
import 'json_utils.dart';

/// devices/{deviceId}/health — vitals and anomaly state computed by the C1 backend
/// processor from the band's raw signals. Mirrors `DeviceHealth` in
/// Backend/functions/src/shared/schema.ts.
class DeviceHealth {
  const DeviceHealth({
    required this.deviceId,
    required this.seq,
    required this.ts,
    required this.worn,
    required this.vitals,
    required this.temperature,
    required this.motion,
    required this.anomaly,
    this.perfusionIndex,
    this.beatsInChunk = 0,
    this.processingMs,
  });

  final String deviceId;
  final int seq;
  final DateTime ts;
  final bool worn;
  final HealthVitals vitals;
  final HealthTemperature temperature;
  final HealthMotion motion;
  final HealthAnomaly anomaly;
  final double? perfusionIndex;
  final int beatsInChunk;
  final int? processingMs;

  factory DeviceHealth.fromMap(Map<String, dynamic> m) {
    final signal = asMap(m['signal']);
    return DeviceHealth(
      deviceId: asString(m['deviceId']) ?? '',
      seq: asInt(m['seq']) ?? 0,
      ts: DateTime.fromMillisecondsSinceEpoch(asInt(m['ts']) ?? 0),
      worn: asBool(m['worn']),
      vitals: HealthVitals.fromMap(asMap(m['vitals'])),
      temperature: HealthTemperature.fromMap(asMap(m['temperature'])),
      motion: HealthMotion.fromMap(asMap(m['motion'])),
      anomaly: HealthAnomaly.fromMap(asMap(m['anomaly'])),
      perfusionIndex: asDouble(signal['perfusionIndex']),
      beatsInChunk: asInt(signal['beatsInChunk']) ?? 0,
      processingMs: asInt(asMap(m['latency'])['processingMs']),
    );
  }
}

class HealthVitals {
  const HealthVitals({
    this.bpm,
    this.spo2,
    this.rmssdMs,
    this.sdnnMs,
    this.ibiCount = 0,
    this.stressScore,
    this.stressLevel = StressLevel.unknown,
    this.baselineReady = false,
  });

  final double? bpm;
  final double? spo2;
  final double? rmssdMs;
  final double? sdnnMs;
  final int ibiCount;
  final double? stressScore;
  final StressLevel stressLevel;
  final bool baselineReady;

  factory HealthVitals.fromMap(Map<String, dynamic> m) {
    final hrv = asMap(m['hrv']);
    final stress = asMap(m['stress']);
    return HealthVitals(
      bpm: asDouble(m['bpm']),
      spo2: asDouble(m['spo2']),
      rmssdMs: asDouble(hrv['rmssdMs']),
      sdnnMs: asDouble(hrv['sdnnMs']),
      ibiCount: asInt(hrv['ibiCount']) ?? 0,
      stressScore: asDouble(stress['score']),
      stressLevel: StressLevel.parse(stress['level']),
      baselineReady: asBool(stress['baselineReady']),
    );
  }
}

class HealthTemperature {
  const HealthTemperature({this.skinC, this.ambientC, this.coreEstC});

  final double? skinC;
  final double? ambientC;
  final double? coreEstC;

  factory HealthTemperature.fromMap(Map<String, dynamic> m) => HealthTemperature(
        skinC: asDouble(m['skinC']),
        ambientC: asDouble(m['ambientC']),
        coreEstC: asDouble(m['coreEstC']),
      );
}

class HealthMotion {
  const HealthMotion({this.magG, this.state = MotionState.unknown, this.stillSec = 0});

  final double? magG;
  final MotionState state;
  final int stillSec;

  factory HealthMotion.fromMap(Map<String, dynamic> m) => HealthMotion(
        magG: asDouble(m['magG']),
        state: MotionState.parse(m['state']),
        stillSec: asInt(m['stillSec']) ?? 0,
      );
}

class HealthAnomaly {
  const HealthAnomaly({this.active = false, this.severity = Severity.none, this.types = const [], this.since});

  final bool active;
  final Severity severity;
  final List<String> types;
  final DateTime? since;

  factory HealthAnomaly.fromMap(Map<String, dynamic> m) {
    final sinceMs = asInt(m['since']);
    return HealthAnomaly(
      active: asBool(m['active']),
      severity: Severity.parse(m['severity']),
      types: asStringList(m['types']),
      since: sinceMs == null ? null : DateTime.fromMillisecondsSinceEpoch(sinceMs),
    );
  }
}

/// devices/{deviceId}/history/{pushId} — computed snapshot every 10 s.
class HistoryPoint {
  const HistoryPoint({
    required this.ts,
    this.bpm,
    this.spo2,
    this.rmssdMs,
    this.stressScore,
    this.coreEstC,
    this.motionState = MotionState.unknown,
    this.severity = Severity.none,
    this.worn = false,
  });

  final DateTime ts;
  final double? bpm;
  final double? spo2;
  final double? rmssdMs;
  final double? stressScore;
  final double? coreEstC;
  final MotionState motionState;
  final Severity severity;
  final bool worn;

  factory HistoryPoint.fromMap(Map<String, dynamic> m) => HistoryPoint(
        ts: DateTime.fromMillisecondsSinceEpoch(asInt(m['ts']) ?? 0),
        bpm: asDouble(m['bpm']),
        spo2: asDouble(m['spo2']),
        rmssdMs: asDouble(m['rmssdMs']),
        stressScore: asDouble(m['stressScore']),
        coreEstC: asDouble(m['coreEstC']),
        motionState: MotionState.parse(m['motionState']),
        severity: Severity.parse(m['severity']),
        worn: asBool(m['worn']),
      );
}

/// Human-readable anomaly names (schema: anomaly.types).
const anomalyLabels = <String, String>{
  'bpm_spike': 'Heart-rate spike',
  'low_spo2': 'Low blood oxygen',
  'high_temp': 'High body temperature',
  'stillness': 'No movement',
  'fall': 'Fall detected',
  'sos': 'SOS pressed',
};
