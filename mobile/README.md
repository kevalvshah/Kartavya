# Kartavaya Mobile (React Native)

Android + iOS app for [Kartavaya](https://Kartavaya-aekam.vercel.app) by Aekam Inc.

## Setup

```bash
cd mobile
npm install
```

## Run on Android (local)

```bash
npx react-native run-android
```

Requires: Android Studio, JDK 17, an Android emulator or USB-connected device.

## Build APK — **No Android Studio needed (recommended)**

Use [Expo EAS Build](https://docs.expo.dev/build/introduction/) to get an APK in your browser:

```bash
npm install -g eas-cli
eas login          # create a free Expo account at expo.dev
eas build --platform android --profile preview
```

This builds in the cloud and emails you a download link for the APK in ~5 minutes.

## Screens

| Screen | Description |
|---|---|
| Login | Email + password, invite-only messaging |
| Dashboard | Stats, recent projects, due-soon tasks |
| Projects | List all projects, create/delete |
| Board | 4 views: Board (Kanban), List, Schedule, Tracker |
| Tasks | All tasks with status + priority filters |
| Admin | Invite users, manage roles (admin only) |
| Client Portal | Restricted view for clients + comments |
| Profile | User info, sign out |

## Backend

All API calls hit `https://Kartavaya-production.up.railway.app/api`.
Change `BACKEND_URL` in `src/config.js` if you redeploy the backend.

## Get APK via EAS (step by step)

1. `npm install -g eas-cli`
2. `eas login` (free Expo account)
3. `cd mobile && eas build --platform android --profile preview`
4. Wait ~5 min — EAS emails you the `.apk` download link
5. Install on Android: Settings → Install unknown apps → allow, then open the APK
