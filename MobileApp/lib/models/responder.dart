import 'enums.dart';
import 'json_utils.dart';

/// Responder roles of the signed-in account, per event (granted server-side only):
///   staffEvents/{uid}/{eventId}     = eventOperator | medicalResponder | secondaryResponder
///   volunteerEvents/{uid}/{eventId} = true
class ResponderRoles {
  const ResponderRoles({required this.staff, required this.volunteerEvents});

  final Map<String, String> staff;
  final Set<String> volunteerEvents;

  bool get isResponder => staff.isNotEmpty || volunteerEvents.isNotEmpty;
  bool get isStaff => staff.isNotEmpty;

  /// Volunteers may only accept / start; staff may also resolve (validated again by the backend).
  bool canResolve(String eventId) => staff.containsKey(eventId);

  String describe() {
    final labels = <String>{
      for (final r in staff.values)
        switch (r) {
          'eventOperator' => 'Event operator',
          'medicalResponder' => 'Medical responder',
          'secondaryResponder' => 'Secondary responder',
          _ => r,
        },
      if (volunteerEvents.isNotEmpty) 'Volunteer',
    };
    return labels.join(' · ');
  }

  static const none = ResponderRoles(staff: {}, volunteerEvents: {});
}

/// emergency/inbox/{uid}/{alertId} — an alert sent to this responder (no health details).
class InboxAlert {
  const InboxAlert({
    required this.alertId,
    required this.eventId,
    required this.isSos,
    required this.severity,
    required this.status,
    required this.summary,
    required this.role,
    required this.createdAt,
    this.deviceId,
    this.latitude,
    this.longitude,
    this.fixAt,
  });

  final String alertId;
  final String eventId;
  final String? deviceId;
  final bool isSos;
  final AlertSeverity severity;
  final EmergencyStatus status;
  final String summary;
  final String role;
  final DateTime createdAt;
  final double? latitude;
  final double? longitude;
  final DateTime? fixAt;

  bool get unacknowledged => status == EmergencyStatus.open || status == EmergencyStatus.escalated;
  bool get hasLocation => latitude != null && longitude != null;

  static InboxAlert? fromMap(Map<String, dynamic> m) {
    final alertId = asString(m['alertId']);
    final eventId = asString(m['eventId']);
    final created = asEpoch(m['createdAt']);
    if (alertId == null || eventId == null || created == null) return null;
    final loc = asMap(m['location']);
    final lat = asDouble(loc['latitude'], min: -90, max: 90);
    final lng = asDouble(loc['longitude'], min: -180, max: 180);
    final valid = lat != null && lng != null && !(lat == 0 && lng == 0);
    return InboxAlert(
      alertId: alertId,
      eventId: eventId,
      deviceId: asString(m['deviceId']),
      isSos: m['type'] == 'sos',
      severity: AlertSeverity.parse(m['severity']),
      status: EmergencyStatus.tryParse(m['status']) ?? EmergencyStatus.open,
      summary: asString(m['summary']) ?? '',
      role: asString(m['role']) ?? '',
      createdAt: created,
      latitude: valid ? lat : null,
      longitude: valid ? lng : null,
      fixAt: valid ? asEpoch(loc['fixAt']) : null,
    );
  }
}

/// emergency/responders/{uid} — the responder's own duty / location record.
class ResponderRecord {
  const ResponderRecord({required this.onDuty, this.locationUpdatedAt, this.tokenCount = 0});

  final bool onDuty;
  final DateTime? locationUpdatedAt;
  final int tokenCount;

  factory ResponderRecord.fromMap(Map<String, dynamic> m) => ResponderRecord(
        onDuty: m['onDuty'] == true,
        locationUpdatedAt: asEpoch(m['locationUpdatedAt']),
        tokenCount: asMap(m['tokens']).length,
      );

  static const empty = ResponderRecord(onDuty: false);
}
