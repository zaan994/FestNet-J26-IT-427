import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user_profile.dart';
import 'firebase_providers.dart';

/// Firebase Auth user (null when signed out).
final authStateProvider = StreamProvider<User?>((ref) => ref.watch(authServiceProvider).authStateChanges());

/// users/{uid} profile of the signed-in user.
final currentProfileProvider = StreamProvider<UserProfile?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return Stream.value(null);
  return ref.watch(userRepositoryProvider).watchProfile(user.uid);
});
