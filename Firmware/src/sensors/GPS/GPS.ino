#include <HTTPClient.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>

// ==========================================
// Network & Backend Configuration
// ==========================================
// Try different formats for iPhone name
const char *WIFI_SSID = "AshiniPhone"; // Using Unicode apostrophe
const char *WIFI_PASSWORD = "12345679";

// Backend server (Your computer IP - UPDATE THIS!)
const char *BACKEND_IP = "172.20.10.13"; // ← CHANGE THIS to your IP from ipconfig
const int BACKEND_PORT = 5001;
char BACKEND_URL[100];

// ==========================================
// GPS Indoor / Fallback Test Coordinates
// ==========================================
// When indoors, GPS modules cannot receive satellite signals.
// In that case, the ESP32 transmits these coordinates (or last known GPS fix).
const double FALLBACK_LAT = 6.903272;
const double FALLBACK_LNG = 79.958359;
const double FALLBACK_ALTITUDE = 23.0;

// Unique Wearable Device Identifier
const char *DEVICE_ID = "BAND-ESP32-001";
const char *ATTENDEE_ID = "ATT-PHYSICAL-01";

// Transmission interval (milliseconds)
const unsigned long TRANSMIT_INTERVAL_MS = 5000; // Increased to 5 seconds
unsigned long lastTransmitTime = 0;

// GPS Module Serial Interface
TinyGPSPlus gps;
#define gpsSerial Serial2

// Connection tracking
int failedAttempts = 0;
const int MAX_FAILED_BEFORE_RECONNECT = 10;
bool wifiConnected = false;

void connectWiFi() {
  Serial.println("\n==========================================");
  Serial.println("WiFi Connection Attempt");
  Serial.println("==========================================");

  // Print what we're trying
  Serial.print("SSID (hex): ");
  for (int i = 0; i < strlen(WIFI_SSID); i++) {
    Serial.printf("%02X ", (unsigned char)WIFI_SSID[i]);
  }
  Serial.println();
  Serial.print("SSID (text): ");
  Serial.println(WIFI_SSID);
  Serial.print("Password length: ");
  Serial.println(strlen(WIFI_PASSWORD));
  Serial.println("==========================================");

  // Properly disconnect first
  WiFi.disconnect(true);
  delay(1000);

  WiFi.mode(WIFI_STA);
  delay(500);

  // Try multiple times
  for (int attempt = 1; attempt <= 3; attempt++) {
    Serial.print("\nAttempt ");
    Serial.print(attempt);
    Serial.print(" of 3...");

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startTime < 10000) {
      delay(500);
      Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n\n✓✓✓ SUCCESS! Wi-Fi Connected! ✓✓✓");
      Serial.print("ESP32 IP: ");
      Serial.println(WiFi.localIP());
      Serial.print("Gateway: ");
      Serial.println(WiFi.gatewayIP());
      Serial.print("Signal: ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");
      wifiConnected = true;
      Serial.println("==========================================\n");
      return;
    }

    Serial.println(" Failed!");
    WiFi.disconnect();
    delay(2000);
  }

  // All attempts failed
  Serial.println("\n\n✗✗✗ FAILED - Could not connect ✗✗✗");
  Serial.println("\n*** TROUBLESHOOTING ***");
  Serial.println("1. Is iPhone hotspot actually ON?");
  Serial.println("   Settings → Personal Hotspot → ON");
  Serial.println("2. Check hotspot name exactly matches:");
  Serial.print("   Looking for: '");
  Serial.print(WIFI_SSID);
  Serial.println("'");
  Serial.println("3. Is password correct? (case-sensitive)");
  Serial.println("4. Try restarting iPhone hotspot");
  Serial.println("5. Try changing iPhone hotspot name to:");
  Serial.println("   'AshiniPhone' (no apostrophe, no space)");
  Serial.println("==========================================\n");

  wifiConnected = false;
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n\n");
  Serial.println("========================================");
  Serial.println("  FestNet Wearable GPS Telemetry");
  Serial.println("========================================");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.println("========================================\n");

  // Construct backend URL
  snprintf(BACKEND_URL, sizeof(BACKEND_URL), "http://%s:%d/api/telemetry",
           BACKEND_IP, BACKEND_PORT);
  Serial.print("Backend URL: ");
  Serial.println(BACKEND_URL);
  Serial.println();

  // Initialize GPS
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
  Serial.println("GPS initialized (RX=16, TX=17)\n");

  // Try to connect WiFi
  connectWiFi();

  if (wifiConnected) {
    Serial.println("✓ Ready to send telemetry\n");
  } else {
    Serial.println("⚠ WARNING: No WiFi - will retry periodically\n");
  }

  Serial.println("========================================\n");
}

void loop() {
  // Check WiFi periodically but don't spam
  static unsigned long lastWiFiCheck = 0;
  if (!wifiConnected && millis() - lastWiFiCheck > 30000) {
    Serial.println("\n[INFO] Retrying WiFi connection...");
    lastWiFiCheck = millis();
    connectWiFi();
  }

  // Feed GPS data
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    gps.encode(c);
  }

  // Only send if WiFi is connected
  if (!wifiConnected) {
    delay(1000);
    return;
  }

  // Periodic telemetry transmission
  unsigned long now = millis();
  if (now - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = now;
    sendTelemetryToBackend();
  }
}

void sendTelemetryToBackend() {
  // Retain last known position when stepping indoors
  static double lastKnownLat = FALLBACK_LAT;
  static double lastKnownLng = FALLBACK_LNG;
  static double lastKnownAlt = FALLBACK_ALTITUDE;
  static bool hasEverHadFix = false;

  double lat = lastKnownLat;
  double lng = lastKnownLng;
  double speedKmH = 0.0;
  double headingDeg = 0.0;
  double altitudeM = lastKnownAlt;
  int satellites = 0;
  bool hasValidFix = false;

  if (gps.location.isValid()) {
    lat = gps.location.lat();
    lng = gps.location.lng();
    speedKmH = gps.speed.kmph();
    headingDeg = gps.course.deg();
    altitudeM = gps.altitude.meters();
    satellites = gps.satellites.value();
    hasValidFix = true;
    hasEverHadFix = true;
    lastKnownLat = lat;
    lastKnownLng = lng;
    lastKnownAlt = altitudeM;
  } else {
    satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
    hasValidFix = false;
  }

  // Construct JSON payload
  char payload[350];
  snprintf(payload, sizeof(payload),
           "{\"deviceId\":\"%s\",\"attendeeId\":\"%s\",\"latitude\":%.6f,"
           "\"longitude\":%.6f,\"altitude\":%.1f,\"speed\":%.2f,\"heading\":%."
           "1f,\"satellites\":%d,\"fixQuality\":\"%s\"}",
           DEVICE_ID, ATTENDEE_ID, lat, lng, altitudeM, speedKmH, headingDeg,
           satellites, hasValidFix ? "Valid" : "SimulatedIndoor");

  Serial.println("------------------------------------------");
  Serial.print("[");
  Serial.print(millis() / 1000);
  Serial.print("s] Sending...");

  if (hasValidFix) {
    Serial.printf(" GPS:OK (%d sats, Lat:%.6f, Lng:%.6f)\n", satellites, lat, lng);
  } else {
    Serial.printf(" GPS:Indoor (%s)\n", hasEverHadFix ? "Retaining Last Known Fix" : "Fallback");
    Serial.printf("      Coordinates sent: %.6f, %.6f\n", lat, lng);
    if (gps.charsProcessed() == 0) {
      Serial.println("      [!] Warning: 0 bytes received from GPS module.");
      Serial.println("          Check wiring: ESP32 Pin 16 (RX) -> GPS TX | Pin 17 (TX) -> GPS RX");
    } else {
      Serial.printf("      [i] GPS module active (chars: %lu). Visible sats: %d\n", gps.charsProcessed(), satellites);
      Serial.println("          Move near a window or outdoors to acquire satellite lock.");
    }
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0) {
    Serial.print("Backend: ✓ SUCCESS (");
    Serial.print(httpResponseCode);
    Serial.println(")");
    failedAttempts = 0;
  } else {
    failedAttempts++;
    Serial.print("Backend: ✗ FAILED (");
    Serial.print(http.errorToString(httpResponseCode));
    Serial.println(")");

    if (failedAttempts == 1) {
      Serial.println("\n*** Backend not responding ***");
      Serial.println("1. Is backend running? (npm run dev)");
      Serial.print("2. Test: http://");
      Serial.print(BACKEND_IP);
      Serial.println(":5001/api/health");
      Serial.println("3. Computer on same WiFi (iPhone hotspot)?");
      Serial.println("4. Firewall blocking port 5001?");
    }
  }

  http.end();
  Serial.println("------------------------------------------\n");
}
