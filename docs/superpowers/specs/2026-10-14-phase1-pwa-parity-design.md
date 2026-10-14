# Phase 1 — PWA parity port of the studio ride app

Date: 2026-10-14
Repo: `divergentinc2021/indoorgranny_26` (MIT), local `D:\INDOORCycling\indoorgranny_26`
Hosting: Cloudflare Pages on the divergentbiz account (`7ad30a1a3e8b2d10900133e234c03948`), git-connected, production branch `main`
Reference: `D:\INDOORCycling\GrannyGear\CadenceApp\CLEANROOM-SPEC.md` (behaviour of the vendor app, derived by decompilation; this project copies behaviour, never code)

## 1. Goal

Replace the studio's vendor Android app ("Indoor Cycling" v19.4, a SelfLoops white-label) with a web app that behaves the same from the rider's seat: same screens, same tiles, same lap table, same formulas, same settings. Only the engine and codebase change. SelfLoops is removed; where the vendor app needed the SelfLoops server, phase 1 substitutes a local equivalent.

Success for phase 1: on a Nothing Phone (1) in Chrome, a rider pairs a BLE heart-rate strap and a BLE power source (KICKR Core over FTMS, or a power meter), starts a ride, sees live power/HR/cadence/speed/zones/W'bal, records laps, stops, and the session appears in history and exports as a FIT file that Strava accepts on manual upload. All engine maths is covered by unit tests.

## 2. Scope

In phase 1:
- Home menu, rider picker, sensors screen, ride screen, structured workouts panel, activity logs, settings.
- Web Bluetooth sensors: HR (0x180D), speed/cadence (0x1816), cycling power (0x1818), FTMS indoor bike data (0x1826, read only).
- Ride engine with the vendor's formulas (section 5).
- Local persistence (IndexedDB) and FIT export.
- Installable PWA, offline after first load.

Deferred to later phases (do not build hooks for them beyond what is noted):
- Phase 2: Cloudflare D1 rider database + CSV import + admin page; Strava OAuth + upload.
- Phase 3: JS ANT stack + WebUSB stick transport (ANT+ HR, ANT+ power, CycleOps proprietary hub).
- Phase 4: native ANT bridge APK for the Galaxy Tab 3 fleet (raw ANT frames over `ws://127.0.0.1`).
- Not planned: trainer control (ERG/slope), live telemetry, Muscle Oxygen, SDM, weight scale, classic Bluetooth HR.

## 3. Stack

- Vite + TypeScript. React 19 for screens, Zustand for app state, Tailwind v4 for styling.
- Chart.js for rolling charts.
- `idb` for IndexedDB.
- `@garmin/fitsdk` for FIT encoding (Garmin FIT SDK licence permits use in applications; record it in `THIRD_PARTY.md`).
- `vite-plugin-pwa` for service worker + manifest (static assets stale-while-revalidate; nothing under `/api` is cached, even though phase 1 has no API).
- Vitest for unit tests.
- Build target `chrome81` (last Chrome for Android 4.4, the studio tablets). No syntax or API newer than that in the shipped bundle.
- Fonts: Poppins (headings) + Inter (body), loaded via `<link>`, not CSS `@import` (Tailwind v4 ordering trap).

Engine and parsers live in plain TS modules with no React imports so they are testable and reusable by the later ANT transports.

## 4. Architecture

```
src/
  sensors/            SensorSource interface + adapters
    types.ts          SensorKind, SensorReading, SensorSource, SensorEvent
    ble/              Web Bluetooth adapter + pure parsers
      parse/hr.ts     0x2A37 → {bpm, rr[], contact}
      parse/csc.ts    0x2A5B → {wheelRevs, wheelTime, crankRevs, crankTime} (flag-dependent offsets)
      parse/cps.ts    0x2A63 → {watts, balance, crankRevs, crankTime, ...}
      parse/ftms.ts   0x2AD2 → {speed, cadence, power, distance, hr, kcal, ...}
      derive.ts       speed from wheel revs (circumference, 1024 Hz, 16-bit rollover), cadence from crank revs, stale-to-zero
      adapter.ts      requestDevice/connect/notify/reconnect, remembered device ids
    registry.ts       which adapter serves which SensorKind; merges readings into one LiveStore
  engine/             pure ride maths
    ride.ts           state machine idle→countdown→recording⇄paused→stopped, 1 Hz tick, elapsed/lap timers
    metrics.ts        inst/avg/max accumulators, kJ, calories (MET), distance (trapezoidal), %FTP, %HRmax
    smoothing.ts      EMA α = 2/(N+1) with running mean until N samples, N ∈ {1,5,10,30}
    zones.ts          7 Coggan power zones from FTP, overridable list; HR %max colour bands
    wbal.ts           Skiba integral W'bal
    laps.ts           lap accumulators, %dif HR, lap row model
    workout.ts        structured workout JSON → step index, target W/cad/%HR, interval countdown
  data/               persistence
    db.ts             idb schema v1
    fit.ts            session + samples + laps → FIT bytes
    riders.ts         rider CRUD + defaults
  ui/                 React screens and components
  app/                Zustand stores: settings, rider, sensors, ride
```

Data flow: adapter → `LiveStore` (latest value per metric, with timestamp) → ride engine samples it on its 1 Hz tick → writes a `Sample` row and updates accumulators → React reads engine state through the ride store. This mirrors the vendor's LatestInfo → LocalService → UI shape.

### 4.1 SensorSource interface

```ts
type SensorKind = 'hr' | 'power' | 'cadence' | 'speed' | 'trainer';
interface SensorReading { kind: SensorKind; value: number; at: number; extra?: Record<string, number> }
interface SensorSource {
  id: string;                      // adapter id, e.g. 'ble'
  kinds(): SensorKind[];
  pair(kind: SensorKind): Promise<PairedDevice>;   // user-gesture scan + choose
  connect(device: PairedDevice): Promise<void>;
  disconnect(device: PairedDevice): Promise<void>;
  on(event: 'reading' | 'state', cb: (e: SensorEvent) => void): () => void;
}
```
One BLE device may feed several kinds (a KICKR gives power, cadence, speed over FTMS). The registry maps each kind to one chosen device; a later ANT adapter implements the same interface.

### 4.2 Web Bluetooth adapter

- `requestDevice` filtered by service for the kind being paired; `optionalServices` always lists all four.
- Remembered devices: store `device.id` + name per kind in settings. On ride start, if `navigator.bluetooth.getDevices` exists, reconnect silently; otherwise show a "reconnect" button that performs the chooser (user gesture required).
- Notifications on 0x2A37, 0x2A5B, 0x2A63, 0x2AD2. Device Information 0x2A25 (serial) is on the Web Bluetooth blocklist; do not read it.
- On `gattserverdisconnected`: mark state `offline`, attempt reconnect with backoff (3 tries, 2/4/8 s), then wait for user.
- Parsers are pure `(DataView) => Reading` functions. Vendor bugs are fixed, not copied: HR format from the flags byte; CSC crank fields at offset 1 when wheel data is absent; wheel circumference from settings; 16-bit time and revolution rollover handled; stale-to-zero after 5 s without a new event.

## 5. Engine behaviour (vendor parity)

- Tick 1 s. Elapsed = (now − start − pausedTotal)/1000 + 1 s. Lap time computed the same way from lap start. Previous-lap duration shown.
- Instant, session avg, session max and lap avg/max for power, HR, cadence. Avg = running mean of samples taken while recording.
- kJ = avgPower × elapsedSeconds / 1000.
- Calories: FTMS kcal if the trainer supplies it, otherwise MET × weightKg × hours with MET 8 (indoor cycling). Final lap row uses kJ / 4.184 as the vendor did.
- Distance: trainer distance if FTMS supplies it, otherwise trapezoidal integration of speed; speed from wheel revs when a speed sensor is paired, otherwise from FTMS. (The vendor's virtual-speed-from-power model is not ported.)
- Smoothing setting {1,5,10,30}: applies to displayed power and cadence (not HR), EMA α = 2/(N+1), running mean until N samples. Averages and FIT records use raw values.
- Power zones: default 7 zones from FTP with the vendor's boundaries scaled from the FTP-250 table: Z1 0–54 %, Z2 55–74 %, Z3 75–89 %, Z4 90–104 %, Z5 105–119 %, Z6 120–149 %, Z7 150 %+. A rider may carry an explicit `[[name, lowerWatts], …]` list that overrides (upper = next lower − 1, last = "and higher"). Lap rows and the "now" row are coloured by avg-power zone.
- HR bands by %HRmax: ≤ 50 light blue, ≤ 65 green, ≤ 75 dark yellow, ≤ 85 orange, > 85 red.
- W'bal (Skiba integral): CP = rider `cp_w` (defaults to FTP when unset; the vendor ignored CP and this is the one deliberate deviation), W' = `wprime_kj` × 1000 J, τ = 546·e^(−0.01·(CP − meanPowerBelowCP)) + 316 where meanPowerBelowCP is the running mean of all samples with P < CP so far. Each 1 s tick: W'exp(t) = Σ_{i ≤ t, P_i > CP} (P_i − CP) · e^(−(t − t_i)/τ), computed incrementally as W'exp(t) = W'exp(t−1)·e^(−1/τ) + max(P_t − CP, 0). Tile shows W'exp / W' × 100 (% expended); chart shows W' − W'exp in kJ.
- Laps: Lap button closes a lap row {number, duration, avgSpeed, distance, avgPower, avgHR, difHR%, avgCad}; difHR% = (lapAvgHR − prevLapAvgHR)/prevLapAvgHR × 100. List newest first.
- Countdown setting {0, 5 s, 1 h, 2 h, 3 h}: modal counts down before recording; tapping it starts immediately.
- Pause/Restart: manual. Paused time is excluded from elapsed. No auto-pause.
- Stop → confirm "STOP this session?" → "Save?" Save keeps the session; Discard deletes session, laps and samples.
- During a ride: screen wake lock, portrait orientation request, browser back blocked with the vendor's "stop the activity first" message.
- Structured workout: JSON `{id, title, type:'PWR'|'HR'|'CAD', wdate, totalduration, timeS[], pwrS[], cadS[], hrS[]}` loaded from `public/workouts/*.json` and from a file picker. Shown only when `structuredWorkoutEnabled` and viewport ≥ 600 px: stepped profile chart, live %FTP/%HRmax trace, current interval countdown, TARGET W = pwrS × FTP/100 beside CURRENT, target cadence, target %HR. Display only.

## 6. Screens (1:1 with the vendor app)

1. **Home** — five tiles: TRAINING, ACTIVITY LOGS, SETTINGS, STRUCTURED WORKOUTS, SENSORS. First run shows a Terms/Privacy acceptance (stored as `license_accepted`). Overflow: About.
2. **Rider** — replaces the SelfLoops login. List of local riders, "add rider" form with name, email, weight, FTP, CP, W', HRmax, optional zone list. Selected rider is the session owner. Phase 2 will populate this list from D1; the screen does not change.
3. **Sensors** — four slots (HR, power, cadence/speed, trainer), each with pair / forget / status (searching, connected, offline) and the live value. Mirrors the vendor's status panels.
4. **Training (ride)** — tiles: power inst/avg/max, HR inst/avg/max, cadence inst/avg/max, %FTP, speed, distance, W'bal % expended, kJ, HRmax + %HRmax (coloured). Rolling charts (800 samples): HR 45–220, power 0–550, cadence, W'bal. Lap table with the 8 columns. Controls: Start, Pause/Restart, Lap, Stop. Workout panel per section 5 on wide screens. Units follow `unit_system`.
5. **Activity logs** — rows: date "dd MMMM yyyy, HH:mm:ss", rider name, duration h:m:s, distance, calories. Row actions: Share FIT (Web Share API with file when available, else download), Delete. Menu: Delete all (confirm). Detail view shows laps and the charts for that session.
6. **Structured workouts** — list (title, date, duration, target type), tap to select; "import JSON" instead of the vendor's download.
7. **Settings** — same keys and choices: `unit_system` (metric/imperial, converts stored weight), `countdown`, `smoothing`, `wheel` circumference mm (default 1782, 1500–4000), `structuredWorkoutEnabled`, `log_recording_frequency` (fixed 1 s, shown), app version. Rider-specific values (weight, FTP, CP, W', HRmax) are edited on the Rider screen, not here.

## 7. Data model (IndexedDB `indoorgranny`, version 1)

- `riders` {id, name, email, weightKg, ftpW, cpW?, wprimeKj, hrMax, powerZones?: [name, lowerW][] , createdAt}
- `sessions` {id = startMs, riderId, riderName, sport:'indoor_cycling', startMs, durationS, distanceM, calories, nSamples, avgPower, maxPower, avgHr, maxHr, avgCad, uploaded: null | {service, remoteId}}  — `uploaded` reserved for phase 2.
- `laps` {sessionId, number, startOffsetS, durationS, distanceM, calories, avgPower, avgCad, avgSpeed, avgHr, difHrPct}
- `samples` {sessionId, t, hr, cadence, power, lap, distanceM, speed, balance?, teL?, teR?, psL?, psR?} — the vendor's 17-column point record minus GPS and Muscle O2.
- `settings` key/value; `devices` {kind, bleId, name}.

Samples are written in batches every 10 s during a ride and flushed on stop, so a crash loses at most 10 s.

## 8. FIT export

Message set mirrors the vendor so downstream tools behave the same: FileId (type activity, manufacturer `development`, product 1, serial from session id), DeviceInfo, one Record per sample (timestamp, heart_rate, cadence, power, speed, distance, left_right_balance / torque effectiveness / pedal smoothness when present), one Lap per lap (start_time, total_elapsed_time, total_timer_time, total_distance, avg/max power, avg/max HR, avg cadence), Session (sport cycling, sub_sport indoor_cycling, totals, averages, maxima, total_calories, num_laps), Activity. Encoded with `@garmin/fitsdk` Encoder; validated in tests by decoding with the same SDK and comparing counts and sums.

## 9. Error handling

- No Web Bluetooth (desktop Firefox, iOS Safari): Sensors screen explains which browsers work; ride still runs with no sensors (timers only).
- Pairing cancelled or failed: slot shows the error text from the browser, stays unpaired.
- Sensor drops mid-ride: value tile greys out after 5 s with no event, reconnect attempts as in 4.2, ride keeps recording zeros for that metric (vendor behaviour).
- IndexedDB write failure: ride continues in memory, banner "history not saved", retry on stop.
- Low-level parse errors never throw into the UI: parsers return `null` for malformed packets and the adapter logs them.

## 10. Testing

- Vitest unit tests, written first (TDD):
  - parsers with byte fixtures taken from the Bluetooth SIG specs and from a KICKR Core capture, including flag combinations, rollover and malformed lengths;
  - derive (speed/cadence from revs, stale-to-zero);
  - engine: timers with paused intervals, averages, zones, W'bal against hand-computed values, smoothing, laps and difHR;
  - FIT round-trip via the SDK decoder.
- Manual device test on the Nothing Phone (1) over the Pages preview URL (Web Bluetooth needs HTTPS): KICKR Core via FTMS, HR strap, a 5-minute ride with two laps, export FIT, upload manually to Strava.
- Chrome 81 compatibility is checked by the build target and one `npx browserslist`-style audit; a real Tab 3 test is phase 4.

## 11. Deployment

- GitHub repo `divergentinc2021/indoorgranny_26`, MIT, created with the first commit.
- Cloudflare Pages project `indoorgranny-26` on the divergentbiz account, created git-connected through the API (`source.type = github`, `production_branch = main`, build `npm run build`, output `dist`), never as a direct-upload project.
- Every push to `main` deploys; branches get preview URLs for phone testing.
- `wrangler whoami` must show `7ad30a1a…` before any manual wrangler action; the personal profile on this Windows box is `config-personal`.

## 12. Open items carried to later phases

- D1 schema mirrors the `riders` store; CSV import maps the columns in CLEANROOM-SPEC §5.
- Strava: register the API application early; new apps are capped at one connected athlete until Strava raises the limit.
- ANT: the JS ANT stack consumes raw ANT frames from either WebUSB or the tablet bridge; CycleOps payload decoding is written once there.
