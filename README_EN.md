# Pora: Dom

[Русская версия](./README.md)

An offline-first Android and PWA application for recurring household maintenance, reminders and shared home routines.

The project demonstrates full-cycle solo product development: product framing, UX, offline storage, native Android notifications, automated tests, signed mobile builds and store-release preparation.

## Product capabilities

- room-based household task planning;
- reusable maintenance procedures and checklists;
- standard tasks with recommended intervals;
- automatic next-due-date calculation after completion or postponement;
- equipment cards for filters, robot vacuums, water heaters, air conditioners, washing machines and other household devices;
- household profiles and assignment of tasks to family members;
- activity history and device-specific maintenance logs;
- offline-first operation with local backup and restore;
- installable PWA and Capacitor-based Android application;
- native Android reminders that survive application and device restarts;
- light, dark and system themes;
- configurable monetization adapters and direct-sponsor fallback;
- privacy and store-listing materials.

## Engineering highlights

The application treats reminders as product data rather than transient timers. Completing or postponing a task updates the next due date, while native Android scheduling restores pending notifications after a restart.

The current release bundle operates locally by default. Experimental family synchronization and monetization endpoints are isolated behind configuration instead of being presented as production-ready services.

## Verification

The automated suite covers onboarding, tasks, devices, themes, family assignment, completion history, synchronization conflicts, release configuration, Android notification routing and advertising-provider fallback.

Run it with:

```powershell
pnpm install
pnpm test
node backend/server.mjs
```

Then open `http://127.0.0.1:4173`.

## Android build

```powershell
pnpm run android:debug
```

Release signing data and generated APK/AAB files are intentionally excluded from version control.

## Stack

JavaScript · Node.js · Capacitor · Android · PWA · Service Worker · local-first storage · automated E2E tests

## Status

The codebase corresponds to the 1.0.1 development line. Signed Android artifacts and store materials have been prepared, while publication status is deliberately kept separate from the source-code release.
