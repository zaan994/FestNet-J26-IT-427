import 'package:festnet/models/device_latest.dart';
import 'package:festnet/models/enums.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the payload the current Arduino sketch sends', () {
    // Shape written by the current firmware (no vitals / anomaly yet), with
    // RTDB-style Map<Object?, Object?> and ints where doubles are expected.
    final Map<Object?, Object?> raw = {
      'deviceId': 'FESTNET_001',
      'online': true,
      'sosActive': false,
      'updatedAtMs': 123456,
      'sensors': {'mlx90614': true, 'max30102': true, 'mpu6050': false, 'oled': true},
      'temperature': {'ambientC': 29.5, 'objectC': 34},
      'pulseRaw': {'red': 98000, 'ir': 112000},
      'motion': {'ax': 0.1, 'ay': -0.2, 'az': 9.8, 'gx': 1, 'gy': 0, 'gz': 0},
      'gps': {'fix': false, 'latitude': null, 'longitude': null, 'satellites': 3},
    };

    final latest = DeviceLatest.fromMap(raw.map((k, v) => MapEntry(k.toString(), v)));

    expect(latest.deviceId, 'FESTNET_001');
    expect(latest.sensors.mpu6050, isFalse);
    expect(latest.temperature.objectC, 34.0);
    expect(latest.gps.fix, isFalse);
    expect(latest.gps.satellites, 3);
    expect(latest.vitals, isNull);
    expect(latest.anomaly, isNull);
    expect(latest.motion.state, MotionState.unknown);
  });

  test('parses C1 fields when present', () {
    final latest = DeviceLatest.fromMap({
      'deviceId': 'SIM_001',
      'vitals': {
        'contact': true,
        'bpm': 82,
        'spo2': 98,
        'hrv': {'rmssdMs': 41.5, 'sdnnMs': 50.2},
        'stress': {'score': 35, 'level': 'low'},
      },
      'anomaly': {'active': true, 'severity': 'danger', 'types': ['bpm_spike', 'high_temp'], 'since': 1760000000000},
    });

    expect(latest.vitals!.bpm, 82.0);
    expect(latest.vitals!.stressLevel, StressLevel.low);
    expect(latest.anomaly!.severity, Severity.danger);
    expect(latest.anomaly!.types, ['bpm_spike', 'high_temp']);
  });

  test('online status uses receive time', () {
    final now = DateTime(2026, 1, 1, 12);
    const offlineAfter = Duration(seconds: 15);
    expect(const DeviceSnapshot(latest: null, receivedAt: null).isOnline(offlineAfter, now: now), isFalse);
    expect(
      DeviceSnapshot(latest: null, receivedAt: now.subtract(const Duration(seconds: 5))).isOnline(offlineAfter, now: now),
      isTrue,
    );
    expect(
      DeviceSnapshot(latest: null, receivedAt: now.subtract(const Duration(seconds: 20))).isOnline(offlineAfter, now: now),
      isFalse,
    );
  });
}
