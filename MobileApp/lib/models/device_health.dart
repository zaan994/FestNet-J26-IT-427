import 'enums.dart';
import 'json_utils.dart';

/// devices/{deviceId}/health — derived by the trusted backend from raw chunks.
/// The app never computes health values itself.
class DeviceHealth {
  const DeviceHealth({
    required this.deviceId,
    required this.worn,
    required this.heartRate,
    required this.spo2,
    required this.hrv,
    required this.temperature,
    required this.activity,
    required this.flags,
    required this.hri,
    this.assignmentId,
    this.computedAt,
    this.measuredAt,
  });

  final String deviceId;
  final String? assignmentId;
  final DateTime? computedAt;
  final DateTime? measuredAt;
  final bool worn;
  final HeartRate heartRate;
  final Spo2 spo2;
  final Hrv hrv;
  final SurfaceTemperature temperature;
  final Activity activity;
  final List<String> flags;
  final HriResult hri;

  factory DeviceHealth.fromMap(Map<String, dynamic> m) {
    final hr = asMap(m['heartRate']);
    final sp = asMap(m['spo2']);
    final hv = asMap(m['hrv']);
    final t = asMap(m['temperature']);
    final a = asMap(m['activity']);
    return DeviceHealth(
      deviceId: asString(m['deviceId']) ?? '',
      assignmentId: asString(m['assignmentId']),
      computedAt: asEpoch(m['computedAt']),
      measuredAt: asEpoch(m['measuredAt']),
      worn: m['worn'] == true,
      heartRate: HeartRate(bpm: asDouble(hr['bpm'], min: 20, max: 250), quality: MetricQuality.parse(hr['quality'])),
      spo2: Spo2(
        value: asDouble(sp['value'], min: 50, max: 100),
        quality: MetricQuality.parse(sp['quality']),
        // Display only if the backend explicitly enables it; it is never validated.
        displayEnabled: sp['displayEnabled'] == true,
      ),
      hrv: Hrv(rmssdMs: asDouble(hv['rmssdMs'], min: 0, max: 500), quality: MetricQuality.parse(hv['quality'])),
      temperature: SurfaceTemperature(
        surfaceC: asDouble(t['surfaceC'], min: -20, max: 80),
        ambientC: asDouble(t['ambientC'], min: -40, max: 85),
      ),
      activity: Activity(
        level: ActivityLevel.parse(a['level']),
        stillSec: asInt(a['stillSec']) ?? 0,
        impactDetected: a['impactDetected'] == true,
      ),
      flags: asStringList(asMap(m['signal'])['flags']),
      hri: HriResult.fromMap(asMap(m['hri'])),
    );
  }
}

class HeartRate {
  const HeartRate({required this.quality, this.bpm});
  final double? bpm;
  final MetricQuality quality;
}

class Spo2 {
  const Spo2({required this.quality, required this.displayEnabled, this.value});
  final double? value;
  final MetricQuality quality;
  final bool displayEnabled;
}

class Hrv {
  const Hrv({required this.quality, this.rmssdMs});
  final double? rmssdMs;
  final MetricQuality quality;
}

class SurfaceTemperature {
  const SurfaceTemperature({this.surfaceC, this.ambientC});

  /// MLX90614 object temperature = skin/band SURFACE temperature, not core body temperature.
  final double? surfaceC;
  final double? ambientC;
}

class Activity {
  const Activity({required this.level, required this.stillSec, required this.impactDetected});
  final ActivityLevel level;
  final int stillSec;
  final bool impactDetected;
}

class HriFactor {
  const HriFactor({required this.ruleId, required this.label, required this.points, required this.detail});
  final String ruleId;
  final String label;
  final int points;
  final String detail;

  factory HriFactor.fromMap(Map<String, dynamic> m) => HriFactor(
        ruleId: asString(m['ruleId']) ?? '',
        label: asString(m['label']) ?? '',
        points: asInt(m['points']) ?? 0,
        detail: asString(m['detail']) ?? '',
      );
}

/// Experimental, unvalidated Health Risk Indicator. A null score means "not enough valid
/// data" — it never means low risk.
class HriResult {
  const HriResult({
    required this.status,
    required this.confidence,
    required this.confidenceValue,
    required this.factors,
    required this.availableInputs,
    required this.missingInputs,
    required this.flags,
    required this.baselineAvailable,
    this.score,
    this.calculatedAt,
  });

  final int? score;
  final HriStatus status;
  final ConfidenceLevel confidence;
  final double confidenceValue;
  final DateTime? calculatedAt;
  final List<HriFactor> factors;
  final List<String> availableInputs;
  final List<String> missingInputs;
  final List<String> flags;
  final bool baselineAvailable;

  factory HriResult.fromMap(Map<String, dynamic> m) {
    final conf = asMap(m['confidence']);
    final dq = asMap(m['dataQuality']);
    final rawFactors = m['contributingFactors'];
    final factorMaps = rawFactors is List ? rawFactors : (rawFactors is Map ? rawFactors.values.toList() : const []);
    return HriResult(
      score: asInt(m['hriScore'], min: 0, max: 100),
      status: HriStatus.parse(m['status']),
      confidence: ConfidenceLevel.parse(conf['level']),
      confidenceValue: asDouble(conf['value'], min: 0, max: 1) ?? 0,
      calculatedAt: asEpoch(m['calculatedAt']),
      factors: factorMaps.map((f) => HriFactor.fromMap(asMap(f))).toList(),
      availableInputs: asStringList(m['availableInputs']),
      missingInputs: asStringList(m['missingInputs']),
      flags: asStringList(dq['flags']),
      baselineAvailable: m['baselineAvailable'] == true,
    );
  }
}

/// healthHistory/{assignmentId}/{pushId} — compact 10-s snapshot of the current assignment.
class HistoryPoint {
  const HistoryPoint({required this.ts, required this.bpmQuality, required this.hriStatus, this.bpm, this.hriScore, this.surfaceC});

  final DateTime ts;
  final double? bpm;
  final MetricQuality bpmQuality;
  final int? hriScore;
  final HriStatus hriStatus;
  final double? surfaceC;

  /// Heart rate for charts: only valid readings.
  double? get validBpm => bpmQuality == MetricQuality.valid ? bpm : null;

  static HistoryPoint? fromMap(Map<String, dynamic> m) {
    final ts = asEpoch(m['ts']);
    if (ts == null) return null;
    return HistoryPoint(
      ts: ts,
      bpm: asDouble(m['bpm'], min: 20, max: 250),
      bpmQuality: MetricQuality.parse(m['bpmQuality']),
      hriScore: asInt(m['hriScore'], min: 0, max: 100),
      hriStatus: HriStatus.parse(m['hriStatus']),
      surfaceC: asDouble(m['surfaceC'], min: -20, max: 80),
    );
  }
}
