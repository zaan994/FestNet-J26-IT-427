import 'package:festnet/core/config/app_config.dart';
import 'package:festnet/core/utils/formatters.dart';
import 'package:festnet/models/attendee.dart';
import 'package:festnet/models/device_health.dart';
import 'package:festnet/models/device_latest.dart';
import 'package:festnet/models/enums.dart';
import 'package:festnet/models/responder.dart';
import 'package:festnet/repositories/responder_repository.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _health({String quality = 'valid', bool worn = true, bool spo2Display = false}) => {
      'deviceId': 'FESTNET_001',
      'assignmentId': 'A-TEST01',
      'worn': worn,
      'heartRate': {'bpm': 72, 'quality': quality},
      'spo2': {'value': 97, 'quality': 'valid', 'displayEnabled': spo2Display},
      'hrv': {'quality': 'unavailable'},
      'temperature': {'surfaceC': 33.4},
      'activity': {'level': 'rest', 'stillSec': 0, 'impactDetected': false},
      'signal': {'flags': ['low_perfusion']},
      'hri': {
        'status': 'insufficient_data',
        'confidence': {'level': 'none', 'value': 0},
        'contributingFactors': [],
        'availableInputs': [],
        'missingInputs': ['heart_rate'],
        'dataQuality': {'flags': []},
      },
    };

void main() {
  group('DeviceLatest parsing (firmware v0.3.1)', () {
    test('missing / invalid values become null, never 0', () {
      final l = DeviceLatest.fromMap({
        'deviceId': 'FESTNET_001',
        'online': true,
        'temperature': {'objectC': 999, 'ambientC': null},
        'battery': {'pct': null},
        'gps': {'fix': true, 'latitude': 0, 'longitude': 0},
        'ts': 12345, // millis() before NTP sync
      });
      expect(l.surfaceC, isNull);
      expect(l.ambientC, isNull);
      expect(l.batteryPct, isNull);
      expect(l.latitude, isNull, reason: '0,0 is not a real fix');
      expect(l.clockSynced, isFalse);
    });

    test('online flag is not freshness', () {
      final now = DateTime(2026, 10, 20, 12);
      final l = DeviceLatest.fromMap({'deviceId': 'X', 'online': true, 'serverTs': now.subtract(const Duration(minutes: 10)).millisecondsSinceEpoch}, now: now);
      final snap = DeviceSnapshot(latest: l, receivedAt: null);
      expect(freshnessOf(snap.lastSeenAt, now), Freshness.offline);
      expect(freshnessOf(now.subtract(const Duration(seconds: 3)), now), Freshness.live);
      expect(freshnessOf(null, now), Freshness.unknown);
    });
  });

  group('display rules', () {
    test('BPM only when valid and worn', () {
      expect(bpmText(DeviceHealth.fromMap(_health())), '72 bpm');
      expect(bpmText(DeviceHealth.fromMap(_health(quality: 'low_quality'))), unavailable);
      expect(bpmText(DeviceHealth.fromMap(_health(worn: false))), unavailable);
      expect(bpmText(null), unavailable);
    });

    test('SpO2 is not shown unless display is enabled', () {
      expect(spo2Text(DeviceHealth.fromMap(_health())), unavailable);
    });

    test('missing HRV and temperature are unavailable', () {
      expect(hrvText(DeviceHealth.fromMap(_health())), unavailable);
      expect(surfaceTempText(null), unavailable);
    });

    test('null HRI score is insufficient data', () {
      final h = DeviceHealth.fromMap(_health());
      expect(h.hri.score, isNull);
      expect(h.hri.status, HriStatus.insufficientData);
      expect(h.hri.confidence.isLow, isTrue);
    });
  });

  group('C2 responder models', () {
    test('inbox alert: SOS, severity, status and location validation', () {
      final a = InboxAlert.fromMap({
        'alertId': 'x1',
        'eventId': 'fest-1',
        'type': 'sos',
        'severity': 'critical',
        'status': 'escalated',
        'summary': 'SOS button pressed on the band',
        'role': 'volunteer',
        'createdAt': 1790000000000,
        'location': {'latitude': 6.98, 'longitude': 79.9, 'fixAt': 1790000000000},
      })!;
      expect(a.isSos, isTrue);
      expect(a.severity, AlertSeverity.critical);
      expect(a.status, EmergencyStatus.escalated);
      expect(a.unacknowledged, isTrue);
      expect(a.hasLocation, isTrue);
      final noFix = InboxAlert.fromMap({'alertId': 'x2', 'eventId': 'e', 'createdAt': 1790000000000, 'location': {'latitude': 0, 'longitude': 0}})!;
      expect(noFix.hasLocation, isFalse);
      expect(InboxAlert.fromMap({'alertId': 'x3'}), isNull);
    });

    test('volunteers cannot resolve; staff of the event can', () {
      const roles = ResponderRoles(staff: {'fest-1': 'medicalResponder'}, volunteerEvents: {'fest-2'});
      expect(roles.isResponder, isTrue);
      expect(roles.canResolve('fest-1'), isTrue);
      expect(roles.canResolve('fest-2'), isFalse);
      expect(ResponderRoles.none.isResponder, isFalse);
    });

    test('push token keys are stable and database-safe', () {
      final k = tokenKey('abc:DEF-123_xyz.token/with#chars');
      expect(k, tokenKey('abc:DEF-123_xyz.token/with#chars'));
      expect(RegExp(r'^[a-z0-9-]+$').hasMatch(k), isTrue);
    });
  });

  group('attendee models', () {
    test('incomplete attendee link is rejected', () {
      expect(AttendeeLink.fromMap({'participantId': 'P-AAAAAAAA'}), isNull);
    });

    test('SOS request status', () {
      final pending = SosRequestStatus.fromMap('r1', {'clientCreatedAt': 1760000000000})!;
      expect(pending.delivered, isFalse);
      final received = SosRequestStatus.fromMap('r2', {'clientCreatedAt': 1760000000000, 'status': 'received', 'alertStatus': 'acknowledged'})!;
      expect(received.delivered, isTrue);
      expect(received.alertStatus, EmergencyStatus.acknowledged);
    });
  });
}
