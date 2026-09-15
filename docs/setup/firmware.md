# Firmware setup (Arduino IDE)

The band firmware is an Arduino IDE sketch for the **ESP32 DevKit v1**.

## Folder layout

Arduino requires the `.ino` file to sit in a folder with the same name:

```
Firmware/
└── festnet_band/
    ├── festnet_band.ino      main sketch
    ├── secrets.example.h     template (committed)
    └── secrets.h             real credentials (gitignored — never commit)
```

## Keep credentials out of git

Move the `#define`s for Wi-Fi, API key, account email/password and the database URL from the
`.ino` into `secrets.h`, and add `#include "secrets.h"` at the top of the sketch.
`secrets.h` is gitignored. Commit a `secrets.example.h` with placeholder values so teammates know which keys to define:

```cpp
#pragma once
#define WIFI_SSID       "your-wifi"
#define WIFI_PASSWORD   "your-password"
#define API_KEY         "firebase-web-api-key"
#define USER_EMAIL      "band-001@festnet.dev"   // dedicated band account, not a personal one
#define USER_PASSWORD   "band-password"
#define DATABASE_URL    "https://festnetproject-default-rtdb.firebaseio.com"
```

> If a password was ever shared in plain text (chat, screenshots, commits), change it in the
> Firebase console → Authentication.

## Board & libraries

- **Boards Manager:** `esp32` by Espressif → board **ESP32 Dev Module**
- **Library Manager:**
  - FirebaseClient (mobizt)
  - Adafruit SSD1306 + Adafruit GFX Library
  - Adafruit MLX90614 Library
  - SparkFun MAX3010x Pulse and Proximity Sensor Library
  - Adafruit MPU6050 + Adafruit Unified Sensor
  - TinyGPSPlus (Mikal Hart)
- If the sketch doesn't fit: **Tools → Partition Scheme → Huge APP**.

Wiring: [docs/hardware/wiring.md](../hardware/wiring.md).

## Allowing the band to write after the security rules are deployed

`Backend/database.rules.json` only lets a band write to `devices/{id}` if its Firebase account
is mapped to that id. Before you deploy the rules, link the account the sketch signs in with:

```bash
cd Backend/scripts
npm run admin -- device --id FESTNET_001 --email <USER_EMAIL from secrets.h>
```

This also adds the band to `deviceIndex/`, so it appears in the dashboard and can be paired in the app.

## Payload contract

The JSON written in `uploadToFirebase()` must follow [docs/database/schema.md](../database/schema.md).
Recommended small additions to the current sketch:

| Add | Why |
|---|---|
| `"serverTs":{".sv":"timestamp"}` | Firebase stamps the real server time on every upload |
| `"fwVersion":"0.1.0"` | Shows which firmware a band is running |
| Upload interval 5 s → **2 s** | TAF target |

Each component adds its own fields (C1: `vitals`, `anomaly`, `temperature.coreEstC`, `motion.state` …)
as marked 🔜 in the schema.
