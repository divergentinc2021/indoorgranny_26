# Granny Gear look (app) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the indoor-cycling app to the approved Granny Gear look (mock-up v22) and add the pieces that came with it: username-only login, Training v2 with zone bar / traces / ECG strip / live icons, Zwift Click, Settings additions (locked FTP, bike adjustment, strap code), class-plan detail with RIDE, restyled Sensors / Logs / Class plans.

**Architecture:** Tokens change first and every screen follows; new pure modules (`zwift-click` adapter, `ecg` strip renderer, `avatar`, `icons`) each get their own tests; the ride engine and class runner do not change. The portal and broadcaster are separate repos with their own plans; this plan leaves seams (`Rider.username`, `strapCode`, `bike`, `photoDataUrl`, connector rows disabled) but talks to no server.

**Tech Stack:** Vite 6, React 19, TypeScript, Zustand 5 (persist), Tailwind 3.4, Chart.js 4, Vitest + Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-17-granny-gear-look-design.md` — sections 1–24; **a later section overrides an earlier one where they differ** (§10 overrides §3/§5/§9 palette; §11 overrides §10; §15 removes the splash; §19–§24 refine Training, Settings, plans, race lane). Mock-up of record: `docs/reference/brand/look-v22.html` (open it in a browser; the generator is not in the repo). Portal/broadcaster sections (§15 portal tabs, §18 race view, §20–§24 lane, §21–§22 My profile) are **out of scope here**.

## Global Constraints

- Branch `phase1-pwa-parity`, one commit per task, trailer `Co-Authored-By` as recent commits.
- Chrome 81: no flex `gap` (grid `gap` is fine), `aspect-ratio`, `inset-*`, `:has()`, `backdrop-filter`, `color-mix()`, `inert`-only gating. CSS gradients, `border-radius`, transforms, `@keyframes`, `transform-box` are fine. `build.target: 'chrome81'` stays.
- Tailwind 3.4, literal class strings only; arbitrary font sizes never combined with a conflicting base in one class list (ascending-order trap).
- System Roboto stack; no web fonts; wordmark = `font-weight:900; font-style:italic; letter-spacing:-1px; text-transform:lowercase`.
- Tokens (§10/§11/§17/§19): `gg.dark #111111`, `gg.panel #1F1F1F`, `gg.panel2 #262626`, `gg.yellow #FFF200`, `gg.cyan #29ABE2`, `gg.cyanDark #1E8BBB`, `gg.cyanLight #5BC4ED`, `gg.red #ED1C24`, `gg.green #28A745`, `gg.btn #3A3A3A`, `gg.light #F8F9FA`, `gg.muted #9e9e9e`; `hr.z1 = #29ABE2`, other `hr.*`, `zone.*`, `zonefill.*` unchanged; gradient `linear-gradient(135deg,#FFF200,#29ABE2)` for free ride.
- Per-screen accent: Home, Login, Sensors, Settings, Class plans, Logs = yellow; Training class = blue; Training free ride = gradient.
- Icons: inline SVG, 24-unit viewBox, stroke 2, round caps/joins, `currentColor`, white strokes; `aria-hidden`.
- No splash (§15). No Import .seconds visible (parked; `?import=1` reveals it). No link from the app into the platform (§22). FTP read-only in the app (§12).
- Vendor behaviour unchanged: formulas, zones, lap maths, FIT, class runner.
- Every task: `npm test`, `npx tsc --noEmit`, `npm run build` green; `src/encoding.test.ts` green (explicit UTF-8 when scripting; never `python3` on this box).

## Review Focus

1. A username typed with spaces or capitals (`" LaurentDLS "`) must still sign in as `laurentdls`, and a username that is not a known rider must show "Not a Granny Gear rider yet — ask the studio" (Task 3).
2. No heart rate (sensor absent or 0 bpm) → the ECG strip shows a flat line, the needle does not pulse, the legend shows `--` (Task 6).
3. Zwift Click `−` arrives only as release events on real hardware and `+` can double-fire; a single tap must produce exactly one action (Task 8).
4. The Training stack on a 412×800 CSS-px viewport must not clip the bottom tiles: the page scrolls as a whole (Task 4).
5. A rider without a photo and a one-letter username (`"x"`) gets avatar `X` (first and last letter collapse), never an empty disc (Task 2).

---

### Task 1: Tokens, Shell tones, button press animation, version

**Files:**
- Modify: `tailwind.config.js`, `src/index.css`, `src/ui/Shell.tsx`, `src/ui/theme.ts`, `src/ui/theme.test.ts`, `src/ui/Shell.test.tsx`, `vite.config.ts` (`define: { __APP_VERSION__: JSON.stringify(pkg.version) }` + `src/vite-env.d.ts` declaration), `package.json` (`"version": "0.2.0"`)
- Create: `src/ui/pressable.ts` (class constant for press animation)

**Interfaces:**
- Produces: tokens `gg.{dark,panel,panel2,yellow,cyan,cyanDark,cyanLight,red,green,btn,light,muted}` (old `gg.*` names removed); `Shell` `tone: 'dark' | 'cyan'` (default `'dark'`) and a new prop `accent: 'yellow' | 'blue' | 'gradient'` (default `'yellow'`) that sets the bar underline and the back-chevron colour; `PRESS = 'transition-transform duration-100 active:scale-[0.94]'` exported from `src/ui/pressable.ts` plus CSS `@keyframes gg-ripple` in `index.css` applied by the class `ripple` (an `::after` white circle scaling from the centre, 600 ms); `__APP_VERSION__` global string.

- [ ] **Step 1: Failing `theme.test.ts`** — assert the exact token table above, `hr.z1 === gg.cyan`, zone/zonefill unchanged, and that none of `bg|strip|on|lap|paper|zonebg|pink|text|bar|pref|cat|summary|dlg` exist under `gg`.
- [ ] **Step 2: Run** — FAIL. **Step 3:** rewrite the `gg` block; `body { @apply bg-gg-dark text-white font-sans }`; add `.ripple` + keyframes to `index.css`; `theme.ts` → `THEME.on = gg.green`, `THEME.strip = gg.cyan`.
- [ ] **Step 4: Failing `Shell.test.tsx`** — `tone="dark"` root has `bg-gg-dark`; `tone="cyan"` has `bg-gg-cyan`; `accent="blue"` bar has `border-gg-cyan`, `accent="gradient"` has class `bar-gradient`; the phone bar is `h-[52px]` with gradient `bg-gradient-to-br from-[#2B2B2B] to-[#141414]` and a 3 px bottom border in the accent; `tone` values `white|navy|black|pref` no longer type-check (remove their usages across screens in this task with the minimum class edits so tsc passes; screens are restyled in their own tasks).
- [ ] **Step 5: Implement.** **Step 6:** grep guard: `grep -rn "gg-bg\|gg-strip\|gg-on\|gg-lap\|gg-pref\|gg-summary\|gg-dlg\|gg-bar\|gg-cat\|gg-zonebg\|gg-paper\|gg-pink\|gg-text\|gg-btn text-black" src` → every hit replaced with the nearest new token (mechanical; the screen-specific looks come in later tasks). Run the three gates.
- [ ] **Step 7: Commit** `feat(theme): Granny Gear tokens, Shell tones and accents, press ripple, app version`.

### Task 2: Icons, avatar, Home

**Files:**
- Create: `src/ui/icons.tsx`, `src/ui/icons.test.tsx`, `src/ui/avatar.ts`, `src/ui/avatar.test.ts`, `src/ui/components/Avatar.tsx`
- Modify: `src/ui/Home.tsx`, `src/ui/Home.test.tsx`, `public/icons/*` (emblem set), `vite.config.ts` manifest, `index.html`

**Interfaces:**
- `icons.tsx` exports components `IconBike, IconCalendar, IconHistory, IconBluetooth, IconSliders, IconSpeed, IconBolt, IconHeart, IconPedal, IconUser, IconWheel, IconRuler, IconScale, IconTimer, IconWave, IconBell, IconDownload, IconCheck, IconSearch, IconLock, IconClick, IconMail` each `({ className?: string }) => JSX.Element`, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">`; `IconPedal` = axle circle r3 + crank `M12 9V3M12 15v6` + pedals `M8.5 3h7M8.5 21h7` (spins about centre); `IconSpeed` first `<path>` is the needle `M12 14l3.5-5`.
- `avatar.ts`: `initials(username: string): string` → first + last character of the trimmed username, upper-cased; one character → that character once; empty → `'?'`.
- `Avatar({ username, photoDataUrl?, size = 34 })` → `<img>` when `photoDataUrl`, else a disc with `bg-gradient-to-br from-gg-yellow to-gg-cyan text-gg-dark font-black` and `initials(username)`; `role="img" aria-label={username}`.
- Home: tiles `TRAINING / CLASS PLANS / ACTIVITY LOGS / SENSORS / SETTINGS` in that order as `gg.panel` cards `rounded-[12px]`, 6 px left border `border-l-[6px]` in `gg.cyan / gg.yellow / gg.red / gg.cyanLight / white`, white icon + label + `›`; bar: emblem on a white circle + title **"Indoor Cycling"** + signed-in username right (from Task 3's store; render `''` until then); footer band `bg-gg-yellow text-gg-dark` "Ride in the Granny Gear" + `v{__APP_VERSION__}`; `sr-only` h1 "Granny Gear". Terms gate, Review-terms and Choose-rider links unchanged (links styled white).
- Icons/manifest: `public/icons/icon-192.png`, `icon-512.png` = emblem on a **white** square; `icon-maskable-512.png` = emblem on `#29ABE2` with 20 % padding, `purpose: 'maskable'`; `apple-touch-icon.png` 180 white square; `favicon-32.png`, `favicon-16.png`; manifest `name "Granny Gear Indoor Cycling"`, `short_name "Granny Gear"`, `theme_color "#1E8BBB"`, `background_color "#111111"`; `<meta name="theme-color" content="#1E8BBB">`. Source emblem `docs/reference/brand/gg-emblem-512.png`; produce the PNGs with any tool (Node canvas is not installed; a tiny `sharp`-free script using `pngjs` is acceptable as a devDependency, or pre-rendered files committed).

- [ ] **Step 1: Failing tests** — `initials('laurentdls') === 'LS'`, `initials('x') === 'X'`, `initials('  Mark ') === 'MK'`, `initials('') === '?'`; `Avatar` renders `img` with the photo or a disc with `LS`; every icon renders an `svg[aria-hidden]` with `viewBox="0 0 24 24"`; Home tile links keep their accessible names, carry `border-l-[6px]` and the colour classes above, bar title text `Indoor Cycling`, footer contains `Ride in the Granny Gear` and `v0.2.0`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green; `npm run build` precaches the new icon files.
- [ ] **Step 5: Commit** `feat(ui): icon set, avatar initials, Home in the Granny Gear look, emblem icons and manifest`.

### Task 3: Login by username, straight to Training, hidden admin form

**Files:**
- Modify: `src/data/db.ts` (`Rider` gains `username: string; photoDataUrl?: string; strapCode?: string; bike?: { saddleHeight?: number; saddleForeAft?: number; handlebarHeight?: number; handlebarDepth?: number }`; DB version 2 with an upgrade that sets `username = slug(name)` for existing riders — `slug` = lowercase, non-alphanumerics stripped), `src/data/riders.ts` (`newRider` requires `username`, `email` optional; `findByUsername(riders, input): Rider | undefined` normalising trim + lowercase), `src/app/rider-store.ts` (`signIn(username): 'ok' | 'unknown'`, `signOut()`, `currentUsername()`), `src/ui/RiderScreen.tsx` (becomes the Login screen), `src/ui/RiderScreen.test.tsx`, `src/App.tsx` (route `/rider` → Login; `/` redirects to `/rider` when no current rider), `src/ui/Home.tsx` (username in the bar), `src/ui/TrainingScreen.tsx` (SIGN OUT → `signOut()` then `/rider`)
- Test: `src/app/stores.test.ts`, `src/data/data.test.ts`

**Interfaces:**
- Login screen (`/rider`): full-screen studio photo background (`public/img/login-bg.jpg` = `docs/reference/brand/gen/studio-bg-300pro.jpg` downscaled to ≤ 1024 px wide, overlay 25 % → 5 % → 45 %), yellow/red top stripe, emblem 90 px, wordmark "grannygear", "INDOOR CYCLING" in yellow, card with one `Username` field (`autocapitalize="none"`, `autocomplete="username"`, `enterkeyhint="go"`, inside a `<form>`), yellow `SIGN IN`, hint "Riders are added by the studio.", tagline "Ride in the Granny Gear" + version at the bottom. Submit → `signIn` → `'ok'` navigates to `/training`; `'unknown'` shows `role="alert"` "Not a Granny Gear rider yet — ask the studio".
- Hidden admin form: with `?admin=1` in the URL the previous add/edit/delete rider form is rendered below the card (fields now: username, name, email, weight, FTP, CP, W′, HR max) — this is the only way to create riders until the portal sync exists; not linked anywhere.
- No rider list, no recent riders, no Add rider otherwise.

- [ ] **Step 1: Failing tests:** DB v2 upgrade gives an old rider `username === slug(name)`; `findByUsername(riders, ' LaurentDLS ')` finds `laurentdls`; `signIn('nobody')` → `'unknown'` and current stays null; Login renders exactly one text field, submits with Enter and with the button, navigates to `/training` on success, shows the alert on failure; no `Add rider` button without `?admin=1`; with `?admin=1` the form appears; `/` with no current rider redirects to `/rider`; SIGN OUT clears the current rider and lands on `/rider`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(login): username-only sign-in straight to Training, rider username/photo/strap/bike fields, hidden admin form`.

### Task 4: Training v2 layout, accents, Click badge slot, lap-bar effects

**Files:**
- Modify: `src/ui/TrainingScreen.tsx`, `src/ui/TrainingScreen.test.tsx`, `src/ui/components/Tile.tsx` (chip variant), `src/ui/components/LapTable.tsx` (`limit?: number`), `src/ui/components/ClassBar.tsx`, `src/ui/Shell.tsx` (`scroll` prop: Training uses `overflow-y-auto` instead of `overflow-hidden`), `src/index.css` (`@keyframes gg-stripes`, `gg-glow`, `gg-flash`)

**Interfaces:**
- Phone stack top→bottom: bar (Avatar + username + SIGN OUT) → elapsed strip (`accent` background, white 24 px bold, `relative`, right end reserved 96 px for the Click badge slot `<div data-slot="click">`) → chips `Speed | Power | HR | Cadence` (`Tile size="chip"`: caption 11 px bold with a 14 px icon slot before it, value 21 px bold on the accent, `rounded-[8px]`) → `LapTable fill={false} limit={3}` (now + last 3, `flex-none`, white body, `rounded-[8px]`) → button row (`PAUSE` `gg.btn` white text, `STOP` `gg.red`, `LAP` accent; class phases keep the ¼ ¼ ½ split with START CLASS in `gg.yellow`) → charts slot `<div data-slot="charts">` (Task 5/6 fill it; `flex-1`) → bottom tiles (`Distance (km) | Wbal (%exp) | %HR max | KJ`, accent strips, %HR keeps the HR band tint).
- Accent: `classPhase !== 'none'` → `'blue'`; else `'gradient'` (free ride). Shell gets `accent` accordingly; tablet keeps its layout with the palette and Speed as the first main chip (drop Speed from the tablet third row).
- ClassBar: fill gets `bg-[length:23px_100%]` moving stripes (`gg-stripes` 0.8 s linear infinite on `background-position`) and the root a `gg-glow` 2.4 s pulse in the zone colour (box-shadow); on `status.boundary` add class `flash` for 600 ms (`gg-flash` brightness pulse). All buttons use `PRESS` + `ripple`.
- Page scrolls as a whole on phone (`Shell scroll`); nothing pinned.

- [ ] **Step 1: Failing tests:** chip order and captions `Speed, Power, HR, Cadence`; Speed chip shows `fmtSpeed(...).split(' ')[0]` and caption `Speed (est.)` when `speedSource === 'virtual'`; LapTable with `limit={3}` renders now + 3 rows when 5 laps exist; free ride → elapsed strip has class `bar-gradient`/accent gradient, class → `bg-gg-cyan`; buttons carry `active:scale-[0.94]` and `ripple`; Training root has `overflow-y-auto`; the bottom tiles exist in the DOM at a 412×800 jsdom window; a `[data-slot="click"]` and `[data-slot="charts"]` exist; ClassBar has `gg-stripes` on the fill and `flash` for 600 ms after a boundary (fake timers).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green. **Step 5: Preview check** at 412×800: no clipping, stack scrolls; record computed accent colours in the task report.
- [ ] **Step 6: Commit** `feat(training): v2 phone stack, blue/gradient accents, chip speed, now+3 laps, lap-bar effects`.

### Task 5: Power zone bar + power/cadence trace

**Files:**
- Create: `src/ui/components/PowerPanel.tsx`, `src/ui/components/PowerPanel.test.tsx`
- Modify: `src/ui/components/RollingChart.tsx` (`Series.dash?: boolean`, `fill?: boolean` gradient under the line, `tension 0.35`, no axes/grid, `pointRadius 0`, live dot at the last point), `src/ui/TrainingScreen.tsx` (mount in the charts slot)

**Interfaces:**
- `PowerPanel({ watts, cadence, ftpW, zones: Zone[], powerHist: number[], cadHist: number[] })` renders: header `● Power` (yellow) `● Cadence` (`#5CD67A`) `Z{n} {name}` and `{watts} W · {cadence} rpm`; a 7-segment bar with widths proportional to `[55, 20, 15, 15, 15, 30, 30]` (% FTP spans 0–55–75–90–105–120–150–180) coloured `zone.z1..z7`, a 4 px white marker at `clamp(watts / (1.8·ftpW), 0, 1)` with `transition: left 300ms`, labels `Z1…Z7` under the segments; then a `RollingChart` 34 px high with power (yellow, fill) and cadence (`#5CD67A`, no fill) and the live dots.
- Zone name from `zoneIndex(zones, watts)` and `zones[i].name`.

- [ ] **Step 1: Failing tests:** marker left = `47%` at 194 W / 227 FTP (`194/(1.8·227)`); header reads `Z3 Tempo` at 194 W with FTP 227; 0 W → marker `0%`, `Z1 Active recovery`; 500 W → marker `100%`; seven segments with the given flex values; RollingChart receives two series with the right colours (spy on the component props).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(training): 7-zone power bar with live marker and power/cadence trace`.

### Task 6: ECG heart-rate strip

**Files:**
- Create: `src/ui/components/EcgStrip.tsx`, `src/ui/components/EcgStrip.test.tsx`, `src/ui/ecg.ts` (pure trace generator), `src/ui/ecg.test.ts`
- Modify: `src/ui/TrainingScreen.tsx` (below PowerPanel in the charts slot)

**Interfaces:**
- `ecg.ts`: `beatPath(bpm: number, pxPerSecond: number): string` → an SVG path for one PQRST beat scaled so one beat spans `60/bpm · pxPerSecond` px (shape: small P bump, sharp R spike up, S dip, T bump); `samplesToPath(hrHist: number[], pxPerSecond: number, height: number): string` → the rolling trace from the last N seconds where each second contributes one beat-pattern repetition count = bpm/60 (so a higher HR gives denser spikes), flat line for 0.
- `EcgStrip({ hr, pctHrMax, hrHist, paused })`: white panel `rounded-[10px]` with the graph-paper grid (`background-image` two repeating gradients, 7 px minor / 35 px major, `#e3e9ee`/`#c9d3da`), the grid `background-position` animating left at `pxPerSecond` (CSS keyframes, `animation-play-state: paused` when `paused` or `prefers-reduced-motion`), the red trace `<svg preserveAspectRatio="none">` translated left in step with the grid, a red needle dot at the right edge whose vertical offset follows the last sample (`transition 120ms`), legend `● Heart rate` and `{hr} bpm · {pctHrMax} %` or `-- bpm` when `hr === 0`.

- [ ] **Step 1: Failing tests:** `beatPath(60, 20)` spans 20 px, `beatPath(120, 20)` spans 10 px; `samplesToPath([0,0,0], 20, 56)` is a flat line at mid height; `samplesToPath([150,150], …)` contains spike segments; EcgStrip with `hr=0` shows `-- bpm` and no needle pulse class; with `paused` the grid has `animation-play-state: paused` (inline style); legend shows `158 bpm · 86 %`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(training): rolling ECG heart-rate strip`.

### Task 7: Live chip icons

**Files:**
- Modify: `src/ui/components/Tile.tsx` (chip `icon?: ReactNode`), `src/ui/TrainingScreen.tsx`, `src/index.css` (`@keyframes gg-spin, gg-sweep, gg-flashbolt, gg-beat`), `src/ui/TrainingScreen.test.tsx`

**Interfaces:**
- Cadence: `IconPedal` with `style={{ animation: cad > 0 ? \`gg-spin ${60/cad}s linear infinite\` : 'none' }}`, `transform-box: view-box; transform-origin: 50% 50%`.
- Speed: `IconSpeed` needle path rotated by `-40 + 80 · clamp(speedKmh/60, 0, 1)` deg via inline `style` on the path (`transform-box: view-box; transform-origin: 12px 14px; transition: transform 300ms`).
- Power: `IconBolt` `gg-flashbolt 1s steps(1) infinite` while `watts > 0`, steady otherwise.
- HR: `IconHeart` `gg-beat ${60/hr}s ease-in-out infinite` while `hr > 0`, origin 50 % 50 %.
- All animations `none` when `ride.state !== 'recording'` or `prefers-reduced-motion`.

- [ ] **Step 1: Failing tests:** at 88 rpm the pedal icon style contains `0.68`; at 0 rpm `none`; at 158 bpm the heart style contains `0.38`; speed needle transform at 30 km/h is `rotate(0deg)` (midpoint), at 0 `rotate(-40deg)`; paused ride → all `none`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(training): live chip icons (spin, needle, flash, beat)`.

### Task 8: Zwift Click adapter

**Files:**
- Create: `src/sensors/ble/zwift-click.ts`, `src/sensors/ble/zwift-click.test.ts`, `src/app/click-store.ts`, `src/app/click-store.test.ts`
- Modify: `src/sensors/types.ts` (`Slot` gains `'click'`; `SLOT_KINDS.click = []`; `SLOT_PRIORITY` unchanged for arbitration — the click slot never produces `SensorReading`s), `src/app/settings-store.ts` (`devices.click`), `src/app/ride-store.ts` (consume button events), `src/sensors/ble/uuids.ts`

**Interfaces:**
- `uuids.ts` (add to the existing `UUIDS` object): `ZWIFT_SERVICE = '00000001-19ca-4651-86e5-fa29dcdd09d1'`, `ZWIFT_SERVICE_NEW = '0000fc82-0000-1000-8000-00805f9b34fb'`, `ZWIFT_MEASUREMENT = '00000002-…'`, `ZWIFT_CONTROL = '00000003-…'`, `ZWIFT_RESPONSE = '00000004-…'`, `BATTERY_SERVICE = 0x180f`, `BATTERY_LEVEL = 0x2a19`.
- `parseClickFrame(dv: DataView, nowMs: number, state: ClickParseState): ClickEvent | null` (pure): frame `0x37` len ≥ 5 → `data[2]` 0x00 pressed / 0x01 released, `data[4]` 0x01 `+` / 0x00 `−`; emits `{ button: 'plus' }` on a `+` **press** (debounce 200 ms), `{ button: 'minus' }` on a `−` **release** (gap 500 ms); frame `0x19` len 3 → null (keepalive); frame `0x23` + 32-bit LE bitmap → fallback `up = !(bitmap & 1)`, `down = !(bitmap & 2)` edges; anything else → null. `ClickParseState` holds last times.
- `ZwiftClickAdapter` implements `SensorSource` for slot `'click'`: `pair()` filters `namePrefix: 'Zwift Click'` and `'CLICK'`, `optionalServices` both Zwift services + battery; `connect()` subscribes measurement + response, then writes ASCII `RideOn` to control with **`writeValueWithoutResponse`**; exposes `onButton(cb: (b: 'plus' | 'minus') => void)`, `battery: number | null` (reads 0x2A19 once on connect), states via `onState` like the BLE adapter; reconnect via `getDevices` with the same chooser fallback.
- `click-store.ts` (`useClick`): wires `onButton` → `useRide`: `plus` → `classPhase === 'warmup' ? startClass() : state === 'idle' && selectedPlan ? openStartDialog() : state === 'idle' ? begin() : lap()`; `minus` → `state === 'recording' ? pause() : state === 'paused' ? resume() : noop`; a `minus` **long release** (> 1.5 s held, from press→release timing when both arrive) while paused → `requestStop()` (a store flag the Training screen turns into the STOP dialog); exposes `lastPress: { button, at } | null` for the badge flash and `battery`.
- ride-store gains `openStartDialog()` / `startDialogOpen` and `requestStop()` / `stopRequested` flags that TrainingScreen already renders (Task 9 wires the UI).

- [ ] **Step 1: Failing parser tests** with the byte sequences from §16: `37 08 00 10 01` → plus; a second identical frame 100 ms later → null (debounce); `37 08 01 10 00` → minus; another 300 ms later → null, 600 ms later → minus; `19 10 5d` → null; `23 01 00 00 00` then `23 00 00 00 00` → plus edge (bit 0 cleared); garbage → null.
- [ ] **Step 2: Failing adapter tests** with a fake `Bluetooth` (same style as `adapter.test.ts`): connect order is measurement notify → response notify → control `writeValueWithoutResponse('RideOn')` (assert `writeValue` was NOT called); battery read populates `battery`; a measurement notification routes through the parser to `onButton`.
- [ ] **Step 3: Failing store tests:** mapping table above incl. `plus` during warm-up → `startClass`, `plus` while recording → `lap` (tap guard still applies), `minus` toggles pause/resume, long `minus` while paused → `stopRequested`.
- [ ] **Step 4: Run** — FAIL. **Step 5: Implement.** **Step 6: Run** — PASS; gates green.
- [ ] **Step 7: Commit** `feat(sensors): Zwift Click adapter (RideOn handshake, 0x37 frames) mapped to lap/start/pause`.

### Task 9: Sensors screen restyle, animated icons, Click row and Training badge

**Files:**
- Modify: `src/ui/SensorsScreen.tsx`, `src/ui/SensorsScreen.test.tsx`, `src/ui/TrainingScreen.tsx`, `src/ui/TrainingScreen.test.tsx`, `src/index.css` (`@keyframes gg-pulse`, `gg-btpulse`)
- Create: `src/ui/components/ClickBadge.tsx`

**Interfaces:**
- Sensors: page `gg.dark`; slot rows as `gg.panel` cards: 34 px icon tile (`IconHeart / IconBolt / IconPedal / IconWheel / IconClick`), name + device/value line, status pill (`Connected` `gg.green`, `Pair` `gg.yellow` dark text, `Offline` `#555`, `Connecting…` with a pulsing ring); connected icons animate (heart beat, bolt flash, pedal spin at a fixed 0.7 s, wheel spin, Click `gg-pulse` ring); connecting rows `gg-pulse` the icon; offline rows `opacity-45`; ⋮ menu `gg.panel2` with "SENSOR CONFIGURATION" and five rows incl. `Pair Zwift Click`; bottom `Reconnect sensors` yellow bar with `IconBluetooth` pulsing while any slot is connecting. Existing aria-labels/tests kept (`Pair Heart rate`, `Menu: pair …`, `Reconnect all`).
- Training: `ClickBadge` in the elapsed strip's right slot when the click slot is paired: dark pill `IconClick` + `+LAP −PAUSE` (meanings per state: `+START CLASS` in warm-up, `−RESUME` while paused, `+START` idle); on `useClick.lastPress` change add class `pressed` for 500 ms (`gg-pulse` yellow ring). The Start dialog opens on `startDialogOpen`; `stopRequested` opens the STOP confirm.

- [ ] **Step 1: Failing tests:** Sensors renders a `Zwift Click` row with battery text when paired; menu has `Pair Zwift Click`; a connected HR row's icon has `gg-beat`; an offline row has `opacity-45`; Training shows `ClickBadge` only when `devices.click` exists; badge text `+START CLASS` during warm-up and `−RESUME` while paused; after `useClick.setState({ lastPress: {button:'plus', at: Date.now()} })` the badge has `pressed` then loses it after 500 ms; `stopRequested` → STOP dialog visible.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(sensors): Granny Gear sensors screen with live icons, Zwift Click row, Training click badge`.

### Task 10: Settings — profile, bike adjustment, strap code, connectors, inline editors

**Files:**
- Modify: `src/ui/SettingsScreen.tsx`, `src/ui/SettingsScreen.test.tsx`, `src/app/rider-store.ts` (`updateSelf(patch: Pick<Rider,'weightKg'|'strapCode'|'bike'|'photoDataUrl'>)`), `src/app/settings-store.ts` (remove nothing; `classAlerts` stays)
- Create: `src/ui/components/Segmented.tsx`, `src/ui/components/NumberEditor.tsx`, `public/img/bike300pro.jpg` (= `docs/reference/brand/gen/bike300pro-rear.jpg` downscaled ≤ 900 px wide), `src/ui/components/BikeAdjust.tsx`, `src/ui/components/BikeAdjust.test.tsx`

**Interfaces:**
- Sections in order: **Rider profile** (avatar row: Avatar + username + text "Photo, username and connections: sign in at indoorgranny-portal.pages.dev with your e-mail. Not linked from this tablet." — no link; `Weight` editable via `NumberEditor` (kg or lb per unit); `FTP` locked row with `IconLock` and summary `"{ftp} W · set by the studio"`; `Strava` row "Not connected · rides upload automatically once linked" with a disabled `Connect` pill; `Garmin Connect` row "Not linked · available once Garmin approves the studio app" pill `Soon`) → **Bike adjustment** (toggle `Show bike`, persisted in settings `showBike: boolean` default true; `BikeAdjust`: the image with four numbered callouts at `(65.8%,30.3%) (71.6%,19%) (28%,29.3%) (26%,20%)`, rows `1 Saddle height · 2 Saddle fore / aft` yellow, `3 Handlebar height · 4 Handlebar depth` blue, each tap opens a `NumberEditor` (integer 0–30, blank allowed, Save) writing `rider.bike`) → **Heart rate strap** (`strapCode` row, editor: full-width input, then `Discover` + `Save` on the next line; Discover runs the HR slot's Bluetooth chooser via `useSensors.pair('hr')` and fills the code with the chosen device name/id without pairing-state side effects) → **App** (Units segmented `Metric | Imperial`, Countdown segmented `None | 5 s | 1 h | 2 h | 3 h`, Smoothing select, Class alerts segmented `Both | Vibrate | Beep | Off`, Wheel circumference `NumberEditor` mm) → footer `v{__APP_VERSION__} · Ride in the Granny Gear`.
- `Segmented({ value, options: [value,label][], onChange, ariaLabel })` — `role="radiogroup"`, buttons `role="radio" aria-checked`, selected `bg-gg-yellow text-gg-dark`.
- `NumberEditor({ label, value, unit, min, max, step, onSave })` — number input + `Save` with `IconCheck`.
- Existing Settings tests: keep the `<label>`/aria names for selects and the wheel input, or update the queries and list each change.

- [ ] **Step 1: Failing tests:** FTP row has no input and shows `set by the studio`; Weight editor saves `84.5` to the current rider; bike callouts render four numbered badges and four rows with the exact labels; saving `Saddle height = 14` persists `rider.bike.saddleHeight === 14`; strap editor input is full width (`w-full`) and `Discover` fills `Polar H10 7A3F21`-style text from a mocked chooser; Strava `Connect` is `disabled`; Garmin pill reads `Soon`; `Segmented` has `radiogroup` semantics and `Class alerts` switches the setting; no link element whose href contains `portal`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(settings): rider profile with locked FTP, bike adjustment, strap code, connector rows, inline editors`.

### Task 11: Class plans screen and plan detail with RIDE

**Files:**
- Modify: `src/ui/WorkoutsScreen.tsx` (rename export to `ClassPlansScreen`, file `src/ui/ClassPlansScreen.tsx`), tests likewise, `src/App.tsx` (`/workouts` kept + `/workouts/:id`), `src/app/classplan-store.ts` (`zoneStrip(plan): { zone: Zone; weight: number }[]`)
- Create: `src/ui/ClassPlanDetail.tsx`, `src/ui/ClassPlanDetail.test.tsx`

**Interfaces:**
- List: `gg.panel` cards with `IconCalendar`, title, `fmtDuration(totalS) · N intervals`, yellow `today` pill, a 6 px zone strip (segments `flex: durationS` in `zone.z*`), selected card = yellow left border + `IconCheck`; tap selects, tap again deselects (existing), card's `›` opens `/workouts/:id`; `Import .seconds` only with `?import=1`; hint "Plans come from the studio. Tap the selected plan again for a free ride."
- Detail: bar title = plan title; header line `dates · total · N intervals`; interval rows `index · zone swatch · displayName (+ small counter) · m:ss`; zone strip; bottom **RIDE** with `WARM UP` (`gg.btn`) and `START CLASS` (`gg.yellow`): both select the plan and navigate to `/training` with state `{ classMode: 'warmup' | 'class' }`; Training reads that state on mount and calls `begin({ classMode })` once (countdown honoured).

- [ ] **Step 1: Failing tests:** card renders the zone strip with 27 segments for Session 1; `Import .seconds` absent by default, present with `?import=1`; detail shows 27 rows, first `Endurance` `5:00` swatch `bg-zone-z2`; `START CLASS` → `useClassPlans.selectedId` = plan and navigation to `/training` with `state.classMode === 'class'`; Training mount with that state calls `begin` with `classMode 'class'` (spy) exactly once.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(plans): Granny Gear class-plan cards with zone strips, plan detail with RIDE (Warm Up / Start Class)`.

### Task 12: Logs, Session detail, dialogs in the new look

**Files:**
- Modify: `src/ui/LogsScreen.tsx`, `src/ui/LogsScreen.test.tsx`, `src/ui/SessionDetail.tsx`, `src/ui/SessionDetail.test.tsx`, `src/ui/TermsDialog.tsx`, `src/ui/components/StartDialog.tsx`, `src/ui/components/CountdownModal.tsx`, `src/ui/TrainingScreen.tsx` (Stop/Save dialog), `README.md`

**Interfaces:**
- Logs: ride cards (`gg.panel`): `IconBike` tile, `date · time`, `username · plan title | free ride`, four stats `time / km / kcal / avg W`, `Delete` red text, `Download FIT` yellow pill with `IconDownload`; Actions toggle removed (Upload stays hidden until the portal). Session detail: same tokens; charts use yellow/green/red lines.
- Dialogs (Terms, Start, Stop/Save, Countdown): title bar `gg.cyanDark`, body `gg.panel`, primary `gg.yellow` dark text, secondary `gg.btn`, Cancel `gg.muted`, `rounded-[8px]`; Countdown full-screen `gg.dark` with the number in yellow.
- README: phone checklist steps 14–18 (sign in by username, Training v2 stack, Zwift Click pairing and buttons, Settings bike/strap, plan detail RIDE) and the `?admin=1` / `?import=1` notes.

- [ ] **Step 1: Failing tests:** Logs card shows the four stats and the yellow `Download FIT` button, no `Actions` button; dialogs' primary buttons carry `bg-gg-yellow`; Terms Accept still `autoFocus`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS; gates green.
- [ ] **Step 5: Commit** `feat(ui): logs cards, session detail and dialogs in the Granny Gear look; README checklist 14–18`.

### Task 13: Sweep, grep guards, preview verification

**Files:**
- Modify: whatever the sweep finds; `docs/superpowers/plans/2026-10-17-granny-gear-look.md` (append "Phone verification log" table, steps 14–18 blank)

- [ ] **Step 1:** grep guards (all must return nothing): old tokens (Task 1 list), `Splash`, `improve your performance`, `Import JSON`, `href=.*portal`, `text-\[28px\].*text-\[20px\]` in one class string, `gap-[0-9]` inside a `flex` class string.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npm run build`; `dist/sw.js` precaches the new icons, `login-bg.jpg`, `bike300pro.jpg`.
- [ ] **Step 3:** preview at 412×800: Login → sign in `laurentdls` (admin-created) → Training free ride (gradient) → select Session 1 → RIDE → START CLASS (blue, bar, stripes) → Sensors (rows, menu) → Settings (bike image + callouts, strap editor one line) → Class plans → Logs. Save screenshots to the task report. Fix small visual defects inline (no new features).
- [ ] **Step 4: Commit** `chore: look-swap sweep, guards, verification log`.
