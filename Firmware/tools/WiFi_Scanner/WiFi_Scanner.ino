/*
 * WiFi Network Scanner for ESP32
 * Use this to find available WiFi networks and their signal strength
 *
 * Upload this to ESP32 and open Serial Monitor (115200 baud)
 * to see all nearby WiFi networks
 */

#include <WiFi.h>

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n");
  Serial.println("========================================");
  Serial.println("    ESP32 WiFi Network Scanner");
  Serial.println("========================================");
  Serial.println();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  Serial.println("Scanning for WiFi networks...");
  Serial.println();
}

void loop() {
  int n = WiFi.scanNetworks();

  Serial.println("========================================");
  Serial.print("Found ");
  Serial.print(n);
  Serial.println(" networks:");
  Serial.println("========================================");

  if (n == 0) {
    Serial.println("No networks found!");
  } else {
    Serial.println();
    Serial.println("  #  |  SSID                 | Signal | Encryption");
    Serial.println("-----|------------------------|--------|------------");

    for (int i = 0; i < n; ++i) {
      // Print number
      Serial.printf(" %2d  | ", i + 1);

      // Print SSID (network name)
      Serial.printf("%-20s | ", WiFi.SSID(i).c_str());

      // Print signal strength
      int rssi = WiFi.RSSI(i);
      Serial.printf("%3d dBm | ", rssi);

      // Print encryption type
      switch (WiFi.encryptionType(i)) {
      case WIFI_AUTH_OPEN:
        Serial.print("Open");
        break;
      case WIFI_AUTH_WEP:
        Serial.print("WEP");
        break;
      case WIFI_AUTH_WPA_PSK:
        Serial.print("WPA");
        break;
      case WIFI_AUTH_WPA2_PSK:
        Serial.print("WPA2");
        break;
      case WIFI_AUTH_WPA_WPA2_PSK:
        Serial.print("WPA/WPA2");
        break;
      case WIFI_AUTH_WPA2_ENTERPRISE:
        Serial.print("WPA2-Enterprise");
        break;
      default:
        Serial.print("Unknown");
      }

      // Highlight strong signals
      if (rssi > -50) {
        Serial.print(" (Excellent)");
      } else if (rssi > -60) {
        Serial.print(" (Good)");
      } else if (rssi > -70) {
        Serial.print(" (Fair)");
      } else {
        Serial.print(" (Weak)");
      }

      Serial.println();
    }
  }

  Serial.println("========================================");
  Serial.println();
  Serial.println("IMPORTANT NOTES:");
  Serial.println("  - ESP32 only supports 2.4GHz WiFi");
  Serial.println("  - 5GHz networks will NOT work");
  Serial.println("  - Choose a network with good signal");
  Serial.println("  - Copy exact SSID name to GPS.ino");
  Serial.println();
  Serial.println("Scanning again in 10 seconds...");
  Serial.println();

  delay(10000);
}
