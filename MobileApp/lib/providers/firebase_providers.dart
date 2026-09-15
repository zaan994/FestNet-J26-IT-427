import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../repositories/device_repository.dart';
import '../repositories/user_repository.dart';
import '../services/auth_service.dart';
import '../services/database_service.dart';

/// Dependency graph. Override these in tests with fakes.
final authServiceProvider = Provider<AuthService>((ref) => AuthService(FirebaseAuth.instance));

final databaseServiceProvider = Provider<DatabaseService>((ref) => DatabaseService(FirebaseDatabase.instance));

final userRepositoryProvider = Provider<UserRepository>((ref) => UserRepository(ref.watch(databaseServiceProvider)));

final deviceRepositoryProvider =
    Provider<DeviceRepository>((ref) => DeviceRepository(ref.watch(databaseServiceProvider)));
