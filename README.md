# indoorgranny_26

Indoor cycling studio app for Granny Gear: a web app (PWA) that reads heart rate, power, cadence and speed sensors, runs a ride with laps, zones and W'bal, and keeps a local history with FIT export.

Clean-room rebuild of the studio's previous vendor app. Phase 1 = sensor-to-ride parity on Web Bluetooth. Later phases add a Cloudflare rider database, Strava upload, and ANT+ (CycleOps hubs) on the studio tablets.

Design docs: `docs/superpowers/specs/`. Plan: `docs/superpowers/plans/2026-10-14-phase1-pwa-parity.md`.

Stack: Vite + React 19 + TypeScript + Tailwind, Zustand stores, IndexedDB (`idb`) for sessions, vite-plugin-pwa for offline.

## Develop

```
npm install
npm run dev
```

Web Bluetooth only works in a secure context. `localhost` counts, so on the dev machine `npm run dev` is enough. To test on a phone:

- USB: `npx vite --host`, then `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173` in Chrome on the phone (it is `localhost` there, so Bluetooth is allowed); or
- use the Cloudflare Pages preview URL for the branch (HTTPS), which is the more realistic test of the installed PWA.

## Test

```
npm test            # Vitest (jsdom, fake-indexeddb)
npx tsc --noEmit    # type check
npm run build       # production build into dist/
```

## Deploy

Cloudflare Pages, git-connected: push to `main` for production; every other branch gets a preview URL.

- Pages project: `indoorgranny-26`
- Account: divergentbiz (`7ad30a1a…`)
- Build command `npm run build`, output directory `dist`

## Phone verification (Nothing Phone (1), Chrome)
1. Open the preview/production URL, Add to Home screen, launch from the icon (standalone).
2. Sensors → Pair heart rate (strap) → value updates within 2 s.
3. Sensors → Pair trainer (KICKR Core, FTMS) → power, cadence, speed update.
4. Settings → countdown 5 s. Training → Start → countdown → tiles live; screen stays on for 5 min.
5. Lap twice; rows appear newest first with zone colour; %dif HR shown on lap 2.
6. Pause 30 s → Restart: elapsed did not advance during pause.
7. Stop → "STOP this session?" → Yes → Save.
8. Activity logs → row shows date, rider, duration, distance, kcal → Actions → Share as FIT → share sheet opens; upload the file manually to Strava → activity appears with power + HR.
9. Airplane mode → relaunch from the icon → app opens (offline) and history is intact.

Results of each run are recorded in the plan under "Phone verification log".
