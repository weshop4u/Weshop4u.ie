#!/bin/bash
set -e

# ============================================================
# WeShop4U Print APK v2 Build Script
# Builds a standalone Android APK without Gradle/Android Studio.
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$PROJECT_DIR/build"
SRC_DIR="$PROJECT_DIR/src"

# Android SDK tools
ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
AAPT="/usr/lib/android-sdk/build-tools/debian/aapt"
DX="/usr/lib/android-sdk/build-tools/debian/dx"
ZIPALIGN="/usr/lib/android-sdk/build-tools/debian/zipalign"

# Verify SDK
if [ ! -f "$ANDROID_JAR" ]; then
    echo "ERROR: android.jar not found. Install Android SDK:"
    echo "  sudo apt install android-sdk google-android-platform-23-installer"
    exit 1
fi

echo "=== WeShop4U Print APK v2 Build ==="

# [1] Clean
echo "[1/8] Cleaning..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/obj" "$BUILD_DIR/classes" "$BUILD_DIR/apk"

# [2] Resources
echo "[2/8] Creating resources..."
mkdir -p "$BUILD_DIR/res/values" "$BUILD_DIR/res/mipmap-hdpi"

cat > "$BUILD_DIR/res/values/strings.xml" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">WeShop4U Print</string>
</resources>
EOF

# Generate launcher icon
python3 -c "
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGBA', (48, 48), (10, 126, 164, 255))
draw = ImageDraw.Draw(img)
# Printer icon shape
draw.rectangle([8, 12, 40, 36], fill=(255, 255, 255, 255))
draw.rectangle([12, 8, 36, 16], fill=(200, 200, 200, 255))
draw.rectangle([12, 28, 36, 34], fill=(0, 229, 255, 255))
draw.rectangle([14, 30, 34, 32], fill=(255, 255, 255, 255))
# Green dot (running indicator)
draw.ellipse([34, 6, 44, 16], fill=(34, 197, 94, 255))
img.save('$BUILD_DIR/res/mipmap-hdpi/ic_launcher.png')
"

# [3] Generate R.java
echo "[3/8] Generating R.java..."
$AAPT package -f -m \
    -S "$BUILD_DIR/res" \
    -J "$BUILD_DIR/gen" \
    -M "$PROJECT_DIR/AndroidManifest.xml" \
    -I "$ANDROID_JAR"

# [4] Compile
echo "[4/8] Compiling Java..."
find "$SRC_DIR" -name "*.java" > "$BUILD_DIR/sources.txt"
find "$BUILD_DIR/gen" -name "*.java" >> "$BUILD_DIR/sources.txt"

javac -source 1.7 -target 1.7 \
    -bootclasspath "$ANDROID_JAR" \
    -classpath "$ANDROID_JAR" \
    -d "$BUILD_DIR/classes" \
    @"$BUILD_DIR/sources.txt" \
    2>&1

echo "   Compiled $(find "$BUILD_DIR/classes" -name "*.class" | wc -l) class files"

# [5] DEX
echo "[5/8] Converting to DEX..."
$DX --dex --output="$BUILD_DIR/classes.dex" "$BUILD_DIR/classes"

# [6] Package
echo "[6/8] Packaging APK..."
$AAPT package -f \
    -S "$BUILD_DIR/res" \
    -M "$PROJECT_DIR/AndroidManifest.xml" \
    -I "$ANDROID_JAR" \
    -F "$BUILD_DIR/unsigned.apk"

cd "$BUILD_DIR"
cp classes.dex apk/
cd apk && zip -u "../unsigned.apk" classes.dex
cd "$PROJECT_DIR"

# [7] Sign
echo "[7/8] Signing..."
KEYSTORE="$BUILD_DIR/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair \
        -keystore "$KEYSTORE" -storepass android -keypass android \
        -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=WeShop4U, OU=Dev, O=WeShop4U, L=Dublin, ST=Dublin, C=IE" 2>/dev/null
fi

jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
    -keystore "$KEYSTORE" -storepass android -keypass android \
    "$BUILD_DIR/unsigned.apk" androiddebugkey 2>&1 | tail -3

# [8] Align
echo "[8/8] Aligning..."
OUTPUT="$PROJECT_DIR/weshop4u-print-v2.apk"
if [ -f "$ZIPALIGN" ]; then
    $ZIPALIGN -f 4 "$BUILD_DIR/unsigned.apk" "$OUTPUT"
else
    cp "$BUILD_DIR/unsigned.apk" "$OUTPUT"
fi

echo ""
echo "=== BUILD COMPLETE ==="
echo "APK: $OUTPUT"
echo "Size: $(du -h "$OUTPUT" | cut -f1)"
