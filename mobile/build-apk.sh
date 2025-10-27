#!/bin/bash

# Navigate to android directory
cd android

# Clean previous builds
./gradlew clean

# Build release APK
./gradlew assembleRelease

# Copy APK to output directory
cp app/build/outputs/apk/release/app-release.apk ../liga-do-bem-botucatu.apk

echo "APK build completed successfully!"
echo "Output: liga-do-bem-botucatu.apk"

