import 'package:festnet/models/device_health.dart';
import 'package:festnet/models/device_latest.dart';
import 'package:festnet/models/enums.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _rtdb(Map<Object?, Object?> raw) => raw.map((k, v) => MapEntry(k.toString(), v));

void main() {
  test('parses the latest payload the band sends', () {
    // RTDB-style map; null fields are absent; ints where doubles are expected.
    final latest = DeviceLatest.fromMap(_rtdb({
      'deviceId': 'FESTNET_001',
      'fwVersion': '0.3.0',
      'online': true,
      'sosActive': false,
      'sosPressCount': 2,
      'sensors': {'mlx90614': true, 'max30102': true, 'mpu6050': false, 'oled': true, 'gps': true},
      'temperature': {'ambientC': 29.5, 'objectC': 34},
      'pulseRaw': {'red': 98000, 'ir': 112000},
      'motion': {'ax': 0.1, 'ay': -0.2, 'az': 9.8, 'gx': 1, 'gy': 0, 'gz': 0},
      'gps': {'fix': false, 'satellites': 3},
      'net': {'transport': 'wifi', 'rssi': -61},
    }));

    expect(latest.deviceId, 'FESTNET_001');
    expect(latest.sosPressCount, 2);
    expect(latest.sensors.mpu6050, isFalse);
    expect(latest.temperature.objectC, 34.0);
    expect(latest.gps.fix, isFalse);
    expect(latest.gps.latitude, isNull);
    expect(latest.rssi, -61);
  });

  test('parses computed health from the backend', () {
    final health = DeviceHealth.fromMap(_rtdb({
      'deviceId': 'FESTNET_001',
      'seq': 261,
      'ts': 1760000002000,
      'worn': true,
      'signal': {'perfusionIndex': 1.18, 'beatsInChunk': 3, 'ppgSamples': 200, 'ppgOverflow': 0},
      'vitals': {
        'bpm': 82,
        'spo2': 98,
        'hrv': {'rmssdMs': 38.5, 'sdnnMs': 52.1, 'ibiCount': 64},
        'stress': {'score': 34, 'level': 'low', 'baselineReady': true},
      },
      'temperature': {'skinC': 34.21, 'ambientC': 29.81, 'coreEstC': 37.71},
      'motion': {'magG': 1.004, 'state': 'active', 'stillSec': 0},
      'anomaly': {
        'active': true,
        'severity': 'danger',
        'types': ['bpm_spike', 'high_temp'],
        'since': 1760000000000,
      },
      'latency': {'processingMs': 260},
    }));

    expect(health.worn, isTrue);
    expect(health.vitals.bpm, 82.0);
    expect(health.vitals.stressLevel, StressLevel.low);
    expect(health.vitals.baselineReady, isTrue);
    expect(health.temperature.coreEstC, 37.71);
    expect(health.motion.state, MotionState.active);
    expect(health.anomaly.severity, Severity.danger);
    expect(health.anomaly.types, ['bpm_spike', 'high_temp']);
    expect(health.processingMs, 260);
  });

  test('health without anomaly types (RTDB drops empty arrays)', () {
    final health = DeviceHealth.fromMap(_rtdb({
      'deviceId': 'X',
      'seq': 1,
      'ts': 1,
      'worn': false,
      'vitals': {'hrv': {'ibiCount': 0}, 'stress': {'level': 'unknown', 'baselineReady': false}},
      'temperature': <String, Object?>{},
      'motion': {'state': 'unknown', 'stillSec': 0},
      'anomaly': {'active': false, 'severity': 'none'},
    }));
    expect(health.vitals.bpm, isNull);
    expect(health.anomaly.types, isEmpty);
    expect(health.anomaly.severity, Severity.none);
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
