import 'json_utils.dart';

/// users/{uid} — the only fields an account may write (see database.rules.json).
/// No health data, no device id, no role: roles are granted server-side only.
class UserProfile {
  const UserProfile({required this.uid, required this.displayName, this.email});

  final String uid;
  final String displayName;
  final String? email;

  factory UserProfile.fromMap(String uid, Map<String, dynamic> m) => UserProfile(
        uid: uid,
        displayName: asString(m['displayName']) ?? '',
        email: asString(m['email']),
      );
}
