/// Default thresholds from the TAF — mirrors Backend/functions/src/shared/thresholds.ts.
/// Runtime overrides live at festnet/config/thresholds.
class Thresholds {
  Thresholds._();

  static const bpmSpikeDelta = 30;
  static const bpmSpikeWindowSec = 90;
  static const spo2Low = 94;
  static const spo2Critical = 90;
  static const coreTempHighC = 38.0;
  static const stillnessTimeoutSec = 30;
  static const alertEscalationSec = 120;
  static const volunteerRadiusM = 50;
  static const surgeSpeedMps = 1.5;
  static const surgeZoneRadiusM = 20;
  static const surgeMinBands = 5;
}
