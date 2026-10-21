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

  /// User-facing text. Research status (not clinically validated) is documented in code and docs,
  /// not shown in the app by design.
  static const hriDisclaimer =
      'The Health Risk Indicator helps event staff look after you. It is not a medical diagnosis. '
      'If you feel unwell, use SOS or go to a help point.';
}

/// Freshness from the time the app last RECEIVED telemetry (never the band's `online` flag).
Freshness freshnessOf(DateTime? receivedAt, DateTime now) {
  if (receivedAt == null) return Freshness.unknown;
  final age = now.difference(receivedAt);
  if (age < AppConfig.deviceStaleAfter) return Freshness.live;
  if (age < AppConfig.deviceStaleAfter * AppConfig.offlineFactor) return Freshness.stale;
  return Freshness.offline;
}
