#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>

// ==========================================
// Network & Backend Configuration
// ==========================================
const char* WIFI_SSID     = "SLT_FIBRE";
const char* WIFI_PASSWORD = "732662677v";

// Local server IP address (Port 5001)
const char* BACKEND_URL   = "http://192.168.1.4:5001/api/telemetry";

// Unique Wearable Device Identifier
const char* DEVICE_ID     = "BAND-ESP32-001";
const char* ATTENDEE_ID   = "ATT-PHYSICAL-01";

// Transmission interval (milliseconds)
const unsigned long TRANSMIT_INTERVAL_MS = 3000;
unsigned long lastTransmitTime = 0;

// GPS Module Serial Interface (NEO-6M on ESP32 Pins 16 RX, 17 TX)
TinyGPSPlus gps;
#define gpsSerial Serial2

void connectWiFi() {
  Serial.print("Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttemptTime = millis();
  // Attempt connection for up to 12 seconds
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 12000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Connected successfully!");
    Serial.print("[Wi-Fi] ESP32 Assigned IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[Wi-Fi] Connection timed out. Will retry in background loop.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==========================================");
  Serial.println("  FestNet Wearable GPS Telemetry Client   ");
  Serial.println("==========================================");

  // Initialize GPS UART at 9600 baud (ESP32 RX=Pin 16, TX=Pin 17)
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("[GPS] Listening on Serial2 (RX: 16, TX: 17)...");

  // Connect to Local Wi-Fi
  connectWiFi();
}

void loop() {
  // Feed incoming GPS NMEA sentences to TinyGPSPlus parser
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    gps.encode(c);
  }

  // Periodic Telemetry Transmission
  unsigned long now = millis();
  if (now - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = now;
    sendTelemetryToBackend();
  }
}

void sendTelemetryToBackend() {
  // Auto-reconnect Wi-Fi if connection was dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi] Reconnecting...");
    WiFi.reconnect();
    return;
  }

  // Read latest GPS metrics
  double lat = 0.0;
  double lng = 0.0;
  double speedKmH = 0.0;
  double headingDeg = 0.0;
  double altitudeM = 0.0;
  int satellites = gps.satellites.value();
  bool hasValidFix = gps.location.isValid();

  if (hasValidFix) {
    lat = gps.location.lat();
    lng = gps.location.lng();
    speedKmH = gps.speed.kmph();
    headingDeg = gps.course.deg();
    altitudeM = gps.altitude.meters();
  } else {
    // If testing indoors without direct satellite sky view:
    // Report last known / test festival coordinates so device appears on the live map
    lat = 7.119075;
    lng = 80.047517;
    speedKmH = 0.0;
    headingDeg = 0.0;
    altitudeM = 55.0;
  }

  // Construct JSON payload
  char payload[350];
  snprintf(payload, sizeof(payload),
    "{\"deviceId\":\"%s\",\"attendeeId\":\"%s\",\"latitude\":%.6f,\"longitude\":%.6f,\"altitude\":%.1f,\"speed\":%.2f,\"heading\":%.1f,\"satellites\":%d,\"fixQuality\":\"%s\"}",
    DEVICE_ID,
    ATTENDEE_ID,
    lat,
    lng,
    altitudeM,
    speedKmH,
    headingDeg,
    satellites,
    hasValidFix ? "Valid" : "SimulatedIndoor"
  );

  Serial.println("\n------------------------------------------");
  Serial.print("[HTTP POST] Transmitting to: ");
  Serial.println(BACKEND_URL);
  Serial.print("[Payload] ");
  Serial.println(payload);

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    Serial.print("[HTTP Success] Response Code: ");
    Serial.println(httpResponseCode);
    String response = http.getString();
    Serial.print("[Server Response] ");
    Serial.println(response);
  } else {
    Serial.print("[HTTP Error] Failed, error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
  Serial.println("------------------------------------------");
}