# Band Hardware & Wiring (ESP32 DevKit v1)

These are the pin assignments the current firmware sketch uses.

## Components

| Part | Purpose | Interface | Address / pins |
|---|---|---|---|
| ESP32 DevKit v1 | MCU, Wi-Fi, ESP-NOW | — | — |
| MAX30102 | heart rate, SpO2 (PPG) | I2C | `0x57` |
| MLX90614 | non-contact IR body temperature | I2C (SMBus, max 100 kHz) | `0x5A` |
| MPU6050 | accelerometer + gyroscope (motion / fall) | I2C | `0x68` |
| SSD1306 OLED 128×64 | local display | I2C | `0x3C` |
| NEO-6M GPS | location | UART2 @ 9600 | RX `GPIO16`, TX `GPIO17` |
| Push button | SOS | GPIO, `INPUT_PULLUP` (LOW = pressed) | `GPIO27` |
| Buzzer (planned, TAF diagram) | local alert feedback | GPIO | suggested `GPIO25` |

## Shared I2C bus

| Signal | ESP32 pin |
|---|---|
| SDA | GPIO21 |
| SCL | GPIO22 |
| VCC | 3V3 |
| GND | GND |

The I2C clock stays at **100 kHz** (`Wire.setClock(100000)`), because the MLX90614 does not support faster SMBus speeds.

## GPS (NEO-6M)

| GPS pin | ESP32 pin |
|---|---|
| TX | GPIO16 (ESP32 RX2) |
| RX | GPIO17 (ESP32 TX2) |
| VCC | 3V3 or 5V (check your module) |
| GND | GND |

## SOS button

One leg to `GPIO27`, the other to `GND`. The internal pull-up is enabled in firmware.

## Notes for C1 (health monitoring)

- The MAX30102 needs **100 Hz** sampling for usable BPM / HRV. Reading it once per second (the
  current sketch) only gives raw values.
- The MLX90614 measures **skin** temperature (≈33–35 °C at the wrist). Core temperature must be
  estimated (skin + calibrated offset) before applying the TAF 38 °C threshold.
