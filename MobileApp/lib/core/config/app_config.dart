/// App-wide configuration.
class AppConfig {
  AppConfig._();

  static const appName = 'FestNet';

  /// A band is shown offline when no new `latest` update arrives within this time.
  /// The current firmware uploads every 5 s (target 2 s), so allow a few missed uploads.
  static const deviceOfflineAfter = Duration(seconds: 15);
}
