# C2 — proposed band firmware change for SOS (not applied)

Current v0.3.1 behaviour (`docs/FestNet_ESP32_Firmware_v0_3_1.ino`):
* SOS button interrupt, 200 ms debounce, `sosIsrCount++`; `latest` is uploaded immediately.
* `latest.sosPressCount` = presses since boot (**resets on reboot**); `sosActive` is a 5-s latch.
* Backend key: `sos-dev-{deviceId}-{lastBootTs}-{count}` with an age check for reboot collisions.

Remaining limits: a press while offline reaches the backend late with no press time; a reboot before
`meta.lastBootServerTs` updates can collide (mitigated, not eliminated).

## Proposal (small, SOS-only, transport-independent)
```cpp
// Called once per debounced press (same place sosUploadRequested is set).
void publishSos(uint32_t count) {
  // bootId: random 32-bit value chosen at boot (esp_random()), stored in meta.bootId.
  sosEvent.id = String(bootId, HEX) + "-" + String(count);   // unique per press
  sosEvent.pressedAtMs = ntpEpochMsOrZero();                  // 0 if the clock is not synced
  sosUploadRequested = true;                                  // latest carries sosEvent
}
```
`latest.sosEvent = {id, pressedAtMs, count}` — the backend would prefer `sosEvent.id` as the
idempotency key and `pressedAtMs` as `measuredAt`, falling back to today's behaviour when absent.
`publishSos()` isolates the transport so ESP-NOW/gateway delivery can replace Wi-Fi later.

Status: **proposal only** — the firmware file was not modified. Apply, compile in the Arduino IDE
and flash only after agreement; physical testing is then required.
