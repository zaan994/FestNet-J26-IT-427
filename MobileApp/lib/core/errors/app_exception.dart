import 'package:firebase_auth/firebase_auth.dart';

/// User-presentable error.
class AppException implements Exception {
  const AppException(this.message);

  final String message;

  /// Maps Firebase / unknown errors to a readable message.
  factory AppException.from(Object error) {
    if (error is AppException) return error;
    if (error is FirebaseAuthException) {
      return AppException(switch (error.code) {
        'invalid-credential' || 'wrong-password' || 'user-not-found' => 'Incorrect email or password.',
        'email-already-in-use' => 'An account already exists for this email.',
        'weak-password' => 'Password must be at least 6 characters.',
        'invalid-email' => 'Enter a valid email address.',
        'network-request-failed' => 'No internet connection.',
        _ => error.message ?? 'Authentication failed.',
      });
    }
    return AppException(error.toString());
  }

  @override
  String toString() => message;
}
