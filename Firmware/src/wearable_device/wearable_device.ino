/*
  FestNet Smart Wearable - ESP32 DevKit V1
  Sensors: SSD1306 OLED, MLX90614, MAX30102, MPU6050, NEO-6M GPS, SOS button
  Firebase Realtime Database path: /festnet/devices/FESTNET_001/latest

  Prototype only; not a certified safety device.
  TLS certificate verification is disabled for testing only.
*/

#define ENABLE_USER_AUTH
#define ENABLE_DATABASE
#define ENABLE_ESP_SSLCLIENT

#include <WiFi.h>
#include <Wire.h>
#include <FirebaseClient.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MLX90614.h>
#include <MAX30105.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#include <math.h>

// ---------- CONFIGURATION: ENTER YOUR OWN VALUES ----------
#define WIFI_SSID       "AshiniPhone "
#define WIFI_PASSWORD   "12345679"

#define API_KEY         "AIzaSyAwzzb0oJJDBADjr-0UpWw8tOZCZ6uccao"
#define USER_EMAIL      "chamodmanubasha21@gmail.com"
#define USER_PASSWORD   "chamod2002"

#define DATABASE_URL    "https://festnetproject-default-rtdb.firebaseio.com"

const char DEVICE_ID[] = "FESTNET_001";

// ---------- PINS ----------
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define SOS_PIN 27

// ---------- OLED ----------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ---------- SENSOR OBJECTS ----------
Adafruit_MLX90614 mlx;
MAX30105 max30102;
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// ---------- SENSOR STATUS ----------
bool oledOK = false;
bool mlxOK = false;
bool maxOK = false;
bool mpuOK = false;

// ---------- SENSOR VALUES ----------
float ambientC = NAN;
float objectC = NAN;
uint32_t redRaw = 0;
uint32_t irRaw = 0;

float ax = 0, ay = 0, az = 0;
float gx = 0, gy = 0, gz = 0;

bool gpsFix = false;
double latitude = 0;
double longitude = 0;
uint32_t satellites = 0;
bool sosActive = false;

// ---------- FIREBASE ----------
WiFiClient basicClient;
ESP_SSLClient ssl_client;
using AsyncClient = AsyncClientClass;
AsyncClient aClient(ssl_client);

UserAuth user_auth(API_KEY, USER_EMAIL, USER_PASSWORD, 3000);
FirebaseApp app;
RealtimeDatabase Database;

bool firebaseStarted = false;
bool uploadInProgress = false;

// ---------- TIMERS ----------
unsigned long lastSensorRead = 0;
unsigned long lastUpload = 0;
unsigned long lastDisplay = 0;
unsigned long lastWiFiAttempt = 0;

const unsigned long SENSOR_INTERVAL_MS = 1000;
const unsigned long UPLOAD_INTERVAL_MS = 5000;
const unsigned long DISPLAY_INTERVAL_MS = 1000;
const unsigned long WIFI_RETRY_MS = 10000;

// ---------- FIREBASE CALLBACKS ----------
void authDebugPrint(AsyncResult &result) {
  if (!result.isResult()) return;

  if (result.isEvent()) {
    Serial.printf("[Firebase Auth] %s | %s | code: %d\n",
                  result.uid().c_str(),
                  result.eventLog().message().c_str(),
                  result.eventLog().code());
  }

  if (result.isDebug()) {
    Serial.printf("[Firebase Debug] %s\n", result.debug().c_str());
  }

  if (result.isError()) {
    Serial.printf("[Firebase Auth Error] %s | code: %d\n",
                  result.error().message().c_str(),
                  result.error().code());
  }
}

void databaseResultCallback(AsyncResult &result) {
  if (!result.isResult()) return;

  if (result.isEvent()) {
    Serial.printf("[Database Event] %s | %s | code: %d\n",
                  result.uid().c_str(),
                  result.eventLog().message().c_str(),
                  result.eventLog().code());
  }

  if (result.isDebug()) {
    Serial.printf("[Database Debug] %s\n", result.debug().c_str());
  }

  if (result.isError()) {
    Serial.printf("[Database Error] %s | code: %d\n",
                  result.error().message().c_str(),
                  result.error().code());
  }

  if (result.uid() == "festnetUpload") {
    uploadInProgress = false;
  }
}

// ---------- SENSOR INITIALIZATION ----------
void initializeSensors() {
  Serial.println("\nInitializing FestNet sensors...");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);

  oledOK = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (oledOK) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("FestNet");
    display.println("Starting sensors...");
    display.display();
    Serial.println("[OK] OLED detected");
  } else {
    Serial.println("[FAIL] OLED not detected");
  }

  mlxOK = mlx.begin(0x5A, &Wire);
  Serial.println(mlxOK ? "[OK] MLX90614 detected"
                       : "[FAIL] MLX90614 not detected");

  maxOK = max30102.begin(Wire, I2C_SPEED_STANDARD, 0x57);
  if (maxOK) {
    max30102.setup(0x1F, 4, 2, 100, 411, 4096);
    max30102.setPulseAmplitudeRed(0x1F);
    max30102.setPulseAmplitudeIR(0x1F);
    Serial.println("[OK] MAX30102 detected");
  } else {
    Serial.println("[FAIL] MAX30102 not detected");
  }

  mpuOK = mpu.begin(0x68, &Wire);
  if (mpuOK) {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("[OK] MPU6050 detected");
  } else {
    Serial.println("[FAIL] MPU6050 not detected");
  }

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] GPS serial started");
}

// ---------- GPS ----------
void readGPS() {
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  gpsFix = gps.location.isValid() && gps.location.age() < 5000;

  if (gpsFix) {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
  }

  if (gps.satellites.isValid()) {
    satellites = gps.satellites.value();
  }
}

// ---------- READ SENSORS ----------
void readSensors() {
  if (mlxOK) {
    float ambient = mlx.readAmbientTempC();
    float object = mlx.readObjectTempC();

    if (isfinite(ambient) && ambient > -40 && ambient < 125) {
      ambientC = ambient;
    }
    if (isfinite(object) && object > -70 && object < 380) {
      objectC = object;
    }
  }

  if (maxOK) {
    redRaw = max30102.getRed();
    irRaw = max30102.getIR();
  }

  if (mpuOK) {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;
    mpu.getEvent(&accel, &gyro, &temp);

    ax = accel.acceleration.x;
    ay = accel.acceleration.y;
    az = accel.acceleration.z;

    gx = gyro.gyro.x * 180.0 / PI;
    gy = gyro.gyro.y * 180.0 / PI;
    gz = gyro.gyro.z * 180.0 / PI;
  }

  readGPS();
  sosActive = (digitalRead(SOS_PIN) == LOW);
}

// ---------- WIFI ----------
void startWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  unsigned long started = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - started < 20000) {
    Serial.print(".");
    delay(300);
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi not connected; will retry.");
  }
}

void maintainWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  if (millis() - lastWiFiAttempt >= WIFI_RETRY_MS) {
    lastWiFiAttempt = millis();
    Serial.println("Reconnecting to Wi-Fi...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    firebaseStarted = false;
  }
}

// ---------- FIREBASE ----------
void initializeFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Firebase initialization skipped: no Wi-Fi");
    return;
  }

  Serial.println("Setting up Firebase client...");

  // TESTING ONLY: TLS certificate validation is disabled.
  ssl_client.setClient(&basicClient);
  ssl_client.setInsecure();
  ssl_client.setBufferSizes(4096, 1024);

  initializeApp(aClient, app, getAuth(user_auth),
                authDebugPrint, "festnetAuth");

  app.getApp<RealtimeDatabase>(Database);
  Database.url(DATABASE_URL);

  firebaseStarted = true;
  Serial.println("Firebase client initialization started.");
}

// ---------- JSON HELPERS ----------
String jsonNumber(float value, unsigned int decimals = 2) {
  if (!isfinite(value)) return "null";
  return String(value, decimals);
}

// ---------- UPLOAD TO FIREBASE ----------
void uploadToFirebase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Upload skipped: Wi-Fi disconnected");
    return;
  }

  if (!app.ready()) {
    Serial.println("Upload skipped: Firebase not ready");
    return;
  }

  if (uploadInProgress) {
    Serial.println("Upload skipped: previous task pending");
    return;
  }

  String path = String("/festnet/devices/") + DEVICE_ID + "/latest";

  String json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  json += "\"online\":true,";
  json += "\"sosActive\":";
  json += (sosActive ? "true" : "false");
  json += ",";
  json += "\"updatedAtMs\":" + String(millis()) + ",";

  json += "\"sensors\":{";
  json += "\"mlx90614\":" + String(mlxOK ? "true" : "false") + ",";
  json += "\"max30102\":" + String(maxOK ? "true" : "false") + ",";
  json += "\"mpu6050\":" + String(mpuOK ? "true" : "false") + ",";
  json += "\"oled\":" + String(oledOK ? "true" : "false");
  json += "},";

  json += "\"temperature\":{";
  json += "\"ambientC\":" + jsonNumber(ambientC) + ",";
  json += "\"objectC\":" + jsonNumber(objectC);
  json += "},";

  json += "\"pulseRaw\":{";
  json += "\"red\":" + String(redRaw) + ",";
  json += "\"ir\":" + String(irRaw);
  json += "},";

  json += "\"motion\":{";
  json += "\"ax\":" + jsonNumber(ax, 3) + ",";
  json += "\"ay\":" + jsonNumber(ay, 3) + ",";
  json += "\"az\":" + jsonNumber(az, 3) + ",";
  json += "\"gx\":" + jsonNumber(gx, 3) + ",";
  json += "\"gy\":" + jsonNumber(gy, 3) + ",";
  json += "\"gz\":" + jsonNumber(gz, 3);
  json += "},";

  json += "\"gps\":{";
  json += "\"fix\":";
  json += (gpsFix ? "true" : "false");
  json += ",";
  json += "\"latitude\":";
  json += (gpsFix ? String(latitude, 6) : String("null"));
  json += ",";
  json += "\"longitude\":";
  json += (gpsFix ? String(longitude, 6) : String("null"));
  json += ",";
  json += "\"satellites\":" + String(satellites);
  json += "}";

  json += "}";

  Serial.println("\nUploading to Firebase...");
  Serial.println(path);
  Serial.println(json);

  uploadInProgress = true;
  Database.set<object_t>(aClient, path, object_t(json),
                         databaseResultCallback, "festnetUpload");
}

// ---------- OLED ----------
void updateDisplay() {
  if (!oledOK) return;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("FESTNET WEARABLE");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 14);
  display.print("WiFi: ");
  display.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Offline");

  display.setCursor(0, 25);
  display.print("Temp: ");
  if (isfinite(objectC)) {
    display.print(objectC, 1);
    display.println(" C");
  } else {
    display.println("--");
  }

  display.setCursor(0, 36);
  display.print("GPS: ");
  display.println(gpsFix ? "FIX" : "Searching");

  display.setCursor(0, 47);
  display.print("SOS: ");
  display.println(sosActive ? "PRESSED!" : "Normal");

  display.setCursor(0, 57);
  display.print("IR:");
  display.print(irRaw);
  display.display();
}

// ---------- SETUP ----------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n================================");
  Serial.println(" FESTNET WEARABLE STARTING");
  Serial.println("================================");

  pinMode(SOS_PIN, INPUT_PULLUP);
  initializeSensors();
  startWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    initializeFirebase();
  }

  lastSensorRead = millis();
  lastUpload = millis();
  lastDisplay = millis();
  lastWiFiAttempt = millis();
}

// ---------- MAIN LOOP ----------
void loop() {
  if (firebaseStarted) {
    app.loop();
  }

  maintainWiFi();

  if (WiFi.status() == WL_CONNECTED && !firebaseStarted) {
    initializeFirebase();
  }

  unsigned long now = millis();

  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;
    readSensors();
  }

  if (now - lastDisplay >= DISPLAY_INTERVAL_MS) {
    lastDisplay = now;
    updateDisplay();
  }

  if (now - lastUpload >= UPLOAD_INTERVAL_MS) {
    lastUpload = now;
    if (firebaseStarted && app.ready()) {
      uploadToFirebase();
    }
  }

  delay(5);
}
