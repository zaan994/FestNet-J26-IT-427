import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../repositories/responder_repository.dart';

/// C2 push notifications for responders (Firebase Cloud Messaging).
///
/// The device token is stored only under emergency/responders/{uid}/tokens (owner + backend).
/// Notification messages are shown by the OS while the app is in the background; while the app is
/// open they arrive on [foreground] and the Respond screen shows them as a banner.
/// "Accepted by FCM" on the server is not proof of display — acknowledging in the app is.
class PushService {
  PushService(this._messaging, this._repo);

  final FirebaseMessaging _messaging;
  final ResponderRepository _repo;
  StreamSubscription<String>? _refresh;
  String? _token;
  String? _uid;

  Stream<RemoteMessage> get foreground => FirebaseMessaging.onMessage;

  /// Taps on a notification that opened the app from the background.
  Stream<RemoteMessage> get opened => FirebaseMessaging.onMessageOpenedApp;

  Future<RemoteMessage?> initialMessage() => _messaging.getInitialMessage();

  String get _platform => kIsWeb ? 'web' : (Platform.isIOS ? 'ios' : 'android');

  /// Asks for permission and registers this device for the signed-in responder.
  /// Returns null on success, or a user-readable reason.
  Future<String?> register(String uid) async {
    try {
      final settings = await _messaging.requestPermission(alert: true, sound: true, badge: true);
      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return 'Notifications are blocked for FestNet. Allow them in the phone settings to receive alerts.';
      }
      final token = await _messaging.getToken();
      if (token == null) return 'This device did not provide a push token.';
      _uid = uid;
      _token = token;
      await _repo.saveToken(uid, token, _platform);
      await _refresh?.cancel();
      _refresh = _messaging.onTokenRefresh.listen((t) async {
        final old = _token;
        _token = t;
        if (_uid == null) return;
        if (old != null && old != t) await _repo.removeToken(_uid!, old);
        await _repo.saveToken(_uid!, t, _platform);
      });
      return null;
    } catch (e) {
      return 'Could not register for notifications: $e';
    }
  }

  /// Removes this device's token (on sign-out) — the responder account itself is untouched.
  Future<void> unregister() async {
    await _refresh?.cancel();
    _refresh = null;
    final uid = _uid;
    final token = _token;
    _uid = null;
    _token = null;
    if (uid != null && token != null) {
      try {
        await _repo.removeToken(uid, token);
      } catch (_) {}
    }
    try {
      await _messaging.deleteToken();
    } catch (_) {}
  }
}
