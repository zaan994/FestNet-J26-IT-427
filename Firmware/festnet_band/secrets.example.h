// Copy this file to secrets.h (same folder) and fill in your own values.
// secrets.h is gitignored — NEVER commit real credentials.
#pragma once

#define WIFI_SSID "your-wifi-ssid"
#define WIFI_PASSWORD "your-wifi-password"

// Firebase console -> Project settings -> General -> Web API key
#define API_KEY "your-web-api-key"
#define DATABASE_URL "https://festnetproject-default-rtdb.firebaseio.com"

// Firebase Auth account used by THIS band. Link it to the band once with:
//   cd Backend/scripts && npm run admin -- device --id FESTNET_001 --email <USER_EMAIL>
#define USER_EMAIL "band-001@festnet.dev"
#define USER_PASSWORD "change-me"

// Unique id of this band (must match the deviceAuth mapping above)
#define DEVICE_ID "FESTNET_001"
