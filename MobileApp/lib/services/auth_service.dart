import 'package:firebase_auth/firebase_auth.dart';

import '../core/errors/app_exception.dart';

/// Thin wrapper around FirebaseAuth that converts errors to [AppException].
class AuthService {
  AuthService(this._auth);

  final FirebaseAuth _auth;

  Stream<User?> authStateChanges() => _auth.authStateChanges();

  User? get currentUser => _auth.currentUser;

  Future<User> signIn(String email, String password) async {
    try {
      final cred = await _auth.signInWithEmailAndPassword(email: email, password: password);
      return cred.user!;
    } catch (e) {
      throw AppException.from(e);
    }
  }

  Future<User> register(String email, String password, String name) async {
    try {
      final cred = await _auth.createUserWithEmailAndPassword(email: email, password: password);
      await cred.user!.updateDisplayName(name);
      return cred.user!;
    } catch (e) {
      throw AppException.from(e);
    }
  }

  Future<void> signOut() => _auth.signOut();
}
