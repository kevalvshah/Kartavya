# EAS Build Fix Guide - Complete Solution

## Issue Summary
Your EAS build was failing with:
```
EAS project not configured.
Must configure EAS project by running 'eas init' before this command can be run in non-interactive mode.
```

## What Was Fixed

### 1. **app.json** - Added EAS Configuration
```json
"extra": {
  "eas": {
    "projectId": "your-project-id-will-be-set-by-eas-init"
  },
  "apiUrl": "https://kartavya-production.up.railway.app"
},
"owner": "aekaminc"
```

### 2. **eas.json** - Changed Production Build to APK
```json
"production": {
  "distribution": "store",
  "android": {
    "buildType": "apk",           // Changed from "app-bundle"
    "gradleCommand": ":app:assembleRelease"
  }
}
```

### 3. **package.json** - Added expo-dev-client
```json
"dependencies": {
  "expo-dev-client": "~4.0.26",  // NEW - Removes Expo Go warning
  ...
}
```

## Step-by-Step Fix Instructions

### Step 1: Pull Latest Changes
```bash
cd mobile
git pull origin main
```

### Step 2: Install Dependencies
```bash
npm install
```

This will install the new `expo-dev-client` package.

### Step 3: Initialize EAS Project
```bash
npx eas-cli@latest init
```

**What this does:**
- Links your local project to EAS
- Generates a unique project ID
- Updates `app.json` with the real project ID (replacing the placeholder)

**You'll be prompted:**
- Login to your Expo account (if not already logged in)
- Confirm the project name and owner

### Step 4: Configure Android Credentials

You need to set up your Android keystore for signing the APK:

```bash
npx eas-cli@latest credentials
```

**Select:**
1. `Android`
2. `production` profile
3. `Set up a new keystore` (or use existing if you have one)

EAS will generate and store your keystore securely.

### Step 5: Build Your APK

Now you can build:

```bash
npx eas-cli@latest build --platform android --profile production
```

**Or use the npm script:**
```bash
npm run build:production
```

### Step 6: Monitor Build

The build will run on EAS servers. You'll see:
```
✔ Build started, it may take a few minutes to complete.
  You can monitor the build at

  https://expo.dev/accounts/aekaminc/projects/kartavya/builds/...
```

## Expected Build Time
- First build: 10-15 minutes
- Subsequent builds: 5-10 minutes

## Troubleshooting

### If Build Still Fails

#### Error: "Invalid credentials"
```bash
npx eas-cli@latest credentials --platform android
# Re-configure keystore
```

#### Error: "Project not found"
```bash
npx eas-cli@latest whoami  # Verify you're logged in
npx eas-cli@latest init    # Re-initialize if needed
```

#### Error: "Build failed during gradle"
Check the build logs:
```bash
npx eas-cli@latest build:view <BUILD_ID>
```

### Clear Build Cache
If you get strange errors:
```bash
npx eas-cli@latest build --platform android --profile production --clear-cache
```

## Download Your APK

Once build succeeds:

1. **Via Web:** Visit the build URL provided
2. **Via CLI:**
   ```bash
   npx eas-cli@latest build:list
   ```
3. Download the `.apk` file

## Install APK on Device

### Method 1: Direct Download
1. Open the build URL on your Android device
2. Click "Install"
3. Allow installation from unknown sources if prompted

### Method 2: ADB
```bash
adb install path/to/kartavya.apk
```

## Testing the Production Build

1. **Install on a real device** (not emulator for first test)
2. **Test all features:**
   - Login/Registration
   - Profile management
   - Q&A functionality
   - Network requests to Railway backend
3. **Check logs:**
   ```bash
   adb logcat | grep -i kartavya
   ```

## Important Notes

### Expo Go vs Development Build
- ❌ **Expo Go:** For quick prototyping only, includes many libraries
- ✅ **Development Build:** Production-ready, includes only your dependencies
- The `expo-dev-client` package enables development builds

### APK vs AAB
- **APK:** Ready for direct distribution (what you're building now)
- **AAB (App Bundle):** For Google Play Store submission
- You can change this anytime in `eas.json`

### Version Management
Before each new build, update in `app.json`:
```json
"version": "1.0.1",  // User-visible version
"android": {
  "versionCode": 2,  // Increment for each build
  ...
}
```

## Next Steps After Successful Build

1. **Test thoroughly** on multiple devices
2. **Collect crash reports** (consider adding Sentry)
3. **Set up CI/CD** for automated builds
4. **Prepare for Play Store** (if planning to publish)

## Useful Commands

```bash
# Check build status
npx eas-cli@latest build:list

# View specific build
npx eas-cli@latest build:view <BUILD_ID>

# Cancel running build
npx eas-cli@latest build:cancel

# View credentials
npx eas-cli@latest credentials

# Check EAS configuration
npx eas-cli@latest config

# Submit to Play Store (when ready)
npx eas-cli@latest submit --platform android
```

## Support Resources

- **EAS Build Docs:** https://docs.expo.dev/build/introduction/
- **EAS Credentials:** https://docs.expo.dev/app-signing/app-credentials/
- **Build Troubleshooting:** https://docs.expo.dev/build-reference/troubleshooting/

## Summary

The three main fixes were:
1. ✅ Added EAS project configuration to `app.json`
2. ✅ Added `expo-dev-client` to remove Expo Go dependency
3. ✅ Changed production build from app-bundle to APK

Run `npx eas-cli@latest init` and then `npm run build:production` to start building!
