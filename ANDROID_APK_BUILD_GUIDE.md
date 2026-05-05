# Android APK Build Guide - Kartavya Mobile App

## Overview

Your Kartavya mobile app uses **Expo** with **EAS Build**. This guide shows you how to generate an Android APK file.

---

## Prerequisites

1. **Node.js 18+** installed
2. **Expo account** (free): https://expo.dev/signup
3. **EAS CLI** installed globally:
   ```bash
   npm install -g eas-cli
   ```

---

## Step 1: Login to Expo

```bash
eas login
```

Enter your Expo credentials.

---

## Step 2: Configure the Build

Your `eas.json` is already configured with 3 build profiles:

### **Profile 1: Development** (For testing)
```json
{
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "android": { "buildType": "apk" }
  }
}
```
- Builds a development APK
- Includes Expo development tools
- **File size:** ~80-100MB

### **Profile 2: Preview** (For beta testing) - **RECOMMENDED FOR YOU**
```json
{
  "preview": {
    "distribution": "internal",
    "android": { "buildType": "apk" }
  }
}
```
- Builds a production-like APK
- Smaller file size than development
- **File size:** ~40-60MB
- ✅ **Use this for installing on your phone**

### **Profile 3: Production** (For Google Play Store)
```json
{
  "production": {
    "distribution": "store",
    "android": { "buildType": "app-bundle" }
  }
}
```
- Builds an `.aab` (Android App Bundle) for Play Store
- Not installable directly on phones
- Only for publishing to Google Play

---

## Step 3: Build the APK

### **Option A: Preview APK (Recommended)**

```bash
cd mobile/
eas build --profile preview --platform android
```

This will:
1. Upload your code to Expo servers
2. Build the APK in the cloud (takes 5-15 minutes)
3. Provide a download link

### **Option B: Development APK**

```bash
cd mobile/
eas build --profile development --platform android
```

Use this if you need Expo development tools for debugging.

### **Option C: Local Build** (Faster, requires Android Studio)

If you have Android Studio installed:

```bash
cd mobile/
eas build --profile preview --platform android --local
```

This builds on your computer instead of Expo's servers (faster but requires setup).

---

## Step 4: Download the APK

After the build completes, you'll see:

```
✔ Build successful
📦 Android application (.apk)
   https://expo.dev/accounts/aekaminc/projects/kartavya/builds/abc123-xyz
```

### **Download Options:**

1. **Click the link** in the terminal
2. **QR Code:** Scan with your phone to download directly
3. **Expo Dashboard:** 
   - Go to https://expo.dev/accounts/aekaminc/projects/kartavya/builds
   - Find your build
   - Click **"Download"**

---

## Step 5: Install APK on Android Phone

### **Method 1: Direct Download (Easiest)**
1. Open the build link on your Android phone
2. Click **"Install"**
3. If prompted, enable **"Install from unknown sources"**:
   - Settings → Security → Unknown sources → Enable

### **Method 2: USB Transfer**
1. Download APK to your computer
2. Connect phone via USB
3. Copy APK to phone's `Download` folder
4. On phone: Open Files app → Downloads → Tap the APK
5. Click **"Install"**

### **Method 3: Share via Cloud**
1. Upload APK to Google Drive / Dropbox
2. Open link on phone
3. Download and install

---

## Step 6: Verify Installation

1. Look for **"Kartavya"** app icon on your phone
2. Open the app
3. You should see the login screen
4. Test login with: `06bhoomi@gmail.com`

---

## Build Configuration (app.json)

Your current `app.json` should have:

```json
{
  "expo": {
    "name": "Kartavya",
    "slug": "kartavya",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "android": {
      "package": "com.aekaminc.kartavya",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },
    "extra": {
      "apiUrl": "https://kartavya-production.up.railway.app"
    }
  }
}
```

---

## Troubleshooting

### ❌ "Build failed: Missing credentials"

**Solution:** Run this to set up Android credentials:
```bash
eas credentials
```
Select "Android" → "Keystore" → "Generate new keystore"

### ❌ "App not installed" error on phone

**Causes:**
1. **Conflicting signature:** Uninstall old version first
2. **Corrupted APK:** Re-download the file
3. **Insufficient storage:** Free up space on phone

### ❌ Build takes too long (>30 minutes)

**Solution:** Cancel and retry:
```bash
# Cancel current build
Ctrl+C

# Retry
eas build --profile preview --platform android --clear-cache
```

### ❌ "Expo account quota exceeded"

**Solution:** 
- Free Expo accounts get **30 builds/month**
- Wait for next month, or
- Upgrade to Expo Production plan ($29/month)

### ❌ "Cannot connect to backend API"

**Check:**
1. Backend is running: https://kartavya-production.up.railway.app/api/health
2. `apiUrl` in `app.json` is correct
3. Phone has internet connection
4. Try rebuilding with:
   ```bash
   eas build --profile preview --platform android --clear-cache
   ```

---

## Updating the App

### **Minor Updates (No code changes):**
Use Expo Updates (OTA - Over The Air):
```bash
cd mobile/
eas update --branch production --message "Bug fixes"
```
Users get the update automatically when they open the app.

### **Major Updates (Code changes):**
1. Increment `version` in `app.json`:
   ```json
   "version": "1.0.1",
   "android": {
     "versionCode": 2  // Must increment this
   }
   ```
2. Rebuild APK:
   ```bash
   eas build --profile preview --platform android
   ```
3. Users must download and install new APK

---

## Build Commands Cheat Sheet

```bash
# Preview APK (recommended for testing)
eas build --profile preview --platform android

# Development APK (with dev tools)
eas build --profile development --platform android

# Production AAB (for Play Store)
eas build --profile production --platform android

# Build locally (requires Android Studio)
eas build --profile preview --platform android --local

# Build both Android & iOS
eas build --profile preview --platform all

# Clear cache and rebuild
eas build --profile preview --platform android --clear-cache

# Check build status
eas build:list

# View build details
eas build:view [build-id]
```

---

## Publishing to Google Play Store (Optional)

1. **Build production AAB:**
   ```bash
   eas build --profile production --platform android
   ```

2. **Create Google Play Console account:**
   - https://play.google.com/console
   - One-time fee: $25

3. **Upload AAB:**
   - Create new app
   - Upload the `.aab` file
   - Fill in store listing (screenshots, description)
   - Submit for review (2-7 days)

4. **Auto-submit via EAS:**
   ```bash
   eas submit --platform android
   ```

---

## Next Steps

1. ✅ Build preview APK
2. ✅ Install on your phone
3. ✅ Test all features:
   - Login with `06bhoomi@gmail.com`
   - Create tasks
   - Move tasks between columns
   - Test approval workflow
   - Check notifications
4. ✅ Share APK with team for beta testing
5. ⏳ Decide if you want to publish to Play Store

---

## Support

- **Expo Documentation:** https://docs.expo.dev/build/introduction/
- **EAS Build:** https://docs.expo.dev/build/setup/
- **Expo Discord:** https://chat.expo.dev/
- **GitHub Issues:** https://github.com/kevalvshah/Kartavya/issues

---

## Quick Start (TL;DR)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build APK
cd mobile/
eas build --profile preview --platform android

# Wait 5-15 minutes, then download APK from the link
# Install APK on phone and test!
```

**File Output:** `kartavya-[version]-[build-id].apk` (~40-60MB)

---

**Current Status:**
- ✅ Expo project configured
- ✅ EAS build profiles ready
- ✅ Android permissions set
- ✅ Backend API URL configured
- ⏳ Ready to build APK
