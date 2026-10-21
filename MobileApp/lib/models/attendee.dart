import 'enums.dart';
import 'json_utils.dart';

/// attendeeLinks/{uid} — written by the backend after a valid one-time claim code is redeemed.
class AttendeeLink {
  const AttendeeLink({required this.participantId, required this.eventId, required this.deviceId, required this.assignmentId, this.linkedAt});

  final String participantId;
  final String eventId;
  final String deviceId;
  final String assignmentId;
  final DateTime? linkedAt;

  static AttendeeLink? fromMap(Map<String, dynamic> m) {
    final participantId = asString(m['participantId']);
    final eventId = asString(m['eventId']);
    final deviceId = asString(m['deviceId']);
    final assignmentId = asString(m['assignmentId']);
    if (participantId == null || eventId == null || deviceId == null || assignmentId == null) return null;
    return AttendeeLink(
      participantId: participantId,
      eventId: eventId,
      deviceId: deviceId,
      assignmentId: assignmentId,
      linkedAt: asEpoch(m['linkedAt']),
    );
  }
}

class HelpPoint {
  const HelpPoint({required this.name, this.description, this.zone});
  final String name;
  final String? description;
  final String? zone;
}

/// eventsPublic/{eventId} — attendee-visible event information (no health data).
class EventPublicInfo {
  const EventPublicInfo({
    required this.name,
    required this.status,
    required this.demo,
    required this.helpPoints,
    required this.safetyInfo,
    this.contact,
    this.privacyContact,
    this.dataRetention,
  });

  final String name;
  final String status;
  final bool demo;
  final List<HelpPoint> helpPoints;
  final List<String> safetyInfo;
  final String? contact;
  final String? privacyContact;
  final String? dataRetention;

  factory EventPublicInfo.fromMap(Map<String, dynamic> m) => EventPublicInfo(
        name: asString(m['name']) ?? 'Event',
        status: asString(m['status']) ?? 'planned',
        demo: m['demo'] == true,
        helpPoints: asMap(m['helpPoints'])
            .values
            .map((v) => asMap(v))
            .where((h) => asString(h['name']) != null)
            .map((h) => HelpPoint(name: asString(h['name'])!, description: asString(h['description']), zone: asString(h['zone'])))
            .toList(),
        safetyInfo: asStringList(m['safetyInfo']),
        contact: asString(m['contact']),
        privacyContact: asString(m['privacyContact']),
        dataRetention: asString(m['dataRetention']),
      );
}

/// sosRequests/{uid}/{requestId} — the attendee's own SOS request + status mirrored by the backend.
class SosRequestStatus {
  const SosRequestStatus({required this.requestId, required this.clientCreatedAt, this.received, this.rejected = false, this.alertStatus, this.error});

  final String requestId;
  final DateTime clientCreatedAt;

  /// Backend accepted the request and created / joined an emergency.
  final bool? received;
  final bool rejected;
  final EmergencyStatus? alertStatus;
  final String? error;

  bool get delivered => received == true;
  bool get closed => rejected || alertStatus == EmergencyStatus.resolved;

  static SosRequestStatus? fromMap(String id, Map<String, dynamic> m) {
    final created = asInt(m['clientCreatedAt']);
    if (created == null) return null;
    final status = asString(m['status']);
    return SosRequestStatus(
      requestId: id,
      clientCreatedAt: DateTime.fromMillisecondsSinceEpoch(created),
      received: status == null ? null : status == 'received',
      rejected: status == 'rejected',
      alertStatus: EmergencyStatus.tryParse(m['alertStatus']),
      error: asString(m['error']),
    );
  }
}
