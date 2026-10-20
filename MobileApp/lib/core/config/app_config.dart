import '../../models/enums.dart';

/// App-wide configuration.
class AppConfig {
  AppConfig._();

  static const appName = 'FestNet';

  /// Telemetry older than this is "stale"; older than 8× is "offline"
  /// (same rule as the dashboard — Backend/functions/src/shared/telemetry.ts).
  static const deviceStaleAfter = Duration(seconds: 15);
  static const offlineFactor = 8;

  /// GPS positions older than this are never presented as current.
  static const gpsStaleAfter = Duration(seconds: 60);

  /// How long the app waits for the backend before telling the user it is still trying.
  static const requestTimeout = Duration(seconds: 20);

  static const hriDisclaimer =
      'The Health Risk Indicator (HRI) is an experimental research indicator. It is not a medical diagnosis, '
      'is not clinically validated and must never replace advice from medical staff. If you feel unwell, '
      'use SOS or go to a help point.';
}

/// Freshness from the time the app last RECEIVED telemetry (never the band's `online` flag).
Freshness freshnessOf(DateTime? receivedAt, DateTime now) {
  if (receivedAt == null) return Freshness.unknown;
  final age = now.difference(receivedAt);
  if (age < AppConfig.deviceStaleAfter) return Freshness.live;
  if (age < AppConfig.deviceStaleAfter * AppConfig.offlineFactor) return Freshness.stale;
  return Freshness.offline;
}
