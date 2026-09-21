/*
  FestNet - Smart Wearable Mesh Network Device (band firmware)
  Board:   ESP32 DevKit V1 (Arduino IDE: "ESP32 Dev Module", Partition Scheme: "Huge APP")
  Version: 0.3.0 — raw data uploader

  Sensors:
    OLED SSD1306           status display
    MAX30102               PPG red / IR      @ 100 Hz
    MPU6050                accel + gyro      @ 50 Hz
    MLX90614               skin + ambient temperature @ 1 Hz
    NEO-6M GPS             location, speed, heading
    SOS push button        interrupt driven

  What this band writes to Firebase (contract: docs/database/schema.md):
    /festnet/devices/<ID>/latest       every 2 s  current reading of every sensor + status
    /festnet/devices/<ID>/raw/<push>   every 2 s  full-rate signal chunk (200 PPG + 100 IMU samples)
    /festnet/devices/<ID>/meta         on boot    firmware version, boot time

  The band does NO health calculations. BPM, SpO2, HRV, stress, fall detection and
  anomalies are all computed in the backend (Backend/functions) from the raw chunks,
  and the dashboard / mobile app read those results from Firebase.

  Architecture:
    sensorTask (core 1, priority 3, every 10 ms) owns the I2C bus: MAX30102, MPU6050,
      MLX90614, OLED. It fills 2-second raw chunks and queues them.
    loop()     (core 1, priority 1) owns Wi-Fi, NTP time, Firebase, GPS (UART) and SOS.
    The sensor task pre-empts loop(), so sampling continues while Firebase/TLS is busy.

  Credentials live in secrets.h (gitignored) — copy secrets.example.h to secrets.h.

  IMPORTANT:
    Prototype only. This is not a certified medical or safety device.
    TLS certificate verification is disabled for testing.
*/

#define ENABLE_USER_AUTH
#define ENABLE_DATABASE
#define ENABLE_ESP_SSLCLIENT

#include <WiFi.h>
#include <Wire.h>
#include <sys/time.h>
#include <time.h>
#include <math.h>
#include <FirebaseClient.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>

#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD, API_KEY, DATABASE_URL, USER_EMAIL, USER_PASSWORD, DEVICE_ID

// =====================================================
// 1. CONFIGURATION
// =====================================================

#define FW_VERSION "0.3.0"

// Set to false to stop uploading raw chunks (e.g. to save database space while
// developing something unrelated). The backend needs them for health calculations.
const bool RAW_UPLOAD_ENABLED = true;

// Print every uploaded JSON to Serial (slow — the raw chunk is ~7 KB).
const bool DEBUG_PRINT_JSON = false;

// Pins
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define GPS_RX_PIN 16   // ESP32 receives from GPS TX
#define GPS_TX_PIN 17   // ESP32 transmits to GPS RX
#define SOS_PIN 27      // INPUT_PULLUP, LOW = pressed

// I2C addresses
#define OLED_ADDRESS 0x3C
#define MLX_ADDRESS 0x5A
#define MAX30102_ADDRESS 0x57
#define MPU_ADDRESS 0x68

// Sampling
const uint32_t SENSOR_TASK_PERIOD_MS = 10;    // 100 Hz task tick
const uint32_t PPG_FS_HZ = 100;               // MAX30102: 400 sps with 4-sample averaging
const uint32_t IMU_FS_HZ = 50;
const uint32_t IMU_PERIOD_MS = 1000 / IMU_FS_HZ;
const uint32_t TEMPERATURE_PERIOD_MS = 1000;
const uint32_t DISPLAY_PERIOD_MS = 1000;

// Raw chunks
const uint32_t CHUNK_DURATION_MS = 2000;      // 200 PPG + 100 IMU samples
const uint16_t PPG_MAX_SAMPLES = 240;         // nominal 200 + sensor clock tolerance
const uint16_t IMU_MAX_SAMPLES = 120;         // nominal 100
const uint8_t CHUNK_QUEUE_SIZE = 4;           // chunks buffered while offline (8 s)
const uint8_t RAW_MAX_RETRIES = 3;

// Uploads
const uint32_t LATEST_UPLOAD_MS = 2000;       // TAF: every 2 s
const uint32_t IN_FLIGHT_TIMEOUT_MS = 15000;
const uint32_t WIFI_RETRY_MS = 10000;

// SOS
const uint32_t SOS_DEBOUNCE_MS = 200;
const uint32_t SOS_LATCH_MS = 5000;           // sosActive stays true 5 s after a press

// Local display only (not uploaded): IR level that suggests the sensor touches skin.
const uint32_t PPG_CONTACT_IR_MIN = 50000;

// =====================================================
// 2. DEVICES
// =====================================================

// 400 kHz while pushing the frame buffer, then back to 100 kHz (MLX90614 limit).
Adafruit_SSD1306 display(128, 64, &Wire, -1, 400000UL, 100000UL);
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
MAX30105 max30102;
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

bool oledOK = false;
bool mlxOK = false;
bool maxOK = false;
bool mpuOK = false;

// =====================================================
// 3. SHARED DATA (sensor task <-> loop), guarded by dataMutex
// =====================================================

struct RawChunk {
  uint32_t seq;
  uint32_t t0UptimeMs;     // millis() at chunk start
  uint32_t durationMs;
  uint16_t ppgCount;
  uint16_t ppgOverflow;    // samples lost in the MAX30102 FIFO during this chunk
  uint32_t red[PPG_MAX_SAMPLES];
  uint32_t ir[PPG_MAX_SAMPLES];
  uint16_t imuCount;
  float ax[IMU_MAX_SAMPLES], ay[IMU_MAX_SAMPLES], az[IMU_MAX_SAMPLES];  // m/s^2
  float gx[IMU_MAX_SAMPLES], gy[IMU_MAX_SAMPLES], gz[IMU_MAX_SAMPLES];  // deg/s
  float objectC, ambientC;
  bool sosActive;
  uint32_t sosPressCount;
};

// Latest value of every sensor (for /latest and the OLED).
struct Readings {
  uint32_t red = 0, ir = 0;
  float objectC = NAN, ambientC = NAN;
  float ax = 0, ay = 0, az = 0;
  float gx = 0, gy = 0, gz = 0;
};

// Status written by loop(), shown on the OLED by the sensor task.
struct StatusView {
  bool wifi = false;
  bool cloud = false;
  bool gpsFix = false;
  uint32_t satellites = 0;
  bool sosActive = false;
  uint32_t sosPressCount = 0;
  uint32_t uploadedChunks = 0;
};

SemaphoreHandle_t dataMutex;
Readings readings;
StatusView statusView;

RawChunk chunkQueue[CHUNK_QUEUE_SIZE];
uint8_t queueHead = 0;          // oldest
uint8_t queueCount = 0;
uint32_t droppedChunks = 0;     // queue overflowed (offline too long)
uint32_t ppgOverflowTotal = 0;

RawChunk fillingChunk;          // owned by the sensor task
RawChunk uploadChunk;           // owned by loop()
uint32_t nextSeq = 0;

// SOS (written by ISR)
volatile uint32_t sosIsrCount = 0;
volatile uint32_t sosIsrLastMs = 0;

// =====================================================
// 4. FIREBASE CLIENT
// =====================================================

WiFiClient basicClient;
ESP_SSLClient ssl_client;

using AsyncClient = AsyncClientClass;
AsyncClient aClient(ssl_client);

UserAuth user_auth(API_KEY, USER_EMAIL, USER_PASSWORD, 3000);

FirebaseApp app;
RealtimeDatabase Database;

bool firebaseInitialized = false;
bool latestInFlight = false;
bool rawInFlight = false;
bool uploadChunkPending = false;  // uploadChunk holds a chunk not yet confirmed
uint8_t uploadChunkRetries = 0;
bool metaSent = false;
bool metaInFlight = false;
uint32_t latestSentAtMs = 0;
uint32_t rawSentAtMs = 0;
uint32_t uploadedChunks = 0;

const String DEVICE_PATH = String("/festnet/devices/") + DEVICE_ID;

// =====================================================
// 5. LOOP STATE
// =====================================================

uint32_t lastLatestUpload = 0;
uint32_t lastWiFiAttempt = 0;
bool ntpStarted = false;
bool sosUploadRequested = false;
uint32_t sosSeenCount = 0;
uint32_t sosLastPressMs = 0;
bool sosActive = false;

// =====================================================
// 6. TIME (NTP)
// =====================================================

const time_t MIN_VALID_EPOCH_S = 1700000000;  // anything earlier = clock not synced

void startNtp() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  ntpStarted = true;
  Serial.println("[TIME] NTP sync started");
}

bool timeSynced() {
  return time(nullptr) >= MIN_VALID_EPOCH_S;
}

// Epoch milliseconds, or 0 if not synced yet.
uint64_t epochMs() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  if (tv.tv_sec < MIN_VALID_EPOCH_S) return 0;
  return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// Converts a millis() timestamp to epoch ms (0 if the clock is not synced).
uint64_t uptimeToEpochMs(uint32_t uptimeMs) {
  const uint64_t now = epochMs();
  if (now == 0) return 0;
  return now - (uint64_t)(millis() - uptimeMs);
}

// =====================================================
// 7. JSON HELPERS (schema rule: unavailable values are null, never NaN)
// =====================================================

void jsonKey(String &j, const char *key) {
  j += '"';
  j += key;
  j += "\":";
}

void jsonBool(String &j, bool value) {
  j += value ? "true" : "false";
}

void jsonFloat(String &j, float value, int decimals) {
  if (isfinite(value)) {
    j += String(value, decimals);
  } else {
    j += "null";
  }
}

void jsonDouble(String &j, double value, int decimals) {
  if (isfinite(value)) {
    j += String(value, decimals);
  } else {
    j += "null";
  }
}

void jsonEpoch(String &j, uint64_t value) {
  if (value == 0) {
    j += "null";
    return;
  }
  char buf[24];
  snprintf(buf, sizeof(buf), "%llu", (unsigned long long)value);
  j += buf;
}

void jsonServerTimestamp(String &j) {
  j += "{\".sv\":\"timestamp\"}";
}

void jsonUintArray(String &j, const uint32_t *values, uint16_t count) {
  j += '[';
  for (uint16_t i = 0; i < count; i++) {
    if (i) j += ',';
    j += values[i];
  }
  j += ']';
}

void jsonFloatArray(String &j, const float *values, uint16_t count, int decimals) {
  j += '[';
  for (uint16_t i = 0; i < count; i++) {
    if (i) j += ',';
    j += String(values[i], decimals);
  }
  j += ']';
}

// =====================================================
// 8. FIREBASE CALLBACKS
// =====================================================

void auth_debug_print(AsyncResult &result) {
  if (result.isEvent()) {
    Serial.printf("[Firebase Auth] %s | code: %d\n",
                  result.eventLog().message().c_str(), result.eventLog().code());
  }
  if (result.isError()) {
    Serial.printf("[Firebase Auth Error] %s | code: %d\n",
                  result.error().message().c_str(), result.error().code());
  }
}

void processDatabaseResult(AsyncResult &result) {
  const bool done = result.isError() || result.available();
  if (!done) return;

  const String uid = result.uid();
  if (result.isError()) {
    Serial.printf("[Database Error] %s | %s | code: %d\n", uid.c_str(),
                  result.error().message().c_str(), result.error().code());
  }

  if (uid == "latest") {
    latestInFlight = false;
  } else if (uid == "raw") {
    rawInFlight = false;
    if (result.isError()) {
      // Keep uploadChunk for a retry (see uploadNextRawChunk).
      uploadChunkRetries++;
    } else {
      uploadChunkPending = false;
      uploadedChunks++;
    }
  } else if (uid == "meta") {
    metaInFlight = false;
    if (!result.isError()) metaSent = true;
  }
}

// =====================================================
// 9. SENSOR INITIALISATION (runs before the sensor task starts)
// =====================================================

void showBootMessage(const char *line) {
  if (!oledOK) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(16, 8);
  display.print("FestNet");
  display.setTextSize(1);
  display.setCursor(0, 40);
  display.print(line);
  display.display();
}

void initializeSensors() {
  Serial.println();
  Serial.println("Initializing FestNet sensors...");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);  // MLX90614 supports max 100 kHz

  oledOK = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  Serial.println(oledOK ? "[OK] OLED detected" : "[FAIL] OLED not detected");
  showBootMessage("Starting sensors...");

  mlxOK = mlx.begin(MLX_ADDRESS, &Wire);
  Serial.println(mlxOK ? "[OK] MLX90614 detected" : "[FAIL] MLX90614 not detected");

  maxOK = max30102.begin(Wire, I2C_SPEED_STANDARD, MAX30102_ADDRESS);
  if (maxOK) {
    // ledBrightness, sampleAverage, ledMode (2 = red + IR), sampleRate, pulseWidth, adcRange
    // 400 sps / 4-sample average = 100 Hz effective.
    max30102.setup(0x1F, 4, 2, 400, 411, 4096);
    max30102.setPulseAmplitudeRed(0x1F);
    max30102.setPulseAmplitudeIR(0x1F);
    max30102.clearFIFO();
    Serial.println("[OK] MAX30102 detected (100 Hz)");
  } else {
    Serial.println("[FAIL] MAX30102 not detected");
  }

  mpuOK = mpu.begin(MPU_ADDRESS, &Wire);
  if (mpuOK) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);  // falls can exceed 4 g
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[OK] MPU6050 detected (50 Hz)");
  } else {
    Serial.println("[FAIL] MPU6050 not detected");
  }

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] GPS serial started");
}

// =====================================================
// 10. SENSOR READING (sensor task only)
// =====================================================

uint8_t maxReadRegister(uint8_t reg) {
  Wire.beginTransmission(MAX30102_ADDRESS);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((int)MAX30102_ADDRESS, 1);
  return Wire.available() ? Wire.read() : 0;
}

uint32_t wireRead24() {
  uint32_t value = (uint32_t)Wire.read() << 16;
  value |= (uint32_t)Wire.read() << 8;
  value |= (uint32_t)Wire.read();
  return value & 0x3FFFF;  // 18-bit ADC
}

// Reads every pending sample from the MAX30102 FIFO (32 deep = 320 ms at 100 Hz).
// SparkFun's check() only buffers 4 samples, which loses data at 100 Hz.
void readPpgFifo() {
  const uint8_t REG_FIFO_WR_PTR = 0x04;
  const uint8_t REG_OVF_COUNTER = 0x05;
  const uint8_t REG_FIFO_RD_PTR = 0x06;
  const uint8_t REG_FIFO_DATA = 0x07;
  const uint8_t SAMPLES_PER_READ = 16;  // 96 bytes, fits the 128-byte Wire buffer

  const uint8_t overflow = maxReadRegister(REG_OVF_COUNTER);
  const uint8_t writePtr = maxReadRegister(REG_FIFO_WR_PTR);
  const uint8_t readPtr = maxReadRegister(REG_FIFO_RD_PTR);
  int pending = (int)writePtr - (int)readPtr;
  if (pending < 0) pending += 32;
  if (overflow > 0) fillingChunk.ppgOverflow += overflow;

  uint32_t lastRed = 0, lastIr = 0;
  while (pending > 0) {
    const uint8_t chunk = pending < SAMPLES_PER_READ ? pending : SAMPLES_PER_READ;
    Wire.beginTransmission(MAX30102_ADDRESS);
    Wire.write(REG_FIFO_DATA);
    Wire.endTransmission(false);
    const int bytes = chunk * 6;
    if (Wire.requestFrom((int)MAX30102_ADDRESS, bytes) != bytes) break;

    for (uint8_t i = 0; i < chunk; i++) {
      lastRed = wireRead24();
      lastIr = wireRead24();
      if (fillingChunk.ppgCount < PPG_MAX_SAMPLES) {
        fillingChunk.red[fillingChunk.ppgCount] = lastRed;
        fillingChunk.ir[fillingChunk.ppgCount] = lastIr;
        fillingChunk.ppgCount++;
      } else {
        fillingChunk.ppgOverflow++;
      }
    }
    pending -= chunk;
  }

  if (lastIr != 0) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    readings.red = lastRed;
    readings.ir = lastIr;
    xSemaphoreGive(dataMutex);
  }
}

void readImu() {
  sensors_event_t accel, gyro, temp;
  if (!mpu.getEvent(&accel, &gyro, &temp)) return;

  const float RAD_TO_DEG_F = 57.2957795f;
  const float ax = accel.acceleration.x, ay = accel.acceleration.y, az = accel.acceleration.z;
  const float gx = gyro.gyro.x * RAD_TO_DEG_F, gy = gyro.gyro.y * RAD_TO_DEG_F, gz = gyro.gyro.z * RAD_TO_DEG_F;

  if (fillingChunk.imuCount < IMU_MAX_SAMPLES) {
    const uint16_t i = fillingChunk.imuCount++;
    fillingChunk.ax[i] = ax;
    fillingChunk.ay[i] = ay;
    fillingChunk.az[i] = az;
    fillingChunk.gx[i] = gx;
    fillingChunk.gy[i] = gy;
    fillingChunk.gz[i] = gz;
  }

  xSemaphoreTake(dataMutex, portMAX_DELAY);
  readings.ax = ax;
  readings.ay = ay;
  readings.az = az;
  readings.gx = gx;
  readings.gy = gy;
  readings.gz = gz;
  xSemaphoreGive(dataMutex);
}

void readTemperature() {
  const float ambient = mlx.readAmbientTempC();
  const float object = mlx.readObjectTempC();
  const float ambientC = (isfinite(ambient) && ambient > -40 && ambient < 125) ? ambient : NAN;
  const float objectC = (isfinite(object) && object > -70 && object < 380) ? object : NAN;

  xSemaphoreTake(dataMutex, portMAX_DELAY);
  readings.ambientC = ambientC;
  readings.objectC = objectC;
  xSemaphoreGive(dataMutex);
}

void startChunk(uint32_t now) {
  fillingChunk.seq = nextSeq++;
  fillingChunk.t0UptimeMs = now;
  fillingChunk.ppgCount = 0;
  fillingChunk.ppgOverflow = 0;
  fillingChunk.imuCount = 0;
}

// Moves the finished chunk into the upload queue (drops the oldest if full).
void finishChunk(uint32_t now) {
  fillingChunk.durationMs = now - fillingChunk.t0UptimeMs;

  xSemaphoreTake(dataMutex, portMAX_DELAY);
  fillingChunk.objectC = readings.objectC;
  fillingChunk.ambientC = readings.ambientC;
  fillingChunk.sosActive = statusView.sosActive;
  fillingChunk.sosPressCount = statusView.sosPressCount;
  ppgOverflowTotal += fillingChunk.ppgOverflow;

  if (queueCount == CHUNK_QUEUE_SIZE) {
    queueHead = (queueHead + 1) % CHUNK_QUEUE_SIZE;
    queueCount--;
    droppedChunks++;
  }
  const uint8_t tail = (queueHead + queueCount) % CHUNK_QUEUE_SIZE;
  memcpy(&chunkQueue[tail], &fillingChunk, sizeof(RawChunk));
  queueCount++;
  xSemaphoreGive(dataMutex);
}

// =====================================================
// 11. OLED (sensor task only — it owns the I2C bus)
// =====================================================

void updateDisplay() {
  Readings r;
  StatusView s;
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  r = readings;
  s = statusView;
  xSemaphoreGive(dataMutex);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  if (s.sosActive) {
    display.fillScreen(SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK);
    display.setTextSize(3);
    display.setCursor(30, 8);
    display.print("SOS");
    display.setTextSize(1);
    display.setCursor(18, 44);
    display.print(s.cloud ? "Alert sent" : "Waiting for network");
    display.display();
    return;
  }

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(DEVICE_ID);
  display.setCursor(98, 0);
  display.print(s.wifi ? "W" : "-");
  display.print(s.cloud ? "C" : "-");
  display.print(s.gpsFix ? "G" : "-");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 14);
  display.print("Temp : ");
  if (isfinite(r.objectC)) {
    display.print(r.objectC, 1);
    display.print(" C");
  } else {
    display.print("--");
  }

  display.setCursor(0, 25);
  display.print("Pulse: ");
  display.print(r.ir >= PPG_CONTACT_IR_MIN ? "on skin" : "no contact");

  display.setCursor(0, 36);
  display.print("GPS  : ");
  if (s.gpsFix) {
    display.print("fix ");
    display.print(s.satellites);
    display.print(" sat");
  } else {
    display.print("searching");
  }

  display.setCursor(0, 47);
  display.print("Sent : ");
  display.print(s.uploadedChunks);
  display.print(" chunks");

  display.setCursor(0, 57);
  display.print("SOS  : press for help");

  display.display();
}

// =====================================================
// 12. SENSOR TASK
// =====================================================

void sensorTask(void *) {
  uint32_t lastImu = millis();
  uint32_t lastTemp = 0;
  uint32_t lastDisplay = 0;
  startChunk(millis());
  TickType_t wake = xTaskGetTickCount();

  for (;;) {
    const uint32_t now = millis();

    if (maxOK) readPpgFifo();

    if (mpuOK && now - lastImu >= IMU_PERIOD_MS) {
      lastImu += IMU_PERIOD_MS;
      if (now - lastImu > IMU_PERIOD_MS) lastImu = now;  // resync after a long stall
      readImu();
    }

    if (mlxOK && now - lastTemp >= TEMPERATURE_PERIOD_MS) {
      lastTemp = now;
      readTemperature();
    }

    if (now - fillingChunk.t0UptimeMs >= CHUNK_DURATION_MS) {
      finishChunk(now);
      startChunk(now);
    }

    if (oledOK && now - lastDisplay >= DISPLAY_PERIOD_MS) {
      lastDisplay = now;
      updateDisplay();
    }

    vTaskDelayUntil(&wake, pdMS_TO_TICKS(SENSOR_TASK_PERIOD_MS));
  }
}

// =====================================================
// 13. GPS + SOS (loop)
// =====================================================

void readGPS() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }
}

bool gpsFix() {
  return gps.location.isValid() && gps.location.age() < 5000;
}

void IRAM_ATTR onSosPressed() {
  const uint32_t now = millis();
  if (now - sosIsrLastMs >= SOS_DEBOUNCE_MS) {
    sosIsrLastMs = now;
    sosIsrCount++;
  }
}

void handleSos(uint32_t now) {
  const uint32_t count = sosIsrCount;
  if (count != sosSeenCount) {
    sosSeenCount = count;
    sosLastPressMs = now;
    sosUploadRequested = true;  // upload `latest` immediately
    Serial.printf("[SOS] Button pressed (count=%lu)\n", (unsigned long)count);
  }
  const bool held = digitalRead(SOS_PIN) == LOW;
  sosActive = held || (sosLastPressMs != 0 && now - sosLastPressMs < SOS_LATCH_MS);
}

// =====================================================
// 14. WIFI + FIREBASE INITIALISATION
// =====================================================

void startWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWiFiAttempt = millis();
  Serial.printf("Connecting to Wi-Fi \"%s\"...\n", WIFI_SSID);
}

void maintainWiFi(uint32_t now) {
  static bool wasConnected = false;
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected != wasConnected) {
    wasConnected = connected;
    if (connected) {
      Serial.print("Wi-Fi connected. IP: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Wi-Fi disconnected");
    }
  }
  if (!connected && now - lastWiFiAttempt >= WIFI_RETRY_MS) {
    lastWiFiAttempt = now;
    Serial.println("Reconnecting to Wi-Fi...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

void initializeFirebase() {
  Serial.println("Setting up Firebase client...");

  // TESTING ONLY: disables TLS certificate validation.
  ssl_client.setClient(&basicClient);
  ssl_client.setInsecure();
  ssl_client.setBufferSizes(4096, 2048);

  Firebase.printf("Firebase Client version: %s\n", FIREBASE_CLIENT_VERSION);

  initializeApp(aClient, app, getAuth(user_auth), auth_debug_print, "festnetAuth");
  app.getApp<RealtimeDatabase>(Database);
  Database.url(DATABASE_URL);

  firebaseInitialized = true;
  Serial.println("Firebase client configured.");
}

bool cloudReady() {
  return firebaseInitialized && WiFi.status() == WL_CONNECTED && app.ready();
}

// =====================================================
// 15. UPLOADS
// =====================================================

// /festnet/devices/<ID>/latest — current reading of every sensor.
void uploadLatest(uint32_t now) {
  Readings r;
  uint32_t lastSeq, pending, dropped, overflowTotal;
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  r = readings;
  lastSeq = nextSeq == 0 ? 0 : nextSeq - 1;
  pending = queueCount;
  dropped = droppedChunks;
  overflowTotal = ppgOverflowTotal;
  xSemaphoreGive(dataMutex);

  const bool fix = gpsFix();

  String j;
  j.reserve(1200);
  j += '{';
  jsonKey(j, "deviceId"); j += '"'; j += DEVICE_ID; j += "\",";
  jsonKey(j, "fwVersion"); j += "\"" FW_VERSION "\",";
  jsonKey(j, "online"); j += "true,";
  jsonKey(j, "ts"); jsonEpoch(j, epochMs()); j += ',';
  jsonKey(j, "serverTs"); jsonServerTimestamp(j); j += ',';
  jsonKey(j, "uptimeMs"); j += now; j += ',';
  jsonKey(j, "updatedAtMs"); j += now; j += ',';  // kept for older readers
  jsonKey(j, "sosActive"); jsonBool(j, sosActive); j += ',';
  jsonKey(j, "sosPressCount"); j += sosSeenCount; j += ',';

  jsonKey(j, "sensors"); j += '{';
  jsonKey(j, "oled"); jsonBool(j, oledOK); j += ',';
  jsonKey(j, "mlx90614"); jsonBool(j, mlxOK); j += ',';
  jsonKey(j, "max30102"); jsonBool(j, maxOK); j += ',';
  jsonKey(j, "mpu6050"); jsonBool(j, mpuOK); j += ',';
  jsonKey(j, "gps"); jsonBool(j, gps.passedChecksum() > 0);
  j += "},";

  jsonKey(j, "pulseRaw"); j += '{';
  jsonKey(j, "red"); j += r.red; j += ',';
  jsonKey(j, "ir"); j += r.ir;
  j += "},";

  jsonKey(j, "temperature"); j += '{';
  jsonKey(j, "objectC"); jsonFloat(j, r.objectC, 2); j += ',';
  jsonKey(j, "ambientC"); jsonFloat(j, r.ambientC, 2);
  j += "},";

  jsonKey(j, "motion"); j += '{';
  jsonKey(j, "ax"); jsonFloat(j, r.ax, 3); j += ',';
  jsonKey(j, "ay"); jsonFloat(j, r.ay, 3); j += ',';
  jsonKey(j, "az"); jsonFloat(j, r.az, 3); j += ',';
  jsonKey(j, "gx"); jsonFloat(j, r.gx, 2); j += ',';
  jsonKey(j, "gy"); jsonFloat(j, r.gy, 2); j += ',';
  jsonKey(j, "gz"); jsonFloat(j, r.gz, 2);
  j += "},";

  jsonKey(j, "gps"); j += '{';
  jsonKey(j, "fix"); jsonBool(j, fix); j += ',';
  jsonKey(j, "latitude"); jsonDouble(j, fix ? gps.location.lat() : NAN, 6); j += ',';
  jsonKey(j, "longitude"); jsonDouble(j, fix ? gps.location.lng() : NAN, 6); j += ',';
  jsonKey(j, "satellites"); j += (gps.satellites.isValid() ? gps.satellites.value() : 0); j += ',';
  jsonKey(j, "speedMps"); jsonDouble(j, (fix && gps.speed.isValid()) ? gps.speed.mps() : NAN, 2); j += ',';
  jsonKey(j, "headingDeg"); jsonDouble(j, (fix && gps.course.isValid()) ? gps.course.deg() : NAN, 1); j += ',';
  jsonKey(j, "altitudeM"); jsonDouble(j, (fix && gps.altitude.isValid()) ? gps.altitude.meters() : NAN, 1); j += ',';
  jsonKey(j, "hdop"); jsonDouble(j, gps.hdop.isValid() ? gps.hdop.hdop() : NAN, 2);
  j += "},";

  jsonKey(j, "battery"); j += "{\"pct\":null},";

  jsonKey(j, "net"); j += '{';
  jsonKey(j, "transport"); j += "\"wifi\",";
  jsonKey(j, "rssi"); j += WiFi.RSSI();
  j += "},";

  jsonKey(j, "raw"); j += '{';
  jsonKey(j, "enabled"); jsonBool(j, RAW_UPLOAD_ENABLED); j += ',';
  jsonKey(j, "lastSeq"); j += lastSeq; j += ',';
  jsonKey(j, "pendingChunks"); j += pending; j += ',';
  jsonKey(j, "droppedChunks"); j += dropped; j += ',';
  jsonKey(j, "ppgOverflowTotal"); j += overflowTotal;
  j += '}';

  j += '}';

  if (DEBUG_PRINT_JSON) Serial.println(j);

  latestInFlight = true;
  latestSentAtMs = now;
  lastLatestUpload = now;
  sosUploadRequested = false;
  Database.set<object_t>(aClient, DEVICE_PATH + "/latest", object_t(j), processDatabaseResult, "latest");
}

// /festnet/devices/<ID>/raw/<pushId> — one 2-second full-rate chunk.
void uploadNextRawChunk(uint32_t now) {
  if (rawInFlight) return;

  if (uploadChunkPending && uploadChunkRetries >= RAW_MAX_RETRIES) {
    Serial.printf("[RAW] Giving up on chunk %lu\n", (unsigned long)uploadChunk.seq);
    uploadChunkPending = false;
  }

  if (!uploadChunkPending) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    if (queueCount > 0) {
      memcpy(&uploadChunk, &chunkQueue[queueHead], sizeof(RawChunk));
      queueHead = (queueHead + 1) % CHUNK_QUEUE_SIZE;
      queueCount--;
      uploadChunkPending = true;
      uploadChunkRetries = 0;
    }
    xSemaphoreGive(dataMutex);
    if (!uploadChunkPending) return;
  }

  const RawChunk &c = uploadChunk;
  String j;
  j.reserve(9000);
  j += '{';
  jsonKey(j, "seq"); j += c.seq; j += ',';
  jsonKey(j, "t0"); jsonEpoch(j, uptimeToEpochMs(c.t0UptimeMs)); j += ',';
  jsonKey(j, "t0UptimeMs"); j += c.t0UptimeMs; j += ',';
  jsonKey(j, "durationMs"); j += c.durationMs; j += ',';
  jsonKey(j, "serverTs"); jsonServerTimestamp(j); j += ',';

  jsonKey(j, "ppg"); j += '{';
  jsonKey(j, "fs"); j += PPG_FS_HZ; j += ',';
  jsonKey(j, "n"); j += c.ppgCount; j += ',';
  jsonKey(j, "overflow"); j += c.ppgOverflow; j += ',';
  jsonKey(j, "red"); jsonUintArray(j, c.red, c.ppgCount); j += ',';
  jsonKey(j, "ir"); jsonUintArray(j, c.ir, c.ppgCount);
  j += "},";

  jsonKey(j, "imu"); j += '{';
  jsonKey(j, "fs"); j += IMU_FS_HZ; j += ',';
  jsonKey(j, "n"); j += c.imuCount; j += ',';
  jsonKey(j, "ax"); jsonFloatArray(j, c.ax, c.imuCount, 2); j += ',';
  jsonKey(j, "ay"); jsonFloatArray(j, c.ay, c.imuCount, 2); j += ',';
  jsonKey(j, "az"); jsonFloatArray(j, c.az, c.imuCount, 2); j += ',';
  jsonKey(j, "gx"); jsonFloatArray(j, c.gx, c.imuCount, 1); j += ',';
  jsonKey(j, "gy"); jsonFloatArray(j, c.gy, c.imuCount, 1); j += ',';
  jsonKey(j, "gz"); jsonFloatArray(j, c.gz, c.imuCount, 1);
  j += "},";

  jsonKey(j, "temperature"); j += '{';
  jsonKey(j, "objectC"); jsonFloat(j, c.objectC, 2); j += ',';
  jsonKey(j, "ambientC"); jsonFloat(j, c.ambientC, 2);
  j += "},";

  jsonKey(j, "sosActive"); jsonBool(j, c.sosActive); j += ',';
  jsonKey(j, "sosPressCount"); j += c.sosPressCount;
  j += '}';

  if (DEBUG_PRINT_JSON) Serial.println(j);

  rawInFlight = true;
  rawSentAtMs = now;
  Database.push<object_t>(aClient, DEVICE_PATH + "/raw", object_t(j), processDatabaseResult, "raw");
}

// /festnet/devices/<ID>/meta — merged, so ownerUid / eventId set by the apps are kept.
void uploadMeta(uint32_t now) {
  String j = "{";
  jsonKey(j, "fwVersion"); j += "\"" FW_VERSION "\",";
  jsonKey(j, "lastBootTs"); jsonEpoch(j, uptimeToEpochMs(0)); j += ',';
  jsonKey(j, "lastBootServerTs"); jsonServerTimestamp(j); j += ',';
  jsonKey(j, "rawPpgFs"); j += PPG_FS_HZ; j += ',';
  jsonKey(j, "rawImuFs"); j += IMU_FS_HZ; j += ',';
  jsonKey(j, "rawChunkMs"); j += CHUNK_DURATION_MS;
  j += '}';

  metaInFlight = true;
  Database.update<object_t>(aClient, DEVICE_PATH + "/meta", object_t(j), processDatabaseResult, "meta");
}

void checkInFlightTimeouts(uint32_t now) {
  if (latestInFlight && now - latestSentAtMs > IN_FLIGHT_TIMEOUT_MS) {
    Serial.println("[Upload] latest timed out");
    latestInFlight = false;
  }
  if (rawInFlight && now - rawSentAtMs > IN_FLIGHT_TIMEOUT_MS) {
    Serial.println("[Upload] raw chunk timed out");
    rawInFlight = false;
    uploadChunkRetries++;
  }
}

// =====================================================
// 16. SETUP
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("================================");
  Serial.printf(" FESTNET BAND %s  fw %s\n", DEVICE_ID, FW_VERSION);
  Serial.println("================================");

  dataMutex = xSemaphoreCreateMutex();

  pinMode(SOS_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(SOS_PIN), onSosPressed, FALLING);

  initializeSensors();
  showBootMessage("Connecting Wi-Fi...");
  startWiFi();

  // From here on only the sensor task touches I2C (sensors + OLED).
  if (maxOK) max30102.clearFIFO();
  xTaskCreatePinnedToCore(sensorTask, "sensors", 4096, nullptr, 3, nullptr, 1);
}

// =====================================================
// 17. MAIN LOOP
// =====================================================

void loop() {
  const uint32_t now = millis();

  maintainWiFi(now);
  if (WiFi.status() == WL_CONNECTED) {
    if (!ntpStarted) startNtp();
    if (!firebaseInitialized) initializeFirebase();
  }
  if (firebaseInitialized) app.loop();
  checkInFlightTimeouts(now);

  readGPS();
  handleSos(now);

  const bool ready = cloudReady();

  xSemaphoreTake(dataMutex, portMAX_DELAY);
  statusView.wifi = WiFi.status() == WL_CONNECTED;
  statusView.cloud = ready;
  statusView.gpsFix = gpsFix();
  statusView.satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
  statusView.sosActive = sosActive;
  statusView.sosPressCount = sosSeenCount;
  statusView.uploadedChunks = uploadedChunks;
  if (!RAW_UPLOAD_ENABLED) queueCount = 0;  // discard chunks
  xSemaphoreGive(dataMutex);

  if (ready) {
    if (!metaSent && !metaInFlight && timeSynced()) uploadMeta(now);
    if (!latestInFlight && (sosUploadRequested || now - lastLatestUpload >= LATEST_UPLOAD_MS)) {
      uploadLatest(now);
    }
    if (RAW_UPLOAD_ENABLED) uploadNextRawChunk(now);
  }

  delay(2);
}
