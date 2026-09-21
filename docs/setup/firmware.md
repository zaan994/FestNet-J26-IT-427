# Firmware setup (Arduino IDE)

The band firmware is an Arduino IDE sketch for the **ESP32 DevKit v1**. It only **reads sensors and
uploads raw data** to Firebase. All health calculations happen in the backend.

## Folder layout

```
Firmware/
└── festnet_band/
    ├── festnet_band.ino      the sketch (open this in Arduino IDE)
    ├── secrets.example.h     template (committed)
    └── secrets.h             real credentials (gitignored — never commit)
```

Arduino requires the `.ino` to sit in a folder with the same name. `secrets.h` opens as a second tab.

## First-time setup

1. Copy `secrets.example.h` to `secrets.h` and fill in Wi-Fi, the Firebase Web API key, the band's
   Firebase account (email + password) and `DEVICE_ID`.
2. **Boards Manager:** install `esp32` by Espressif → select **ESP32 Dev Module**.
3. **Tools → Partition Scheme → Huge APP (3MB No OTA)**. Firebase + TLS need the space.
4. **Library Manager:** install
   - FirebaseClient (by Mobizt)
   - Adafruit SSD1306 and Adafruit GFX Library
   - Adafruit MLX90614 Library
   - SparkFun MAX3010x Pulse and Proximity Sensor Library
   - Adafruit MPU6050 and Adafruit Unified Sensor
   - TinyGPSPlus (by Mikal Hart)
5. Upload, then open the Serial Monitor at **115200** baud.

Wiring: [docs/hardware/wiring.md](../hardware/wiring.md).

> Use a dedicated Firebase account per band (e.g. `band-001@festnet.dev`), not a personal account.
> If a password was ever shared in plain text, change it in Firebase console → Authentication.

## What the band sends

| Path | Every | Content |
|---|---|---|
| `/festnet/devices/<ID>/latest` | 2 s, and immediately on SOS press | current reading of every sensor, GPS, SOS, Wi-Fi signal, upload stats |
| `/festnet/devices/<ID>/raw/<pushId>` | 2 s | 200 PPG samples (red + IR, 100 Hz) and 100 IMU samples (accel + gyro, 50 Hz) |
| `/festnet/devices/<ID>/meta` | once per boot | firmware version, boot time, sample rates |

Field-by-field definitions are in [docs/database/schema.md](../database/schema.md).

## How it works

- A **sensor task** (FreeRTOS, every 10 ms) owns the I2C bus. It reads the MAX30102 FIFO at
  100 Hz, the MPU6050 at 50 Hz and the MLX90614 at 1 Hz, and refreshes the OLED. Readings are
  collected into 2-second chunks.
- **`loop()`** handles Wi-Fi, NTP time, Firebase, GPS and the SOS button, and uploads the chunks.
  The sensor task has higher priority, so sampling continues while Firebase is busy.
- If Wi-Fi drops, up to 4 chunks (8 s) are buffered. Older chunks are dropped and counted in
  `latest.raw.droppedChunks`.
- The SOS button uses an interrupt. Every press increments `sosPressCount` and triggers an
  immediate `latest` upload.

## Serial monitor: what "working" looks like

```
[OK] OLED detected
[OK] MLX90614 detected
[OK] MAX30102 detected (100 Hz)
[OK] MPU6050 detected (50 Hz)
Wi-Fi connected. IP: 172.20.10.3
[TIME] NTP sync started
Firebase client configured.
[Firebase Auth] ... ready
```

After that, Firebase console → Realtime Database → `festnet/devices/FESTNET_001` shows `latest`
changing every 2 s and new entries appearing under `raw`. The OLED's "Sent" counter goes up.

Set `DEBUG_PRINT_JSON = true` in the sketch to print every uploaded JSON (slow).

## Allowing the band to write after the security rules are deployed

`Backend/database.rules.json` only lets a band write to `devices/{id}` if its Firebase account is
mapped to that id. Before you deploy the rules, link the account the sketch signs in with:

```bash
cd Backend/scripts
npm run admin -- device --id FESTNET_001 --email <USER_EMAIL from secrets.h>
```

This also adds the band to `deviceIndex/`, so it appears in the dashboard and can be paired in the app.

## Database size

Raw chunks are about 12 MB per hour per band. The C1 backend deletes old raw chunks automatically.
Until that is deployed, delete `festnet/devices/<ID>/raw` in the console now and then, or set
`RAW_UPLOAD_ENABLED = false` in the sketch.
