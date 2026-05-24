# Kartavya — Pending / Notes

## App Store (iOS)

- [ ] **Apple Developer Program** — $99/year enrollment required before any App Store or TestFlight submission.
  Sign up at https://developer.apple.com/programs/enroll/

- [x] `ITSAppUsesNonExemptEncryption: false` added to `mobile/app.json` → `ios.infoPlist`.
  Required by App Store Connect. Already done — no manual config needed.

- [ ] App Store Connect listing — screenshots, description, age rating, privacy policy URL needed before first submission.

## Android (Play Store)

- [ ] **Google Play Developer account** — one-time $25 registration fee.
  Sign up at https://play.google.com/console/signup

- [ ] `versionCode` in `app.json → android.versionCode` must be incremented before each Play Store upload.

## Future performance (when load grows past 15 users)

- [ ] Wire `TodayScreen` and `BoardsScreen` pull-to-refresh to also invalidate `queryClient` cache keys so stale data is cleared on manual refresh.
- [ ] Add `asyncio.gather()` for parallel queries in `dashboards.py` widget loop if more widget types are added.
- [ ] Consider upgrading Supabase to Pro ($25/month) if DB approaches 400 MB — Pro gives 8 GB.

## Security (known low-priority)

- [ ] `reports.py /dispatch` — `REPORT_DISPATCH_SECRET` env var should be set on Railway for the extra layer of protection on the cron endpoint. Currently guarded by `require_admin` session only when unset.

## Misc

- [ ] `notification.wav` asset — currently a minimal 880 Hz tone. Replace with a branded sound before App Store submission.
