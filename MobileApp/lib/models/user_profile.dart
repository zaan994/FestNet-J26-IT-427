import 'enums.dart';
import 'json_utils.dart';

/// users/{uid}
class UserProfile {
  const UserProfile({
    required this.uid,
    required this.name,
    required this.email,
    required this.role,
    this.deviceId,
  });

  final String uid;
  final String name;
  final String email;
  final Role role;
  final String? deviceId;

  bool get hasBand => deviceId != null && deviceId!.isNotEmpty;

  factory UserProfile.fromMap(String uid, Map<String, dynamic> m) => UserProfile(
        uid: uid,
        name: asString(m['name']) ?? '',
        email: asString(m['email']) ?? '',
        role: Role.parse(m['role']),
        deviceId: asString(m['deviceId']),
      );
}
