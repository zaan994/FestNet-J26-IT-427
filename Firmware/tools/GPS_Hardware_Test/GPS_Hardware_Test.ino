// ========================================================
// FestNet - GPS Hardware Diagnostic & Baud Scanner
// ========================================================
// Upload this sketch to test if your GPS module is alive,
// find its baud rate, and check if wires are connected properly.
// ========================================================

const int GPS_RX_PIN = 16; // ESP32 RX pin (connect to GPS TX)
const int GPS_TX_PIN = 17; // ESP32 TX pin (connect to GPS RX)

const long BAUD_RATES[] = {9600, 4800, 19200, 38400, 57600, 115200};
const int NUM_BAUDS = 6;

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n\n========================================");
  Serial.println("  FestNet GPS Hardware Diagnostic Tool  ");
  Serial.println("========================================");
  Serial.printf("Listening on ESP32 Pins: RX=%d (to GPS TX), TX=%d (to GPS RX)\n\n", GPS_RX_PIN, GPS_TX_PIN);

  bool foundBaud = false;

  for (int i = 0; i < NUM_BAUDS; i++) {
    long baud = BAUD_RATES[i];
    Serial.printf("[Testing %ld baud] Listening for 3 seconds... ", baud);
    
    Serial2.begin(baud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    unsigned long start = millis();
    unsigned long bytesRead = 0;
    String sample = "";

    while (millis() - start < 3000) {
      while (Serial2.available() > 0) {
        char c = Serial2.read();
        bytesRead++;
        if (sample.length() < 60 && c >= 32 && c <= 126) {
          sample += c;
        }
      }
      delay(10);
    }

    if (bytesRead > 0) {
      Serial.printf("✓ SUCCESS! Received %lu bytes!\n", bytesRead);
      Serial.printf("   Raw Data Sample: %s\n\n", sample.c_str());
      foundBaud = true;
      Serial.println(">> Streaming live GPS data below (Open sky needed for satellite fix) <<");
      Serial.println("----------------------------------------------------------------------");
      return;
    } else {
      Serial.println("✗ 0 bytes received.");
    }
  }

  if (!foundBaud) {
    Serial.println("\n========================================");
    Serial.println("❌ NO DATA RECEIVED ON ANY BAUD RATE!");
    Serial.println("========================================");
    Serial.println("1. Is the POWER LED on your GPS module ON?");
    Serial.println("   - If NOT lit, connect GPS VCC to 5V (or VIN) pin on ESP32.");
    Serial.println("2. Swap the RX and TX jumper wires:");
    Serial.println("   - GPS TX must go to ESP32 Pin 16 (RX2)");
    Serial.println("   - GPS RX must go to ESP32 Pin 17 (TX2)");
    Serial.println("3. Check for loose/damaged jumper wires.");
    Serial.println("========================================\n");
  }
}

void loop() {
  // If GPS is streaming, echo directly to Serial Monitor
  while (Serial2.available() > 0) {
    char c = Serial2.read();
    Serial.write(c);
  }
}
