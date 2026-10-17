# Class mode, virtual speed and polish — design

Date: 2026-10-17. Branch: continues `phase1-pwa-parity` (unmerged). Builds on `2026-10-14-phase1-pwa-parity-design.md`; everything there still holds unless amended here.

## 1. Intent

The first phone test (Nothing Phone (1), power + HR + cadence sensors, 47-minute class) showed three gaps and one missing feature:

1. **Distance stayed at 0.00 km.** The vendor app derives *virtual speed from power* when no speed sensor is paired (clean-room spec §"Derived"). The port only integrates wheel/trainer speed. This is a parity gap.
2. **FIT download is hidden and unexplained.** The file is valid (Wahoo opens it) but lives behind an "Actions" toggle, the name is not human-sortable, and Android has no viewer, so a tap after download says "Couldn't open file".
3. **Seven minor review findings (R1–R7)** parked after the whole-branch review.
4. **Class mode.** Granny Gear classes are run from a Seconds Pro interval timer; the owner exports `.seconds` files (one per class, named like "Session 1 Score 65 19-20 October 2026"). The app must run those intervals as automatic laps so the rider's lap table matches the instructor's timer. ANTicP had the idea but never actually parsed the file; this is the first real implementation.

Phase 2 (separate portal repo) will later supply the class plans over the network and store activities on Cloudflare. This design keeps the app usable before that exists: Monday 19 October's session is already in the owner's file.

## 2. Goals / non-goals / anti-goals

**Goals**
- Power-only rides accumulate distance exactly as the vendor app did.
- A rider can run the class of the day from the phone without the portal: pick the plan, tap START, choose Warm Up or Start Class, and the LAP button turns into a progress bar that laps itself.
- The FIT file is one tap away, clearly named, with a plain explanation of where it went.
- R1–R7 closed.

**Non-goals**
- No portal, no network fetch of plans (a seam is left for it), no Strava, no Cloudflare storage of rides. Those are the portal project.
- No change to the vendor lap-table columns, tile layout or formulas beyond what is listed here.
- No editing of class plans in the app (portal job). Import and pick only.

**Anti-goals (failure even if it "works")**
- A progress bar that drifts from the instructor's Seconds timer by more than one second per interval.
- Faking speed when a real speed sensor is connected and reading zero (a stopped wheel must read 0).
- A restyle. Phone layout stays as the vendor screenshots; the only new control is the progress-bar LAP button and the Warm Up / Start Class dialog.

## 3. Constraints (unchanged)

Chrome 81 (no flex `gap`, `aspect-ratio`, `inset-*`, `:has()`, `inert`-only gating), Tailwind 3.4, system Roboto, tests green (`npm test`, `npx tsc --noEmit`, `npm run build`, `src/encoding.test.ts`), explicit UTF-8 when scripting on Windows. TDD per task. One commit per task.

## 4. Decisions

### 4.1 Virtual speed from power (parity)

- In `RideEngine.tick`, when the ride has **no real speed source** (`speedMs` input is 0 *and* no speed-capable slot is connected *and* no trainer distance has ever been seen this ride) and `power > 0`, compute virtual speed by solving the vendor's equation with Newton's method:

  `0.95 · P = 0.5 · 1.1865 · 0.388 · v³ + 0.004 · 735 · v`  (constants fixed, as the vendor: air density 1.1865, CdA 0.388 m², Crr 0.004, weight 735 N; **not** the rider's weight — parity over physics).

  Start at v = 5 m/s, iterate 8 times, clamp to [0, 30] m/s. Do **not** reproduce the vendor's extra `/3.6` bug. The equation is the parity reference (it is what the clean-room spec records); check values from it: 80 W → 6.30 m/s (22.7 km/h); 200 W → 8.93 m/s; 0 W → 0.
- "No real speed source" is decided per ride: `LiveInput` gains `speedSensorPresent: boolean`. It is true when the trainer slot is connected, or when the `csc` slot is connected **and its packets carry wheel data** (`parseCsc` already returns `wheelRevs` undefined for cadence-only sensors; the adapter records `hasWheel` per slot on the first packet and `LiveStore` exposes it). A cadence-only sensor in the `csc` slot therefore does not count — the owner's own setup (power pedals + HR + cadence sensor) must get virtual speed. A wheel sensor that is present but stopped reads 0 and suppresses virtual speed. The first tick that sees a wheel sensor connected switches the ride to real speed for good; the first trainer distance does the same (existing rule). A ride never mixes the two.
- Virtual speed feeds the same `DistanceIntegrator`, the Speed tile (tablet), lap `avgSpeedMs`, samples and FIT records, so every downstream artefact agrees. `RideView` gains `speedSource: 'sensor' | 'trainer' | 'virtual' | 'none'`; the tablet Speed tile caption shows "Speed (est.)" when virtual. Phone layout has no speed tile, so nothing else changes visually.
- Tests: the three power points above; a ride with a connected speed slot reading 0 stays at 0; a ride that starts virtual and then sees a trainer distance switches and never returns; e2e distance assertion for a power-only ride.

### 4.2 FIT download UX

- Logs row: a visible **"Download FIT"** button on every row (phone and tablet), next to the summary line. "Actions" keeps Upload (disabled) and Delete.
- File name: `GrannyGear_YYYY-MM-DD_HHMM_<RiderName>.fit` (rider name sanitised to `[A-Za-z0-9-]`, "Guest" when none). The FIT `FileId` is unchanged.
- `shareOrDownload` stays (share first, download fallback) because Chrome Android refuses to share `.fit` and falls through to download. After a `'downloaded'` result show a 6-second notice under the row: "Saved to Downloads as <name>. Open it from Wahoo, Garmin Connect or strava.com/upload." After `'shared'` show nothing.
- R3 wording applies to the failure banners (see 4.4).

### 4.3 Class plans and class mode

**Model** (`src/engine/classplan.ts`):

```ts
interface ClassInterval { name: string; durationS: number; zone: 1|2|3|4|5|6|7 }
interface ClassPlan { id: string; title: string; dates: string[]; source: 'seconds' | 'bundled' | 'portal'; intervals: ClassInterval[]; totalS: number }
```

**Seconds import** (`parseSecondsFile(json): ClassPlan[]`): walks `packs[].items[]`, takes `name`, `identifier`, `intervals[].{name,duration,color}`. Ignores music, vibration, sets. One `ClassPlan` per item; `id` = `identifier + ':' + slug(title)` **always** (two items in the owner's file share an identifier, and the portal must derive the identical id from the same file independently, so the rule cannot depend on what else was parsed). `slug` = lowercase, non-alphanumerics collapsed to `-`, trimmed. Also accepts a bare item (no `packs` wrapper) and a bare `{intervals:[…]}`. **This parser is the single source of truth**: the portal copies `src/engine/classplan.ts` and its tests verbatim; the fixture is committed in this repo at `src/engine/__fixtures__/timers.seconds` (and the same bytes shipped as `public/classplans/2026-10-timers.seconds`).

**Zone mapping** — name keyword first, colour second, both documented in the file header:

| keyword in name (case-insensitive) | zone |
|---|---|
| sprint, neuro, leg speed, wind up | 7 |
| anaerobic | 6 |
| vo2 | 5 |
| threshold | 4 |
| tempo | 3 |
| endurance | 2 |
| easy, recover, cool, warm | 1 |

| Seconds `color` | zone |
|---|---|
| 0 | 1 |
| 5 | 2 |
| 4 | 3 |
| 3 | 4 |
| 6 | 5 |
| 2 | 6 |
| 1 | 7 |

Unknown colour and no keyword → zone 2. The owner's four sessions must map with zero fall-throughs (test asserts every interval resolves by keyword or colour and lists the names that needed the colour).

**Dates**: parse the title for `D-D Month YYYY`, `D - D Month YYYY` or `D Month YYYY` → `dates` as ISO days. "Workout of the day" = first plan whose `dates` includes today; else none.

**Store** (`src/app/classplan-store.ts`, zustand persist `ig.classplans`): `plans`, `selectedId`, `add(plan)`, `remove(id)`, `select(id)`, `selected()`, `loadBundled()` (fetches `/classplans/index.json` → `.seconds` files shipped in `public/classplans/`, i.e. the owner's `timers.seconds` committed as `2026-10-timers.seconds`), `todays()`. On Training mount, if `todays()` exists and the current selection is not a plan dated today, select today's plan (once per day, remembered as `autoPickedOn: 'YYYY-MM-DD'`, so a rider who deliberately picks another plan afterwards is not overridden again that day). A selection whose dates have passed is therefore replaced automatically on the next class day; a plan with no dates is never auto-picked and never auto-replaced unless a dated plan matches today.

**Workouts screen**: a new top section "Class plans" above the existing structured-workout list: list of plans (title, total time, interval count, "today" badge), radio select, an **Import .seconds** button (`<input type=file accept=".seconds,.json">`, parse, add, report "Added N plans" or the parse error), Remove per imported plan (bundled ones cannot be removed). The existing structured-workout section is unchanged.

**Training flow**:

1. START tap with a selected class plan → modal (same component style as the countdown modal, dark Android dialog): title = plan title, buttons **WARM UP** and **START CLASS**, text link Cancel. Without a selected plan START behaves exactly as today.
2. **WARM UP**: `begin()` as today (countdown setting honoured), recording from t = 0; lap 1 is the warm-up. The LAP button reads **START CLASS** (same orange button). Tapping it calls `lap()` (closes the warm-up lap) and starts interval 1 at that second.
3. **START CLASS**: `begin()`; interval 1 starts at t = 0.
4. During the class the button row changes shape: PAUSE and STOP shrink to one quarter of the row each (same height, 20 px text) and the **progress bar** takes the remaining half. Bar: background = the current interval's zone colour (tailwind tokens `zone.z1..z7`), a left-to-right fill in a 35 % darker shade showing elapsed/duration, text line 1 = the interval's display name, line 2 = remaining `m:ss`; black bold 16 px, two lines, ellipsis on overflow. Display name = the Seconds name with trailing `m:ss`, `80+`/`100+` cadence tags and leading `n/m` counters stripped for display only (`displayName` on `ClassInterval`; the raw `name` is kept and stored on the lap). Tablet uses the same split. Tapping the bar = manual lap: the lap closes now and the display jumps to the next interval, **but the plan's absolute boundaries are kept** (the next interval is shortened; every later boundary stays where the instructor's timer has it). Sync with the instructor beats sync with the rider's thumb, and accidental taps on the old LAP spot will happen. Only the Warm Up → START CLASS tap anchors the plan (interval 1 starts at that second). A pause freezes the class clock and therefore desyncs from the instructor for the rest of the class; accepted, the rider chose to stop pedalling.
5. Interval boundaries are driven by the engine clock, not wall time: `ClassRunner` (pure, in `src/engine/classrun.ts`) holds `anchorElapsedS` (the class start) and the plan; boundaries are `anchor + cumulative durations`; a manual skip only moves `index` forward; on every tick it returns `{ index, remainingS, pct, boundary: boolean }`. When `boundary` is true the ride store calls `engine.lap()` in the same tick, so the lap closes at exactly the interval's end second. Pause freezes it because engine elapsed freezes.
6. On a boundary: `navigator.vibrate(200)` and a short beep (Web Audio, 880 Hz, 150 ms). New setting `classAlerts: 'both' | 'vibrate' | 'beep' | 'off'` (default `both`), shown in Settings as "Class alerts" with summary of the current value. The Audio context is created on the START tap (user gesture) so Chrome allows it.
7. After the last interval: final auto-lap, bar shows "Class done — free ride" in zone-1 colour for 5 s, then the normal LAP button returns; rider taps STOP as today.
8. Lap rows keep today's colouring (average-power zone). The plan's zone colour lives on the progress bar only. `LapRow` gains optional `name` (interval name or "Warm up"); the phone table does not show it (vendor columns), the tablet table shows it as a tooltip-less extra column after Lap. FIT laps are unchanged (FIT lap messages have no free-text name we write).
9. `SessionRecord` gains `planId?` and `planTitle?` so the portal can later attribute the ride to the class.

**Tests**: parser on the real file (4 plans, 27/38/59/35 intervals, totals 3060/3090/3020/3090 s — assert the literal numbers, and a second assertion that sums the fixture independently), date parsing for the three title forms, zone mapping table, `ClassRunner` boundary timing at exact seconds including across a pause, store auto-pick once per day, Training flow with fake timers: Warm Up → START CLASS → boundaries produce laps at the right elapsed values → final lap → LAP button back.

### 4.4 R1–R7 (from the whole-branch review)

- **R1/R2** `buildFit`: session and activity end = `startMs + max(durationS, last lap end, last sample t) × 1000`; session `total_timer_time` consistent with the last lap. Test on a session whose last sample `t` exceeds `durationS` by 1.
- **R3** Failure banners read: "Could not delete the discarded ride — it will still show in Logs" and "Could not save — your ride is still on screen, tap Save again". No internal words.
- **R4** `adapter.connect` wraps `getDevices()` in try/catch; a rejection behaves as "no device object" (offline + "Tap Reconnect to choose the device again").
- **R5** Home tiles: `tab:text-[25px]` on the tile label.
- **R6** Migration on rider load: a rider whose `cpW === ftpW` and whose record has no `cpExplicit: true` gets `cpW` cleared (engine falls back to FTP). Saving an explicit CP sets `cpExplicit: true`. One-shot, idempotent.
- **R7** `showNow` false once `state === 'stopped'`.

## 5. Left to the builder

- Exact Newton implementation and its unit test tolerances (±0.01 m/s against a brute-force solve).
- Progress-bar darker fill: compute once from the zone hex in `tailwind.config.js`; a static map of seven fill classes is acceptable (no runtime colour maths needed).
- Beep implementation detail; must not throw when `AudioContext` is unavailable (jsdom).
- Where the "today" badge and "Added N plans" notice sit on the Workouts screen, within the existing phone styling.
- Internal shape of `ClassRunner` as long as boundaries land on the exact second and the store stays the only caller of `engine.lap()`.

## 6. Out of scope, recorded for the portal design

Owner cc's `laurent+workout@divergentbiz.com` → Apps Script watcher → portal Worker (primary), plus an upload form in the portal (backup). Rides pushed to Cloudflare (R2 + D1) per rider; Strava upload from there. Portal mirrors the SelfLoops team page (Cadence Tygervalley: classes calendar with workout of the day, coaches, members, join code).
