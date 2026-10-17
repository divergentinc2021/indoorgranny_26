# Class mode, virtual speed and polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Power-only rides get vendor-parity virtual speed, the FIT download is visible and named, the seven parked review findings close, and the app runs a Seconds Pro class plan as automatic laps with a progress-bar LAP button.

**Architecture:** Pure engine modules first (`virtual-speed`, `classplan` parser, `classrun` runner), each with its own tests; the ride store is the only caller of `engine.lap()` and drives the runner from the same 1 Hz tick; UI changes are limited to Training (start dialog, class bar, button-row split), Workouts (class-plan section + import), Logs (Download button) and Settings (class alerts). Fixture `.seconds` file is committed once and shipped as a bundled plan.

**Tech Stack:** Vite 6, React 19, TypeScript, Zustand 5 (persist), Tailwind 3.4, Vitest + Testing Library + fake-indexeddb, `@garmin/fitsdk`.

**Spec:** `docs/superpowers/specs/2026-10-17-class-mode-and-polish-design.md` (read it first; §4 holds every decision referenced below).

## Global Constraints

- Branch `phase1-pwa-parity`; one commit per task; `Co-Authored-By` trailer as the repo's recent commits.
- Chrome 81: no flex `gap`, `aspect-ratio`, `inset-*`, `:has()`, `inert`-only gating; Tailwind 3.4; `build.target` stays `chrome81`.
- Every task ends with `npm test` all green, `npx tsc --noEmit` clean, `npm run build` clean. `src/encoding.test.ts` must stay green: any scripted file write uses explicit UTF-8.
- TDD: failing test first in every task.
- Phone layout (< 600 px) follows `docs/reference/vendor-screenshots/`; tablet via `tab:` prefix. No restyle beyond the controls named in the spec.
- Literal Tailwind class strings only (no template-built class names).
- Vendor parity numbers are in the spec; do not "improve" formulas.

## Review Focus

1. A `.seconds` interval with `indefinite: true` or `duration <= 0` must be dropped at parse time, never produce a zero-length lap (Task 6).
2. "Today" for auto-pick and the "today" badge is the phone's local date, not UTC; a class at 18:05 SAST on 19 Oct must still match "19-20 October 2026" (Task 6, Task 8).
3. Power spikes (2000 W) must clamp virtual speed to 30 m/s and 0 W must give 0, so distance cannot explode or go negative (Task 1).
4. STOP during a class clears the runner: the stopped screen shows the normal Save-or-discard row, no bar, and no further auto-laps happen (Task 9, Task 10).
5. Importing a corrupt or non-JSON file reports an error and changes nothing; importing the same file twice adds nothing the second time (Task 8).

---

### Task 1: Virtual speed from power (parity)

**Files:**
- Create: `src/engine/virtual-speed.ts`, `src/engine/virtual-speed.test.ts`
- Modify: `src/engine/ride.ts` (LiveInput, RideView, tick), `src/sensors/live-store.ts` (snapshot), `src/sensors/ble/adapter.ts:115,123` (speed emit on wheel packets), `src/ui/TrainingScreen.tsx:86` (Speed caption)
- Test: `src/engine/ride.test.ts`, `src/sensors/live-store.test.ts`, `src/e2e.test.ts`

**Interfaces:**
- Produces: `virtualSpeedMs(powerW: number): number` (m/s). `LiveInput.speedSensorPresent?: boolean` (default false). `RideView.speedSource: 'sensor' | 'trainer' | 'virtual' | 'none'`.

- [ ] **Step 1: Failing tests for the solver** in `src/engine/virtual-speed.test.ts`

```ts
import { virtualSpeedMs } from './virtual-speed';
const f = (v: number) => 0.5 * 1.1865 * 0.388 * v ** 3 + 0.004 * 735 * v;
it('solves 0.95P = aero + rolling (vendor constants)', () => {
  expect(virtualSpeedMs(80)).toBeCloseTo(6.30, 2);
  expect(virtualSpeedMs(200)).toBeCloseTo(8.93, 2);
  for (const p of [10, 50, 120, 300, 600]) expect(f(virtualSpeedMs(p))).toBeCloseTo(0.95 * p, 1);
});
it('clamps: 0 W → 0, 2000 W → 30 m/s, negative → 0', () => { expect(virtualSpeedMs(0)).toBe(0); expect(virtualSpeedMs(2000)).toBe(30); expect(virtualSpeedMs(-5)).toBe(0); });
```

- [ ] **Step 2: Run** `npx vitest run src/engine/virtual-speed.test.ts` — FAIL (module not found).
- [ ] **Step 3: Implement** `export function virtualSpeedMs(powerW: number): number` — Newton from v = 5, 8 iterations, then clamp to [0, 30]; return 0 when `powerW <= 0`.
- [ ] **Step 4: Run** the file — PASS.
- [ ] **Step 5: Failing engine tests** in `src/engine/ride.test.ts` (extend the `live()` helper with an optional 5th arg `speedSensorPresent = false`):
  - `'power-only ride uses virtual speed: 80 W for 10 ticks ≈ 63 m, speedSource virtual'` — ticks with `speedMs: 0`, `power: 80`; expect `view.distanceM` ≈ 10 × 6.30 (±0.5) and `view.speedSource === 'virtual'`, `samples[9].speedMs ≈ 6.30`.
  - `'a present wheel sensor reading 0 keeps distance at 0 and speedSource sensor'` — `speedSensorPresent: true, speedMs: 0`.
  - `'once a wheel sensor is seen the ride never falls back to virtual'` — 3 ticks sensor present (speed 8), then 3 ticks `speedSensorPresent: false, power 200`: distance grows by 0 in the last 3, `speedSource` stays `'sensor'`.
  - `'trainer distance wins over virtual and never returns'` — tick virtual, then tick with `trainerDistanceM`, then without: `speedSource` `'trainer'` throughout after first trainer value.
  - `'0 W with no sensors → speedSource none, distance 0'`.
- [ ] **Step 6: Run** `npx vitest run src/engine/ride.test.ts` — the new tests FAIL.
- [ ] **Step 7: Implement in `ride.ts`:** add `speedSensorPresent?: boolean` to `LiveInput`; private `speedMode: 'undecided' | 'sensor' | 'virtual' = 'undecided'`; in `tick`, before the integrator: if `input.speedSensorPresent` → `speedMode = 'sensor'`; `const speedMs = speedMode === 'sensor' ? input.speedMs : input.power > 0 ? (speedMode = 'virtual', virtualSpeedMs(input.power)) : input.speedMs;` use `speedMs` for the integrator, `laps.sample`, the `Sample` and `this.last`. `view.speedSource` = `'trainer'` when `trainerDist.seen`, else `'sensor'` / `'virtual'` by mode, else `'none'`.
- [ ] **Step 8: Live store:** failing test in `src/sensors/live-store.test.ts`: `'speedSensorPresent is true with a fresh speed or trainer reading, false otherwise and after stale'`. Implement in `snapshot`: `speedSensorPresent: !!this.get('speed', now) || !!this.get('trainer', now)`.
- [ ] **Step 9: Adapter:** in the CSC (line 115) and CPS (line 123) wheel branches emit `{ kind: 'speed', value: rate ?? c.value(at), at, slot }` on **every** wheel-bearing packet (today nothing is emitted when `push` returns null, so a stopped or first packet leaves no trace). Add an adapter test with a fake characteristic: two identical CSC packets 1 s apart → two `speed` readings, second value 0 after the counter is stale or equal to the last rate before (assert the reading exists and `value` is a number).
- [ ] **Step 10: Training caption:** tablet Speed tile label `v?.speedSource === 'virtual' ? 'Speed (est.)' : 'Speed'`.
- [ ] **Step 11: e2e:** add to `src/e2e.test.ts` a power-only variant: fake adapter emits power 200 + HR + cadence, no speed; after 95 s `session.distanceM` ≈ 95 × 8.93 within 2 %, FIT records carry `distance` > 0.
- [ ] **Step 12: Run** `npm test`, `npx tsc --noEmit`, `npm run build` — all green.
- [ ] **Step 13: Commit** `feat(engine): virtual speed from power when no wheel or trainer speed (vendor parity)`.

### Task 2: FIT download — visible button, sortable name, plain notice

**Files:**
- Modify: `src/data/fit.ts:44-47`, `src/ui/LogsScreen.tsx`, `README.md:49`
- Test: `src/data/fit.test.ts`, `src/ui/LogsScreen.test.tsx`

**Interfaces:**
- Produces: `fitFileName(s: SessionRecord): string` → `GrannyGear_YYYY-MM-DD_HHMM_<Rider>.fit`.

- [ ] **Step 1: Failing test** in `fit.test.ts`: `fitFileName({ startMs: Date(2026,9,14,18,5), riderName: 'Mark Carroll' })` → `'GrannyGear_2026-10-14_1805_Mark-Carroll.fit'`; riderName `''` → `_Guest.fit`; riderName `'Zoë/Ann'` → `'Zo-Ann'` (non `[A-Za-z0-9-]` collapsed to one `-`, trimmed).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Failing UI tests** in `LogsScreen.test.tsx`: a row renders a button named `Download FIT` without opening Actions; clicking it with `shareOrDownload` mocked to resolve `'downloaded'` shows the text `Saved to Downloads as GrannyGear_…fit. Open it from Wahoo, Garmin Connect or strava.com/upload.`; mocked `'shared'` shows no notice; the notice disappears after 6 s (fake timers).
- [ ] **Step 6: Implement** in `LogsScreen.tsx`: move the share button out of the Actions block as `Download FIT` (cyan style, right of the summary line, phone and tablet); keep Actions with Upload (disabled) and Delete; `notice` state `{ id, text }` cleared by a 6 s timeout.
- [ ] **Step 7: README** step 8: "Activity logs → Download FIT → file lands in Downloads as GrannyGear_date_time_rider.fit (Android has no viewer: open it from Wahoo / Garmin Connect, or upload at strava.com/upload)".
- [ ] **Step 8: Run** all three commands — green. **Step 9: Commit** `feat(logs): visible Download FIT, GrannyGear file name, post-download notice`.

### Task 3: R1/R2 — FIT end time covers the last lap and sample

**Files:**
- Modify: `src/data/fit.ts:38-41`
- Test: `src/data/fit.test.ts`

- [ ] **Step 1: Failing test:** session `durationS: 100`, laps ending at 101, last sample `t: 101`; decode → session `totalElapsedTime === 101`, `timestamp === start + 101 s`, activity `totalTimerTime === 101`; and with `durationS: 120` and laps/samples ending at 100 the end is 120.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `const endS = Math.max(s.durationS, lastLapEnd, lastSampleT)` and use it for the stopAll event, session and activity. **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `fix(fit): session end covers the final lap and record`.

### Task 4: R4 / R5 / R7 — getDevices rejection, tablet tile size, hide "now" after Stop

**Files:**
- Modify: `src/sensors/ble/adapter.ts:54`, `src/ui/Home.tsx:27`, `src/ui/TrainingScreen.tsx:96`, `src/ui/components/LapTable.tsx` (if `showNow` is not already a prop)
- Test: `src/sensors/ble/adapter.test.ts` (or the existing adapter test file), `src/ui/Home.test.tsx`, `src/ui/TrainingScreen.test.tsx`

- [ ] **Step 1: Failing tests:** (a) fake `bluetooth.getDevices` rejecting → `connect(d)` resolves, state `offline` with the chooser hint message; (b) Home tile link has class `tab:text-[25px]`; (c) after Stop the row with text `now` is absent.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement:** wrap the `getDevices()` call in `try/catch` (treat rejection as no device); add `tab:text-[25px]` to the tile class; pass `showNow={ride.state !== 'stopped'}` to `LapTable` (add the prop defaulting to `true` if missing). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `fix: getDevices rejection, tablet tile size, hide now row after stop (R4 R5 R7)`.

### Task 5: R3 / R6 — banner wording and legacy CP migration

**Files:**
- Modify: `src/app/ride-store.ts:15,43,71`, `src/ui/TrainingScreen.tsx:70,132`, `src/data/db.ts:5` (`cpExplicit?: boolean`), `src/app/rider-store.ts:7`, `src/ui/RiderScreen.tsx` and `src/ui/SettingsScreen.tsx` (where CP is written)
- Test: `src/app/ride-store.flush.test.ts`, `src/ui/TrainingScreen.test.tsx`, `src/app/stores.test.ts`

**Interfaces:**
- Produces: `Rider.cpExplicit?: boolean`; `migrateRiders(riders: Rider[]): Rider[]` exported from `src/data/riders.ts` (pure).

- [ ] **Step 1: Failing tests:** flush failure sets `storageError === 'Could not save history — your ride is still on screen'`; discard-delete failure sets `'Could not delete the discarded ride — it will still show in Logs'`; the Training banner shows the store text verbatim; the save dialog error reads `Could not save — your ride is still on screen, tap Save again`.
- [ ] **Step 2:** `migrateRiders` tests: `{ftpW: 250, cpW: 250}` → `cpW` undefined; `{ftpW: 250, cpW: 250, cpExplicit: true}` unchanged; `{ftpW: 250, cpW: 230}` unchanged; result is idempotent.
- [ ] **Step 3: Run** — FAIL. **Step 4: Implement:** two error constants; `migrateRiders` applied in `useRiders.load()` and changed riders written back with `putRider`; saving a CP typed by the user sets `cpExplicit: true` (RiderScreen CP field; Settings never touches CP). **Step 5: Run** — PASS.
- [ ] **Step 6: Commit** `fix: plain failure wording, migrate legacy riders whose CP shadowed FTP (R3 R6)`.

### Task 6: Class plan model and Seconds parser

**Files:**
- Create: `src/engine/classplan.ts`, `src/engine/classplan.test.ts`, `src/engine/__fixtures__/timers.seconds` (copy of `D:\INDOORCycling\timers.seconds`, byte-identical), `public/classplans/2026-10-timers.seconds` (same bytes), `public/classplans/index.json` = `["2026-10-timers.seconds"]`
- Modify: `vite.config.ts` (workbox `globPatterns` must include `classplans/*`), `src/encoding.test.ts` if it globs `src/**` (the fixture is JSON/ASCII, so it passes; just confirm)

**Interfaces:**
- Produces (all exported from `src/engine/classplan.ts`):
  - `type Zone = 1|2|3|4|5|6|7`
  - `interface ClassInterval { name: string; displayName: string; durationS: number; zone: Zone }`
  - `interface ClassPlan { id: string; title: string; dates: string[]; source: 'seconds' | 'bundled' | 'portal'; intervals: ClassInterval[]; totalS: number }`
  - `parseSecondsFile(json: unknown, source?: ClassPlan['source']): ClassPlan[]` (throws `Error('Not a Seconds file')` when nothing parses)
  - `zoneFor(name: string, color: number | undefined): Zone`
  - `displayNameOf(name: string): string`
  - `datesFromTitle(title: string): string[]`
  - `slug(s: string): string`
  - `isoDay(d: Date): string` (local date `YYYY-MM-DD`)

- [ ] **Step 1: Failing tests** (`classplan.test.ts`, fixture read with `fs.readFileSync(..., 'utf8')`):
  - parses 4 plans; interval counts `[27, 38, 59, 35]`; `totalS` `[3060, 3090, 3020, 3090]`; a second assertion sums `intervals[].duration` straight from the fixture JSON and matches.
  - ids: `'4B224910-38AC-4DE5-A5AC-325E61F65251:session-1-score-65-19-20-october-2026'`; the two items sharing `7BCAB4C9-…` get distinct ids; `slug('Session 11 ( Score 74) 21 - 22 October 2026') === 'session-11-score-74-21-22-october-2026'`.
  - dates: `datesFromTitle('Session 1 Score 65 19-20 October 2026')` → `['2026-10-19','2026-10-20']`; `'… 21 - 22 October 2026'` → 21, 22; `'… 28-29 October 2026'`; `'Ride 3 November 2026'` → `['2026-11-03']`; no date → `[]`.
  - zones: table from spec §4.3 — `zoneFor('Sprint 0:30', 1) === 7`, `('Wind Up Leg Speed 0:20', 1) === 7`, `('Mid-Upper VO2 80+ 2:00', 6) === 5`, `('Mid Threshold 80+ 1:00', 3) === 4`, `('Low Tempo 80+ 1:00', 4) === 3`, `('Endurance 80+ 5:00', 5) === 2`, `('Cool Down 2:00', 0) === 1`, `('Easy Pedal 2:00', 0) === 1`, `('Mystery', 2) === 6`, `('Mystery', undefined) === 2`, keyword beats colour: `('Sprint', 5) === 7`.
  - every fixture interval resolves by keyword (loop; the test prints names that needed the colour and asserts the list is empty).
  - `displayNameOf('Ain 2 1/2 Low Endurance 80+ 1:00') === 'Low Endurance'`, `('2/7 Low Tempo 80+ 1:00') === 'Low Tempo'`, `('Upper VO2 100+ 0:30') === 'Upper VO2'`, `('Cool Down 2:00') === 'Cool Down'`.
  - drops intervals with `indefinite: true` or `duration <= 0` (Review Focus 1) and still returns the plan.
  - accepts a bare item and a bare `{intervals: […]}`; throws on `{}` and on a string.
  - `isoDay(new Date(2026, 9, 19, 23, 30))` → `'2026-10-19'`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** per spec §4.3 (keyword table first, colour table second, default zone 2; display name strips a leading `n/m` or `Ain n n/m` counter, trailing `m:ss`, and `\d+\+` cadence tags, then trims). **Step 4: Run** — PASS.
- [ ] **Step 5:** copy the fixture bytes to `public/classplans/`, write `index.json`, extend `globPatterns`; `npm run build` and confirm `dist/sw.js` precache lists the `.seconds` file.
- [ ] **Step 6: Run** all three commands — green. **Step 7: Commit** `feat(engine): Seconds class-plan parser with zone mapping, dates and bundled fixture`.

### Task 7: ClassRunner — exact-second boundaries, skips keep the plan

**Files:**
- Create: `src/engine/classrun.ts`, `src/engine/classrun.test.ts`

**Interfaces:**
- Produces: `interface ClassStatus { index: number; interval: ClassInterval | null; remainingS: number; pct: number; boundary: boolean; done: boolean }`; `class ClassRunner { constructor(plan: ClassPlan, anchorElapsedS: number); tick(elapsedS: number): ClassStatus; skip(elapsedS: number): ClassStatus; get status(): ClassStatus }`.
- Semantics: class time `c = elapsedS − anchorElapsedS`; boundary `b_i = Σ durations[0..i]`; `index` = current interval; `boundary` is true on the first tick where `c >= b_index` (the interval just ended; the caller closes the lap on this tick); `done` once `c >= totalS` (one final `boundary: true` then `interval: null`); `skip` sets `index + 1` without moving boundaries (the next interval's `remainingS` is `b_{index+1} − c`, possibly shorter); `pct` = elapsed inside the current interval ÷ its remaining window, in [0, 1].

- [ ] **Step 1: Failing tests** with a 3-interval plan `[300, 60, 120]` and anchor 0:
  - tick 1 → index 0, remainingS 299, boundary false; tick 300 → boundary true, index 1, remainingS 60; tick 360 → boundary true, index 2; tick 480 → boundary true, done true, interval null; tick 481 → boundary false, done true.
  - anchor 125 (warm-up closed at 125): tick 125 → index 0 remainingS 300; tick 425 → boundary.
  - skip at c = 100 → index 1, remainingS 260 (= 360 − 100); tick 360 → boundary to index 2; tick 480 → done. Boundaries did not move.
  - late tick (c jumps from 299 to 302 after a stall) → exactly one boundary.
  - pct at c = 150 in interval 0 → 0.5.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(engine): ClassRunner with plan-anchored boundaries`.

### Task 8: Class-plan store and Workouts screen section

**Files:**
- Create: `src/app/classplan-store.ts`, `src/app/classplan-store.test.ts`
- Modify: `src/ui/WorkoutsScreen.tsx`, `src/ui/WorkoutsScreen.test.tsx`

**Interfaces:**
- Produces: `useClassPlans` (zustand persist `ig.classplans`) with `plans: ClassPlan[]; selectedId: string | null; autoPickedOn: string | null; add(plans: ClassPlan[]): { added: number; skipped: number }; remove(id: string): void; select(id: string | null): void; selected(): ClassPlan | null; todays(today?: string): ClassPlan | null; autoPickToday(today?: string): void; loadBundled(): Promise<void>; importFile(text: string): { added: number; skipped: number } (throws on parse error)`. `today` defaults to `isoDay(new Date())`.

- [ ] **Step 1: Failing store tests:** `add` dedupes by id (second add of the same plans → `added 0, skipped 4`); `todays('2026-10-19')` → Session 1, `('2026-10-23')` → null; `autoPickToday('2026-10-21')` selects Session 11 when nothing is selected, replaces a selection dated 19 Oct, does **not** replace a plan dated 21 Oct, and after the rider manually selects another plan a second call the same day leaves it (`autoPickedOn`); bundled plans (`source: 'bundled'`) cannot be removed; `importFile('not json')` throws and leaves `plans` unchanged (Review Focus 5); `loadBundled` with a mocked `fetch` adds the fixture plans.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Failing UI tests** (`WorkoutsScreen.test.tsx`): a heading `Class plans` above `Structured workouts`; each plan row shows title, `fmtDuration(totalS)`, `N intervals`, and a `today` badge for a plan dated today (mock `Date`); clicking a row selects it; a button `Import .seconds` opens a file input accepting `.seconds,.json`; a bad file shows `Not a Seconds file`; a good file shows `Added 4 plans`.
- [ ] **Step 6: Implement** the section with the screen's existing dark list style (`text-[20px]` rows, cyan selected row). Keep every existing Structured-workout test green.
- [ ] **Step 7: Run** all three commands — green. **Step 8: Commit** `feat(workouts): class plans list, today auto-pick, Import .seconds`.

### Task 9: Ride store — class phases, auto-laps, lap names, alerts

**Files:**
- Create: `src/app/alerts.ts`, `src/app/alerts.test.ts`
- Modify: `src/app/ride-store.ts`, `src/engine/ride.ts:56` (`lap(name?)`), `src/engine/laps.ts` (`LapRow.name?: string`, `close(elapsedS, name?)`), `src/data/db.ts:6` (`SessionRecord.planId?: string; planTitle?: string`), `src/app/settings-store.ts` (`classAlerts: 'both' | 'vibrate' | 'beep' | 'off'`, default `'both'`), `src/ui/SettingsScreen.tsx` (item `Class alerts`, summary = current value label)
- Test: `src/app/stores.test.ts` (or a new `src/app/ride-store.class.test.ts`), `src/engine/laps.test.ts`, `src/ui/SettingsScreen.test.tsx`

**Interfaces:**
- Produces on `useRide`: `classPhase: 'none' | 'warmup' | 'class' | 'done'`, `classStatus: ClassStatus | null`, `begin(opts?: { skipCountdown?: boolean; classMode?: 'warmup' | 'class' })`, `startClass(): void`. `lap()` during `classPhase === 'class'` closes the lap with the current interval's name and calls `runner.skip`. `toRecord` adds `planId`/`planTitle` from the plan captured at `begin()`.
- `alerts.ts`: `prepareAudio(): void` (creates/resumes a module `AudioContext` inside a user gesture; no-op when unavailable), `classAlert(mode: Settings['classAlerts']): void` (vibrate 200 ms via `navigator.vibrate` when present; 880 Hz / 150 ms oscillator; never throws).

- [ ] **Step 1: Failing lap tests:** `close(10, 'Warm up')` → row `name === 'Warm up'`; `close(20)` → `name` undefined.
- [ ] **Step 2: Failing store tests** (fake timers, `countdownS: 0`, a 3-interval plan `[300, 60, 120]` selected in `useClassPlans`):
  - `begin({ classMode: 'class' })` → `classPhase 'class'`; after 300 s one lap row with `durationS 300`, `name 'Endurance 80+ 5:00'` (the plan's first name); after 360 s two rows; after 480 s three rows, `classPhase 'done'`, `classStatus.done`; 5 s later `classPhase 'none'` and manual `lap()` still works.
  - `begin({ classMode: 'warmup' })` → `'warmup'`, no auto-lap after 400 s; `startClass()` at 125 s → row 1 `name 'Warm up'`, `durationS 125`; first class boundary at 425 s.
  - `lap()` during class at 100 s → row closes at 100 with the interval name; next boundary still at 360 s (plan kept).
  - `pause()` for 30 s mid-interval → the boundary lands 30 s later in wall time, lap `durationS` unchanged (engine elapsed excludes the pause).
  - `stop()` during class → `classPhase 'none'`, `classStatus null`, no further laps when timers advance (Review Focus 4).
  - `save()` → record has `planId`, `planTitle`.
  - `classAlert` spy called on every boundary with the settings value; `begin` without a selected plan → `classPhase 'none'` and no spy calls.
- [ ] **Step 3: alerts tests:** `classAlert('vibrate')` calls `navigator.vibrate(200)` and creates no oscillator; `'off'` does nothing; with `AudioContext` undefined `'both'` does not throw.
- [ ] **Step 4: Run** — FAIL. **Step 5: Implement** (runner lives in module scope beside `timer`; the 1 Hz callback runs `engine.tick`, then `runner.tick(engine.view.elapsedS)`, then on `boundary` `engine.lap(prevInterval.name)` + `classAlert`, then `set`). **Step 6: Run** — PASS.
- [ ] **Step 7: Settings item** test + implementation: select labelled `Class alerts` with options Vibrate and beep / Vibrate / Beep / Off, summary shows the chosen label.
- [ ] **Step 8: Run** all three commands — green. **Step 9: Commit** `feat(ride): class phases with auto-laps, lap names, class alerts setting`.

### Task 10: Training UI — start dialog, START CLASS, progress bar, done state

**Files:**
- Create: `src/ui/components/ClassBar.tsx`, `src/ui/components/StartDialog.tsx`
- Modify: `src/ui/TrainingScreen.tsx` (button row, dialog, auto-pick on mount, `prepareAudio` on START), `src/ui/components/LapTable.tsx` (tablet-only `Name` column after `Lap`, hidden on phone), `tailwind.config.js` (`zonefill: { z1: '#4f8e81', z2: '#099b1d', z3: '#6f9984', z4: '#a6a600', z5: '#969600', z6: '#a6784a', z7: '#a65858' }`), `src/ui/theme.test.ts`
- Test: `src/ui/TrainingScreen.test.tsx`

**Interfaces:**
- `ClassBar({ status, onTap }: { status: ClassStatus; onTap: () => void })` — `role="button"`, `aria-label="Next interval"`, text line 1 `interval.displayName`, line 2 `fmtDuration(remainingS)` as `m:ss`; root class from a literal map `ZONE_BAR = { 1: 'bg-zone-z1', … }`, fill `div` with `style={{ width: pct*100 + '%' }}` and class from `ZONE_FILL = { 1: 'bg-zonefill-z1', … }`; when `status.done` show `Class done — free ride` on `bg-zone-z1`.
- `StartDialog({ title, onWarmUp, onStartClass, onCancel })` — dark Android dialog (same look as `TermsDialog`), buttons `WARM UP`, `START CLASS`, link `Cancel`, `autoFocus` on START CLASS, `aria-labelledby`.

- [ ] **Step 1: Failing tests** (plan selected via `useClassPlans`, fake timers, `countdownS: 0`):
  - START with a selected plan opens the dialog (text = plan title, buttons `WARM UP` and `START CLASS`); Cancel closes it with `state 'idle'`; START with no plan starts immediately (existing test still passes).
  - WARM UP → recording, button row shows `PAUSE`, `STOP`, `START CLASS` (no `LAP`); clicking `START CLASS` → `classPhase 'class'`, bar with `aria-label="Next interval"` visible, text `Endurance` (displayName) and `4:59` after one tick.
  - bar root has class `bg-zone-z2` for a zone-2 interval, the fill div has `bg-zonefill-z2` and `width: 50%` at half time.
  - PAUSE and STOP have class `col-span-1` and the bar `col-span-2` during class; after `done` + 5 s the row shows `LAP` again.
  - tapping the bar closes a lap (`lapRows` +1).
  - STOP during class → `STOP this session?` → Yes → no bar, `Save or discard` row.
  - on mount with a plan dated today and none selected, `useClassPlans.getState().selectedId` becomes that plan.
  - `theme.test.ts`: the seven `zonefill` tokens equal the hexes above.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (phone: PAUSE/STOP `text-[20px]` in class phases; tablet same split; `prepareAudio()` inside the START click handler; the 5 s "done" hold runs in the store, the UI only renders `classPhase`). **Step 4: Run** — PASS.
- [ ] **Step 5: Computed-style check** at 412 px on `/training` with a plan selected: bar background equals the zone hex, PAUSE width ≈ ¼ of the row. Record values in the task report (no screenshot needed when the pane is hidden).
- [ ] **Step 6: Run** all three commands — green. **Step 7: Commit** `feat(training): Warm Up / Start Class dialog and progress-bar LAP during class`.

### Task 11: End-to-end class ride, README checklist, verification log

**Files:**
- Modify: `src/e2e.test.ts`, `README.md` (phone checklist steps 11–13), `docs/superpowers/plans/2026-10-14-phase1-pwa-parity.md` ("Phone verification log" → add a pointer to this plan)

- [ ] **Step 1: Failing e2e:** fake adapter (power 200, HR 140, cadence 90, no speed) → select the bundled Session 1 → `begin({ classMode: 'warmup' })` → 120 s → `startClass()` → run to plan end (3060 s) → `stop()` → `save()` → stored laps = 28 (warm-up + 27), lap 2 `durationS 300` `name 'Endurance 80+ 5:00'`, session `planTitle` = Session 1 title, distance ≈ (120 + 3060) × 8.93 within 2 %, FIT decodes with `numLaps 28` and session end = 3180 s.
- [ ] **Step 2: Run** — FAIL (until wired). **Step 3: Fix** whatever the e2e exposes (small, in the owning module). **Step 4: Run** — PASS.
- [ ] **Step 5: README** steps: 11 "Workouts → Class plans shows Session 1 with a `today` badge on 19 Oct; Import .seconds adds the owner's file"; 12 "Training → START → WARM UP → START CLASS: bar shows the interval, laps close on their own, phone vibrates/beeps at each change"; 13 "Power-only sensors: Distance ticks (≈ 23 km/h at 80 W)".
- [ ] **Step 6: Run** all three commands — green. **Step 7: Commit** `test(e2e): class ride end to end; docs: phone checklist 11–13`.

## Phone verification log

Device: Nothing Phone (1), Chrome. Run: Monday 19 Oct 2026 (steps 11–13 of the README phone checklist; steps 1–10 are logged in the phase-1 plan). Fill the table in after the run.

| Step | Check | Result | Date | Notes |
|---|---|---|---|---|
| 11 | Workouts → Class plans shows Session 1 with a `today` badge; tap the selected plan to deselect; Import .seconds adds the owner's file | | | |
| 12 | Training → START → WARM UP → START CLASS: bar shows the interval, laps close on their own, phone vibrates/beeps at each change; a double tap on START CLASS or just after a change does not skip | | | |
| 13 | Power-only sensors (no wheel sensor): Distance ticks (about 23 km/h at 80 W) | | | |
