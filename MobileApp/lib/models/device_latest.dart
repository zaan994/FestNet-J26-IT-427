import 'json_utils.dart';

/// devices/{deviceId}/latest — raw telemetry written by the band (firmware v0.3.x).
/// Mirrors the safe parser in Backend/functions/src/shared/telemetry.ts:
///  - raw red/IR counts are NOT a heart rate or SpO2,
///  - MLX90614 object temperature is a SURFACE temperature, not core body temperature,
///  - `online: true` is not freshness — use the time the update was received,
///  - "sensor detected" is not "measurement valid".
class DeviceLatest {
  const DeviceLatest({
    required this.deviceId,
    required this.sosActive,
    required this.sensors,
    required this.surfaceC,
    required this.ambientC,
    required this.gpsFix,
    this.fwVersion,
    this.deviceTs,
    this.serverTs,
    this.sosPressCount,
    this.batteryPct,
    this.rssi,
    this.latitude,
    this.longitude,
    this.redRaw,
    this.irRaw,
  });

  final String deviceId;
  final String? fwVersion;

  /// Device (NTP) clock — null when the band has no synchronised time.
  final DateTime? deviceTs;

  /// Firebase server receipt time.
  final DateTime? serverTs;
  final bool sosActive;
  final int? sosPressCount;
  final SensorsDetected sensors;
  final double? surfaceC;
  final double? ambientC;

  /// Not measured by the current hardware: null = unavailable.
  final int? batteryPct;
  final int? rssi;
  final bool gpsFix;
  final double? latitude;
  final double? longitude;

  /// Raw MAX30102 ADC counts (only for diagnostics; never BPM/SpO2).
  final int? redRaw;
  final int? irRaw;

  bool get clockSynced => deviceTs != null;

  factory DeviceLatest.fromMap(Map<String, dynamic> m, {DateTime? now}) {
    final temp = asMap(m['temperature']);
    final gps = asMap(m['gps']);
    final pulse = asMap(m['pulseRaw']);
    final fix = asBool(gps['fix']);
    final lat = asDouble(gps['latitude'], min: -90, max: 90);
    final lng = asDouble(gps['longitude'], min: -180, max: 180);
    final hasLocation = fix && lat != null && lng != null && !(lat == 0 && lng == 0);
    return DeviceLatest(
      deviceId: asString(m['deviceId']) ?? '',
      fwVersion: asString(m['fwVersion']),
      deviceTs: asEpoch(m['ts'], now: now),
      serverTs: asEpoch(m['serverTs'], now: now),
      sosActive: m['sosActive'] == true,
      sosPressCount: asInt(m['sosPressCount'], min: 0),
      sensors: SensorsDetected.fromMap(asMap(m['sensors'])),
      surfaceC: asDouble(temp['objectC'], min: -20, max: 80),
      ambientC: asDouble(temp['ambientC'], min: -40, max: 85),
      batteryPct: asInt(asMap(m['battery'])['pct'], min: 0, max: 100),
      rssi: asInt(asMap(m['net'])['rssi'], min: -127, max: 0),
      gpsFix: fix,
      latitude: hasLocation ? lat : null,
      longitude: hasLocation ? lng : null,
      redRaw: asInt(pulse['red'], min: 0, max: 262143),
      irRaw: asInt(pulse['ir'], min: 0, max: 262143),
    );
  }
}

/// Which sensors answered at boot (null = unknown). Detection ≠ valid measurement.
class SensorsDetected {
  const SensorsDetected({this.ppg, this.imu, this.temperature, this.gps});

  final bool? ppg;
  final bool? imu;
  final bool? temperature;
  final bool? gps;

  factory SensorsDetected.fromMap(Map<String, dynamic> m) => SensorsDetected(
        ppg: asBoolOrNull(m['max30102']),
        imu: asBoolOrNull(m['mpu6050']),
        temperature: asBoolOrNull(m['mlx90614']),
        gps: asBoolOrNull(m['gps']),
      );
}

/// A `latest` value plus the time this app received it.
class DeviceSnapshot {
  const DeviceSnapshot({required this.latest, required this.receivedAt});

  final DeviceLatest? latest;

  /// Client time the value last CHANGED. Null for the cached value delivered on subscribe.
  final DateTime? receivedAt;

  /// Best known receive time: client receive time, else the server timestamp.
  DateTime? get lastSeenAt => receivedAt ?? latest?.serverTs;
}
