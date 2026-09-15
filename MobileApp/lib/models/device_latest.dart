import 'enums.dart';
import 'json_utils.dart';

/// devices/{deviceId}/latest — mirrors docs/database/schema.md.
/// Every field not yet written by the current firmware is nullable.
class DeviceLatest {
  const DeviceLatest({
    required this.deviceId,
    required this.online,
    required this.sosActive,
    required this.sensors,
    required this.pulseRaw,
    required this.temperature,
    required this.motion,
    required this.gps,
    this.fwVersion,
    this.ts,
    this.vitals,
    this.anomaly,
  });

  final String deviceId;
  final bool online;
  final bool sosActive;
  final SensorStatus sensors;
  final PulseRaw pulseRaw;
  final TemperatureReading temperature;
  final MotionReading motion;
  final GpsReading gps;
  final String? fwVersion;
  final DateTime? ts;
  final Vitals? vitals; // C1
  final AnomalyStatus? anomaly; // C1

  factory DeviceLatest.fromMap(Map<String, dynamic> m) {
    final tsMs = asInt(m['ts']);
    return DeviceLatest(
      deviceId: asString(m['deviceId']) ?? '',
      online: asBool(m['online']),
      sosActive: asBool(m['sosActive']),
      sensors: SensorStatus.fromMap(asMap(m['sensors'])),
      pulseRaw: PulseRaw.fromMap(asMap(m['pulseRaw'])),
      temperature: TemperatureReading.fromMap(asMap(m['temperature'])),
      motion: MotionReading.fromMap(asMap(m['motion'])),
      gps: GpsReading.fromMap(asMap(m['gps'])),
      fwVersion: asString(m['fwVersion']),
      ts: tsMs == null ? null : DateTime.fromMillisecondsSinceEpoch(tsMs),
      vitals: m['vitals'] == null ? null : Vitals.fromMap(asMap(m['vitals'])),
      anomaly: m['anomaly'] == null ? null : AnomalyStatus.fromMap(asMap(m['anomaly'])),
    );
  }
}

class SensorStatus {
  const SensorStatus({required this.oled, required this.mlx90614, required this.max30102, required this.mpu6050, this.gps});

  final bool oled;
  final bool mlx90614;
  final bool max30102;
  final bool mpu6050;
  final bool? gps;

  factory SensorStatus.fromMap(Map<String, dynamic> m) => SensorStatus(
        oled: asBool(m['oled']),
        mlx90614: asBool(m['mlx90614']),
        max30102: asBool(m['max30102']),
        mpu6050: asBool(m['mpu6050']),
        gps: m['gps'] is bool ? m['gps'] as bool : null,
      );
}

class PulseRaw {
  const PulseRaw({required this.red, required this.ir});

  final int red;
  final int ir;

  factory PulseRaw.fromMap(Map<String, dynamic> m) => PulseRaw(red: asInt(m['red']) ?? 0, ir: asInt(m['ir']) ?? 0);
}

class TemperatureReading {
  const TemperatureReading({this.objectC, this.ambientC, this.coreEstC});

  final double? objectC;
  final double? ambientC;
  final double? coreEstC; // C1

  factory TemperatureReading.fromMap(Map<String, dynamic> m) => TemperatureReading(
        objectC: asDouble(m['objectC']),
        ambientC: asDouble(m['ambientC']),
        coreEstC: asDouble(m['coreEstC']),
      );
}

class MotionReading {
  const MotionReading({
    this.ax = 0,
    this.ay = 0,
    this.az = 0,
    this.gx = 0,
    this.gy = 0,
    this.gz = 0,
    this.magG,
    this.state = MotionState.unknown,
    this.stillSec,
  });

  final double ax, ay, az; // m/s^2
  final double gx, gy, gz; // deg/s
  final double? magG; // C1
  final MotionState state; // C1
  final int? stillSec; // C1

  factory MotionReading.fromMap(Map<String, dynamic> m) => MotionReading(
        ax: asDouble(m['ax']) ?? 0,
        ay: asDouble(m['ay']) ?? 0,
        az: asDouble(m['az']) ?? 0,
        gx: asDouble(m['gx']) ?? 0,
        gy: asDouble(m['gy']) ?? 0,
        gz: asDouble(m['gz']) ?? 0,
        magG: asDouble(m['magG']),
        state: MotionState.parse(m['state']),
        stillSec: asInt(m['stillSec']),
      );
}

class GpsReading {
  const GpsReading({required this.fix, this.latitude, this.longitude, this.satellites = 0, this.speedMps, this.headingDeg});

  final bool fix;
  final double? latitude;
  final double? longitude;
  final int satellites;
  final double? speedMps; // C3
  final double? headingDeg; // C3

  factory GpsReading.fromMap(Map<String, dynamic> m) => GpsReading(
        fix: asBool(m['fix']),
        latitude: asDouble(m['latitude']),
        longitude: asDouble(m['longitude']),
        satellites: asInt(m['satellites']) ?? 0,
        speedMps: asDouble(m['speedMps']),
        headingDeg: asDouble(m['headingDeg']),
      );
}

/// C1 outputs.
class Vitals {
  const Vitals({
    required this.contact,
    this.bpm,
    this.spo2,
    this.rmssdMs,
    this.sdnnMs,
    this.stressScore,
    this.stressLevel = StressLevel.unknown,
  });

  final bool contact;
  final double? bpm;
  final double? spo2;
  final double? rmssdMs;
  final double? sdnnMs;
  final double? stressScore;
  final StressLevel stressLevel;

  factory Vitals.fromMap(Map<String, dynamic> m) {
    final hrv = asMap(m['hrv']);
    final stress = asMap(m['stress']);
    return Vitals(
      contact: asBool(m['contact']),
      bpm: asDouble(m['bpm']),
      spo2: asDouble(m['spo2']),
      rmssdMs: asDouble(hrv['rmssdMs']),
      sdnnMs: asDouble(hrv['sdnnMs']),
      stressScore: asDouble(stress['score']),
      stressLevel: StressLevel.parse(stress['level']),
    );
  }
}

/// C1 anomaly status.
class AnomalyStatus {
  const AnomalyStatus({required this.active, required this.severity, this.types = const [], this.since, this.latencyUs});

  final bool active;
  final Severity severity;
  final List<String> types;
  final DateTime? since;
  final int? latencyUs;

  factory AnomalyStatus.fromMap(Map<String, dynamic> m) {
    final sinceMs = asInt(m['since']);
    return AnomalyStatus(
      active: asBool(m['active']),
      severity: Severity.parse(m['severity']),
      types: asStringList(m['types']),
      since: sinceMs == null ? null : DateTime.fromMillisecondsSinceEpoch(sinceMs),
      latencyUs: asInt(m['latencyUs']),
    );
  }
}

/// A `latest` snapshot plus the time this app received it (for online/offline status).
class DeviceSnapshot {
  const DeviceSnapshot({required this.latest, required this.receivedAt});

  final DeviceLatest? latest;

  /// Null for the stored value delivered on subscribe — only fresh uploads count as "seen".
  final DateTime? receivedAt;

  bool isOnline(Duration offlineAfter, {DateTime? now}) =>
      receivedAt != null && (now ?? DateTime.now()).difference(receivedAt!) < offlineAfter;
}
