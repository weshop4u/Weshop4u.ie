# POS Printer Research - 6000V-Lite

## Key Findings

### Device Info
- Model: 6000V-Lite (BUY2FIX POS-6000 variant)
- Android: 8.1.0
- Printer: Built-in 58mm thermal
- Pre-installed: "PrinterTools" app (3.27 MB)
- Pre-installed: Old "WeShop4U" app (11.71 MB) - had working printing

### PrinterTools App
- Matches Posiflex "Android Terminal Series POS Printer Tools" pattern
- Posiflex version is v2.1.12, 8.4 MB
- The 6000V-Lite version is 3.27 MB - likely a lighter/OEM variant
- Posiflex also has "POS Printer Manager" - separate management app

### How Built-in POS Printers Typically Work
Based on CITAQ H10-3 research and similar devices:

1. **Serial Port Method** (most common for built-in printers):
   - Path: `/dev/ttyS1` (most common) or `/dev/ttyS3`
   - Baud rate: 115200 (or 9600)
   - Protocol: ESC/POS commands sent as byte arrays
   - Requires: android-serialport-api library
   - Flow: Open serial port → write ESC/POS bytes → close

2. **AIDL Service Method** (some manufacturers):
   - Bind to manufacturer's printer service
   - Call print methods via AIDL interface
   - Package name varies by manufacturer

3. **Intent Method** (PrinterTools may expose this):
   - Send intent with print data to PrinterTools
   - PrinterTools handles the actual serial communication

### Next Steps
1. Open PrinterTools on the POS to see its UI and identify the API
2. Check the old WeShop4U app source/behavior for the print method used
3. Try serial port approach: /dev/ttyS1 at 115200 baud with ESC/POS
4. If serial doesn't work, try AIDL binding to PrinterTools service

### ESC/POS Commands Reference (58mm)
- Initialize: `\x1B\x40`
- Bold on: `\x1B\x45\x01`
- Bold off: `\x1B\x45\x00`
- Center align: `\x1B\x61\x01`
- Left align: `\x1B\x61\x00`
- Right align: `\x1B\x61\x02`
- Double height: `\x1B\x21\x10`
- Normal size: `\x1B\x21\x00`
- Cut paper: `\x1D\x56\x42\x00`
- Feed lines: `\x1B\x64\x03`
- Print stored logo: `\x1C\x70\x01\x00`
