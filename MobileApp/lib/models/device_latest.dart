import 'json_utils.dart';

/// devices/{deviceId}/latest — raw readings written by the BAND every 2 s.
/// Mirrors docs/database/schema.md. Computed vitals are in [DeviceHealth].
class DeviceLatest {
  const DeviceLatest({
    required this.deviceId,
    required this.online,
    required this.sosActive,
    required this.sosPressCount,
    required this.sensors,
    required this.pulseRaw,
    required this.temperature,
    required this.motion,
    required this.gps,
    this.fwVersion,
    this.ts,
    this.rssi,
  });

  final String deviceId;
  final bool online;
  final bool sosActive;
  final int sosPressCount;
  final SensorStatus sensors;
  final PulseRaw pulseRaw;
  final TemperatureReading temperature;
  final MotionReading motion;
  final GpsReading gps;
  final String? fwVersion;
  final DateTime? ts;
  final int? rssi;

  factory DeviceLatest.fromMap(Map<String, dynamic> m) {
    final tsMs = asInt(m['ts']);
    return DeviceLatest(
      deviceId: asString(m['deviceId']) ?? '',
      online: asBool(m['online']),
      sosActive: asBool(m['sosActive']),
      sosPressCount: asInt(m['sosPressCount']) ?? 0,
      sensors: SensorStatus.fromMap(asMap(m['sensors'])),
      pulseRaw: PulseRaw.fromMap(asMap(m['pulseRaw'])),
      temperature: TemperatureReading.fromMap(asMap(m['temperature'])),
      motion: MotionReading.fromMap(asMap(m['motion'])),
      gps: GpsReading.fromMap(asMap(m['gps'])),
      fwVersion: asString(m['fwVersion']),
      ts: tsMs == null ? null : DateTime.fromMillisecondsSinceEpoch(tsMs),
      rssi: asInt(asMap(m['net'])['rssi']),
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
  const TemperatureReading({this.objectC, this.ambientC});

  final double? objectC; // skin (MLX90614 object)
  final double? ambientC;

  factory TemperatureReading.fromMap(Map<String, dynamic> m) =>
      TemperatureReading(objectC: asDouble(m['objectC']), ambientC: asDouble(m['ambientC']));
}

class MotionReading {
  const MotionReading({this.ax = 0, this.ay = 0, this.az = 0, this.gx = 0, this.gy = 0, this.gz = 0});

  final double ax, ay, az; // m/s^2
  final double gx, gy, gz; // deg/s

  factory MotionReading.fromMap(Map<String, dynamic> m) => MotionReading(
        ax: asDouble(m['ax']) ?? 0,
        ay: asDouble(m['ay']) ?? 0,
        az: asDouble(m['az']) ?? 0,
        gx: asDouble(m['gx']) ?? 0,
        gy: asDouble(m['gy']) ?? 0,
        gz: asDouble(m['gz']) ?? 0,
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

/// A `latest` snapshot plus the time this app received it (for online/offline status).
class DeviceSnapshot {
  const DeviceSnapshot({required this.latest, required this.receivedAt});

  final DeviceLatest? latest;

  /// Null for the stored value delivered on subscribe — only fresh uploads count as "seen".
  final DateTime? receivedAt;

  bool isOnline(Duration offlineAfter, {DateTime? now}) =>
      receivedAt != null && (now ?? DateTime.now()).difference(receivedAt!) < offlineAfter;
}
