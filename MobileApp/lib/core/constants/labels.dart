/// Plain-language labels shared by the screens (mirrors Dashboard/src/constants/explanations.ts).
library;

const flagLabels = <String, String>{
  'not_worn': 'Band not worn / no skin contact',
  'sensor_missing_ppg': 'No pulse-sensor data',
  'sensor_missing_imu': 'No motion data',
  'sensor_missing_temperature': 'No temperature reading',
  'ppg_samples_low': 'Too few pulse samples',
  'imu_samples_low': 'Too few motion samples',
  'ppg_fifo_overflow': 'Pulse samples lost',
  'chunk_gap': 'Missing data',
  'dropped_chunks_increased': 'Data dropped by the band',
  'low_perfusion': 'Weak pulse signal (check the fit)',
  'beat_detection_unstable': 'Unstable heartbeat signal',
  'motion_artifact_risk': 'Movement affects readings',
  'clock_not_synced': 'Band clock not synchronised',
  'delayed_chunk': 'Delayed upload',
  'ppg_saturation': 'Sensor overloaded (pressure / light)',
};

const inputLabels = <String, String>{
  'heart_rate': 'Heart rate',
  'hrv': 'Heart-rate variability',
  'spo2': 'SpO2',
  'surface_temperature': 'Surface temperature',
  'ambient_temperature': 'Air temperature',
  'activity': 'Movement',
  'personal_baseline': 'Your personal baseline',
};

String flagLabel(String flag) => flagLabels[flag] ?? flag.replaceAll('_', ' ');
String inputLabel(String input) => inputLabels[input] ?? input.replaceAll('_', ' ');
