# Granny Gear look and Training layout v2 — design

Date: 2026-10-17. Branch: continues `phase1-pwa-parity`. Supersedes the visual half of the phase-1 "parity port" rule: behaviour, formulas, tiles and lap maths stay vendor-identical; the look becomes Granny Gear's. Approved direction: the mock-up at `docs/reference/brand/splash-mockup.html` (v2), which Laurent accepted on 2026-10-17 with four changes that are folded in below.

## 1. Intent

Riders and the owner should recognise the studio, not the old vendor app. The Granny Gear Workshop App (GGWA) already carries the brand (GG emblem, cyan / yellow / red on dark), and the 2023 Unity app's splash set the composition (brand-blue field, emblem centred, lots of air). The phone Training screen also gains the controls Laurent asked for: a Speed chip, the lap table trimmed to what matters mid-ride, the buttons where the thumb is, and the charts back on the phone.

## 2. Goals / non-goals / anti-goals

**Goals**
- Splash on launch with the GG emblem; GG palette on every screen; emblem as the PWA icon and in the app bar.
- Training (phone) v2 layout: elapsed → Speed | Power | HR | Cadence chips → lap table (now + last 3) → PAUSE / STOP / LAP (or the class bar) → two charts → Distance | Wbal | %HR max | KJ.
- Tablet gets the same palette; its layout keeps all laps and all tiles.

**Non-goals**
- No change to any number, formula, zone boundary, lap rule, FIT content or class-mode behaviour.
- No new screens. No animation beyond the splash fade.

**Anti-goals**
- Lap-row zone colours and the %HR max band colours must NOT change (riders and the instructor read them).
- Nothing that breaks Chrome 81 (Tab 3 fleet): no flex `gap`, `aspect-ratio`, `inset-*`, `:has()`, no `backdrop-filter`, no `color-mix()`.
- No web fonts; no font downloads.

## 3. Palette and tokens (Tailwind `gg.*`, replacing the vendor values)

| Token | Hex | Use |
|---|---|---|
| `gg.cyan` | `#29ABE2` | strips, chips, selected rows, primary buttons, splash field |
| `gg.cyanDark` | `#1E8BBB` | app-bar gradient end, footer, `theme_color` |
| `gg.cyanLight` | `#5BC4ED` | secondary lines, W'bal chart |
| `gg.yellow` | `#FFF200` | LAP button, Power chart line, tile accent |
| `gg.red` | `#ED1C24` | STOP button, Delete, HR chart line |
| `gg.dark` | `#1A1A1A` | page background everywhere (replaces navy `#093c64` and pref `#212121`) |
| `gg.panel` | `#262626` | cards, chart panels, Home tiles |
| `gg.btn` | `#3A3A3A` | neutral buttons (PAUSE, Restart, dialog secondary) |
| `gg.light` | `#F8F9FA` | light surfaces (lap table body, dialogs' text areas) |

Kept unchanged: `zone.z1..z7`, `zonefill.z1..z7`, `hr.z1..z5` (`hr.z1` cyan becomes `#29ABE2` so the resting strip matches the new cyan; the other four stay). `gg.bar #1f1f1f` is retired in favour of the gradient bar. The old `gg.bg`, `gg.strip`, `gg.on`, `gg.lap`, `gg.pref`, `gg.summary`, `gg.dlg`, `gg.zonebg` are removed or remapped; `theme.test.ts` asserts the new table and the unchanged zone/HR tokens.

Radius: 8 px on strips, chips, buttons, panels (`rounded-[8px]`); 12 px on Home tiles. Shadows: none (flat on dark).

Type: system Roboto stack as today. Wordmark "grannygear" = lowercase, `font-weight: 900; font-style: italic; letter-spacing: -1px` (renders Arial Black on Windows/Mac, Roboto Black on Android; accepted). No PNG wordmark in the UI.

## 4. Assets

- `public/icons/icon-192.png`, `icon-512.png`, new `icon-maskable-512.png` (emblem on a `#29ABE2` square with safe-zone padding), `apple-touch-icon.png` (180), `favicon-32.png`, `favicon-16.png`: all generated from `docs/reference/brand/gg-emblem-512.png` with the existing node/sharp-free approach (plain copy + canvas resize script or pre-resized files committed; builder's choice, but the files are committed, not generated at build).
- `public/img/bike.png` (Logs row icon) stays.
- Manifest: `name` "Granny Gear Indoor Cycling", `short_name` "Granny Gear", `theme_color #1E8BBB`, `background_color #29ABE2`, icons above incl. `purpose: 'maskable'` for the maskable one.
- `index.html`: `<meta name="theme-color" content="#1E8BBB">`, apple-touch link, favicon links.

## 5. Screens

### Splash
New `src/ui/Splash.tsx`, rendered by `App` above the router on the first mount of the app (per page load), full-screen `#29ABE2`, 6 px stripe at the very top (yellow left half, red right half), emblem 150 px centred slightly above middle, wordmark 34 px dark `#111` below it, "INDOOR CYCLING" 13 px letter-spaced white, tagline "Ride in the Granny Gear" 12 px white near the bottom, three dots. Shown for **1200 ms** then fades out over 300 ms (opacity transition, pointer-events none during fade); `role="status" aria-label="Loading"`. Skipped (not rendered) when `?nosplash` is in the URL (tests, Pages previews) and when `prefers-reduced-motion` is set the fade is instant. Does not block store hydration or sensor reconnect (they run underneath).

### App bar (all screens except Home)
56 px, `linear-gradient(135deg, #29ABE2, #1E8BBB)`, white text. Left: back chevron (as today) or on Training the 36 px emblem; title 20 px bold; Training keeps rider name + SIGN OUT.

### Home
Page `gg.dark`. Top bar as above with the 36 px emblem + the title **"Indoor Cycling"** (20 px bold white; the lowercase wordmark appears only on the splash). Five tiles in this order: TRAINING, CLASS PLANS, ACTIVITY LOGS, SENSORS, SETTINGS — `gg.panel` cards, 12 px radius, white 18 px bold uppercase labels, 6 px left border in cyan / yellow / red / cyanLight / white respectively, `min-h-[56px]`, `flex-1` as today. Footer band `gg.cyanDark`, "Ride in the Granny Gear". "Review terms" / "Choose rider" links stay in the top bar, white. Terms gate unchanged.

### Training — phone (< 600 px), top to bottom
1. Elapsed strip: `gg.cyan`, white bold 24 px, 8 px radius, 10 px side margins.
2. Chips row (4): captions white bold 12 px: **Speed**, Power, HR, Cadence; values white bold 22 px on `gg.cyan`, 8 px radius. Speed shows `fmtSpeed` without unit text (km/h or mph per setting); when `speedSource === 'virtual'` the caption reads "Speed (est.)".
3. Lap table: white body, black text, header row as today (Lap | Time | Avg Power | Avg HR | Avg CAD), rows = **now + the last 3 closed laps** (newest first), zone fills unchanged, `rounded-[8px]`, no scrolling, `flex-none`. Older laps remain in the engine, Logs and the FIT; tablet keeps the full list.
4. Button row: `PAUSE` (`gg.btn`), `STOP` (`gg.red`, white), `LAP` (`gg.yellow`, dark text) — during class the row becomes PAUSE ¼ | STOP ¼ | class bar ½ exactly as now (bar colours unchanged); warm-up shows START CLASS in `gg.yellow`.
5. Charts (two `gg.panel` cards, 8 px radius, 6 px apart): HR (`#ED1C24`) + Power (`#FFF200`) at 60 px; Cadence (`#29ABE2`) + W'bal kJ (`#5BC4ED`, dashed) at 46 px; tiny legend labels top-left; `RollingChart` reused with these colours/heights; the phone no longer hides them (`hidden tab:block` removed).
6. Bottom row: Distance (km) | Wbal (%exp) | %HR max | KJ — compact tiles as today, `gg.cyan` strips, %HR strip keeps the HR band tint.
The screen may scroll if the viewport is shorter than the stack (Nothing Phone (1) at 412×915 fits without scrolling with these heights; tested in the preview).

### Training — tablet (≥ 600 px)
Same palette; layout as today (all laps, all tiles, charts), buttons recoloured, chips row gains Speed before Power as well.

### Settings
Page `gg.dark`; category header `gg.cyan` bold; item titles white, summaries `#9e9e9e`; controls dark `gg.panel` with a 1 px `#555` border; dividers `#333`. Content unchanged.

### Sensors
Page `gg.dark`; slot cards `gg.panel`; Pair = `gg.cyan`, Forget = text red; "Reconnect sensors" bar `gg.cyan`; status dot green/grey/red unchanged. ⋮ menu `gg.panel`.

### Logs / Session detail
Page `gg.dark`; ride rows `gg.panel` with white text (date, rider, duration, distance, kcal); Download FIT `gg.cyan`; Delete red text; Delete-all red. Session detail charts use the GG line colours.

### Rider (sign-in) screen
Page `gg.cyan`; emblem 48 px top-left + "WELCOME TO GRANNY GEAR"; list and form panels `gg.light` with dark text; Go/Add buttons `gg.dark` with white text.

### Workouts (Class plans)
Page `gg.dark`; rows as today with `gg.cyan` selected; today badge `gg.yellow` with dark text (always visible on both states — replaces the cyan/navy swap).

### Dialogs (Terms, Start class, Stop/Save)
Title bar `gg.cyanDark`, body `gg.panel`, white text, buttons `gg.btn` / primary `gg.cyan`; 8 px radius.

## 6. Constraints
Chrome 81 (see anti-goals; CSS gradients, `border-radius`, `opacity` transitions are fine). Tailwind 3.4, literal class strings. Every existing test stays green or is updated only where a class name or label moved; `theme.test.ts` is rewritten for the new tokens. `src/encoding.test.ts` green. The vendor screenshots in `docs/reference/vendor-screenshots/` stop being the visual reference; the mock-up is.

## 7. Left to the builder
- Exact chip heights so the phone stack fits 412×915 without scrolling (verify in the preview).
- How to produce the resized icon PNGs (committed files; any tool).
- Splash implementation detail (timer + CSS transition) as long as it never blocks interaction after 1.5 s.
- Legend placement inside the chart panels.

## 8. Builder-check resolutions (controller calls, 2026-10-17)

1. **Token fate (exact).** Survive, renamed: `gg.strip`→`gg.cyan`, `gg.bg`→`gg.dark` (body background too), `gg.pref`→`gg.dark`, `gg.dlg`→`gg.panel`, `gg.bar`→ removed (gradient bar), `gg.summary`→`gg.muted` = `#9e9e9e`, `gg.cat`→`gg.cyan`, `gg.zonebg`→`gg.light` (tablet NOW row), `gg.lap`→`gg.yellow`, `gg.btn`→`#3A3A3A` (white text everywhere it is used; update the START assertion), `gg.on`→`gg.green` = `#28A745` (GGWA status green; tablet START, Rider selected row, Sensors connected badge), `gg.paper`/`gg.pink`/`gg.text` → map to `gg.light` / `gg.red` / `#ffffff` and delete the old names. `src/ui/theme.ts` `THEME.on`/`THEME.strip` follow (`gg.green`/`gg.cyan`). `theme.test.ts` asserts exactly: cyan, cyanDark, cyanLight, yellow, red, dark, panel, btn, light, muted, green, zone.z1..z7, zonefill.z1..z7, hr.z1..z5 with `hr.z1 === gg.cyan`. Grep guard: no `gg-bg|gg-strip|gg-on|gg-lap|gg-pref|gg-summary|gg-dlg|gg-bar|gg-cat|gg-zonebg|gg-paper|gg-pink|gg-text` left in `src/`.
2. **Breakpoints.** The new sizes in §5 are phone (< 600 px). Tablet keeps its current sizes and structure (45 px values, 25 px captions, full laps, all tiles) and only takes the palette, white chip text, and Speed as the first chip of the main row; the tablet third row drops its Speed tile (no duplicate "Speed"). Tests that pin tablet sizes stay; phone-size tests are updated.
3. **Overflow.** Training phone: the page scrolls as a whole (`Shell fill` gets an `overflow-y-auto` variant for Training; nothing is pinned). Target: 412 × ~800 CSS px (standalone PWA on the Nothing Phone (1)). Spare height goes to the two charts (`flex-1` split 60/40 between them, min heights 60/46 px); the lap table is `flex-none`.
4. **Button colours.** Idle START `gg.cyan` white text (phone and tablet; green retired on tablet); Restart `gg.btn`; Save-or-discard `gg.cyan`; START CLASS `gg.yellow` dark text; dialog primary `gg.cyan`, secondary `gg.btn`, Cancel link `gg.muted`. All `gg.btn` buttons are white text.
5. **Icons.** `purpose: any` icons (192, 512, apple-touch, favicons) = emblem on a **white** square (iOS renders transparency black); maskable 512 = emblem on `#29ABE2` with 20 % safe padding. In-app emblem (Rider screen 48 px, Training/Home bar 36 px) = the transparent emblem on a white circle so its cyan ring reads against cyan. Tool: any; the PNGs are committed. The orange placeholder goes.
6. **Splash.** Only on a cold launch: rendered when `sessionStorage['ig.splashed']` is unset, then set; never when `useRide` is recording/paused (a service-worker reload mid-ride shows no splash). Terms dialog autofocus happens after the splash unmounts (gate the dialog on splash done). Component test for Splash; `App` not rendered in tests.
7. **Tablet bar, tones, details.** Tablet header takes the gradient and white text, structure unchanged. `Shell` tones collapse to two: `dark` (default, every screen) and `cyan` (Rider); `white`/`navy`/`black`/`pref` removed. Home keeps an `sr-only` h1 "Granny Gear". Stop/Save dialog: recolour only, no title text added.
8. **Mock-up vs spec.** Spec wins: no drop-shadow; phone chip 22/12 px; the Review-terms / Choose-rider links stay; `RollingChart` `Series` gains `dash?: boolean`; chips strip the unit from `fmtSpeed` the way `fmtDistance` already does.

## 9. Icons and tagline (Laurent, 2026-10-17, mock-up v3/v4)

- **Tagline** everywhere (splash, Home footer): **"Ride in the Granny Gear"** (replaces "improve your performance").
- **Home tiles** carry a 44 px rounded (12 px) icon badge left of the label and a `›` chevron at the right; tiles lose the coloured left border. Badge colour / icon: TRAINING `gg.cyan` bike; CLASS PLANS `gg.yellow` calendar (dark icon); ACTIVITY LOGS `gg.red` history clock; SENSORS `gg.cyanLight` bluetooth (dark icon); SETTINGS white sliders (dark icon). Icons are **inline SVG, 24-unit viewBox, stroke 2, round caps/joins, `currentColor`** (Lucide style, authored in-repo under `src/ui/icons.tsx` as tiny components; no icon font, no external file). Keep the labels' existing text so the Home tests' `getByRole('link', {name})` queries still match (icons `aria-hidden`).
- **Training chips** get a 14 px icon before the caption: Speed gauge (white), Power bolt (`gg.yellow`), HR heart (`gg.red`), Cadence rotate (`gg.cyanLight`); tablet captions too.
- App bar back chevron and the Sensors ⋮ stay as text glyphs.

## 10. v9 consolidation (Laurent's notes 2026-10-17, supersedes §3, §5 and §9 where they differ)

Reference: `docs/reference/brand/look-v9.html` (the approved mock-up).

- **Palette = gym variant.** Page `#111111` (`gg.dark`), panels `#1F1F1F` (`gg.panel`) / `#262626` (`gg.panel2`), **primary = yellow `#FFF200`** (elapsed strip, chips, LAP, Save, primary buttons, footer band, app-bar underline, category headers), cyan `#29ABE2` and light cyan `#5BC4ED` secondary, red `#ED1C24` for STOP / Delete / heart-rate trace, green `#28A745` connected. Text on yellow is `#111`. The cyan-primary tables in §3 are replaced accordingly (`gg.cyan` stays as a token, it is just no longer the primary).
- **App bar:** dark gradient `#2B2B2B → #141414` with a 3 px yellow bottom border; emblem on a white circle; chevron and ⋮ in yellow/white. Home bar title "Indoor Cycling" with the signed-in username at the right.
- **Icons:** white strokes only (24-unit viewBox, stroke 2, round caps), no coloured badges. Home tiles = `gg.panel` cards, 12 px radius, **6 px coloured left border** (cyan, yellow, red, light cyan, white) + white icon + label + grey `›`.
- **Splash and Login** sit over the generated studio photo (`docs/reference/brand/gen/studio-bg-300pro.jpg`, 1024×1536, dark gradient overlay 40 % → 15 % → 65 %), yellow/red stripe at the top, emblem, wordmark white, "INDOOR CYCLING" in yellow, tagline "Ride in the Granny Gear". **Login = username only**: one field, SIGN IN (yellow), hint "Riders are added by the studio." No recent riders, no Add rider, no rider list on the phone; rider creation lives on the portal. Until the portal exists the field matches a local rider by name (case-insensitive); unknown name → "Not a Granny Gear rider yet — ask the studio".
- **Training charts:** chart 1 = **Power + Cadence** (yellow + cyan, smoothed lines with soft gradient fill, live dot, legend with current values), chart 2 = **heart rate as an ECG strip** (red trace fading in from the left, faint 14 px grid, current bpm and %HR max in the legend). W'bal leaves the charts (stays in the bottom tile). Chart.js config: tension 0.35, fill gradients, no axes/gridlines on chart 1; chart 2 draws the grid pattern itself.
- **Sensors:** ⋮ opens a dark dropdown "SENSOR CONFIGURATION" with four Pair rows (icon + label); slot rows = panel cards with white icon, name + device/value, status pill (Connected green / Pair yellow / Offline grey); Reconnect sensors = yellow bar.
- **Settings:** rows as panel cards with white icons; tapping opens an inline editor card below the row: segmented control for Units (Metric | Imperial) and Class alerts (Both | Vibrate | Beep | Off), number field + yellow Save for Weight / FTP / W′, segmented or select for Countdown and Smoothing.
- **Activity logs:** ride cards (icon, date · time, rider · plan title or "free ride", four stats time / km / kcal / avg W, Delete in red text, Download FIT yellow pill with icon).
- **Portal and broadcaster** adopt this same look (tokens, bar, icons, cards).

## 11. v10 (Laurent, 2026-10-17) — overrides §10 where they differ. Reference `docs/reference/brand/look-v10.html`.

- **Per-screen accent.** Home, Login/splash, Sensors, Settings, Class plans, Logs keep **yellow** `#FFF200` as the accent. **Training (in session) uses Granny Gear blue `#29ABE2`** for the elapsed strip, chips, LAP, bottom tiles, bar underline and chevron (white text on blue). Zone colours on lap rows and the class bar unchanged; STOP stays red.
- **Heart-rate strip = rolling ECG paper.** White panel; graph-paper grid (7 px minor, 35 px major, light grey-blue lines) that scrolls left continuously; the red trace is drawn from the right edge and moves left with the paper (1 px per 1/20 s at 1 Hz data, interpolated); a red "needle" dot at the right edge follows the newest value (CSS/`requestAnimationFrame`, no Chart.js for this strip; stop animating when the ride is paused/stopped and when `prefers-reduced-motion`). Legend: "● Heart rate" + current bpm and %HR max. Chart 1 (Power + Cadence) as §10.
- **Settings editors** inline below the tapped row: segmented control (Units: Metric | Imperial; Countdown: None | 5 s | 1 h | 2 h | 3 h; Class alerts: Both | Vibrate | Beep | Off), number field + yellow Save (Weight, FTP, W′, Wheel circumference), select for Smoothing.
- **Class plans screen:** plan cards with calendar icon, title, `h:mm:ss · N intervals`, yellow `today` pill, a 6 px zone strip (segments proportional to interval durations, zone colours), yellow left border + check on the selected plan; `Import .seconds` yellow button; hint "Tap the selected plan again for a free ride." **Plan detail** (new route `/workouts/:id`): header line (dates · total · count), interval rows (index, zone swatch, display name + `n/m` counter small, `m:ss`), zone strip, `USE THIS PLAN` button.
- **Activity logs:** as §10 (cards with four stats, Delete, Download FIT).
- **Broadcaster (own repo, Android TV, 16:9):** same tokens; dark bar with emblem, "Indoor Cycling · <plan title>", blue clock, red "● LIVE · N riders"; class progress bar in the current interval's zone colour with name and "m:ss left · next: …"; 4×2 grid of rider cards (more riders → 4×3 then paging every 8 s): username with user icon, zone pill (Z1–Z7 by current power), big blue power in W, then HR (red heart icon), cadence, speed, kJ; blue footer with tagline, studio code and the broadcaster URL. Cards sort by join order; a rider silent for 10 s greys out, gone after 60 s.

## 12. v11 (Laurent, 2026-10-17) — Settings additions. Reference `docs/reference/brand/look-v11.html`.

- **Rider profile:** `FTP` is read-only in the app (lock icon, "set by the studio" / "set by <coach>, <date>"); it is changed only on the portal by a coach (e.g. Alex Kruger) or an admin, with a change history line. **Weight stays editable by the rider** (inline editor as §10) and the portal can correct it. CP, W′ and HR max: portal only (not shown in the app's Settings).
- **Bike adjustment** section with a toggle "show bike": a line drawing of the CycleOps 300 Pro (authored SVG, `src/ui/icons/bike300pro.tsx`) with numbered callouts and four editable scale numbers, saved to the rider profile and synced to the portal (read-only there): 1 Saddle height, 2 Saddle fore/aft, 3 Headset height, 4 Stem depth (Laurent, 2026-10-17: no seat tread). Integers 0–30; blank allowed.
- **Heart rate strap**: `strapCode` on the rider profile (free text, e.g. the Polar H10 id), with a **Discover** button that runs the HR Bluetooth chooser and fills the code from the chosen device's name/id; Save stores it. The Sensors screen uses the saved code to pre-select the strap when pairing.
- App Settings order: Rider profile (Weight, FTP locked) → Bike adjustment → Heart rate strap → App (Units, Countdown, Smoothing, Class alerts, Wheel circumference).
- Portal rider editor (drawer): username (read-only), weight, FTP, CP, W′, HR max, bike setup (read-only), HR strap, Save, change history.

## 13. v12 — live chip icons (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v12.html`.
Training chip icons animate from the live values and stop while paused/stopped or under `prefers-reduced-motion`: **Cadence** = crank/pedal icon rotating at the current rpm (one turn per 60/rpm s, CSS `animation-duration` updated once per second, 0 rpm = still); **Speed** = gauge needle that sweeps toward the current speed (0–60 km/h → −40°…+40°, 300 ms ease; idle when 0); **Power** = bolt that pulses (opacity 1 → 0.3) once per second while power > 0, steady when 0; **Heart rate** = heart scaling 1 → 1.3 on each beat at the current bpm (`animation-duration = 60/bpm` s), still when no HR. Implemented as CSS keyframes on inline SVGs with per-second duration updates (no JS per frame). Chrome 81 supports all of it.

## 15. v14 (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v14.html`.
- **No splash.** The app opens on the Login screen (username → Training). Splash section (§5, §10) is dropped; the studio photo stays as the Login background.
- **Power panel** keeps the 7-zone bar + marker and the trace now carries **cadence in green** (`#5CD67A`) alongside power (yellow); legend shows current W and rpm. Cadence icon on chips and broadcaster cards also green.
- **Broadcaster rider card:** power shown on a **gradient arc gauge** (zone ramp z1→z7, 0–400 W over 180°) with a white needle that follows the live value (eased, 300 ms), the watt figure under the arc; HR / cadence / speed / kJ below as before.
- **Strava linking:** riders must authorise Strava themselves, so the entry points are (a) app Settings → **Strava** row → `Connect` (opens the portal's `/api/strava/connect?rider=<id>` in the browser → Strava OAuth → callback stores tokens → "Connected" shown in the app and portal) and (b) the portal rider drawer shows status (Connected / athlete id / Disconnect) and a "Send link" that mails the same URL. Uploads then happen from the portal on every saved ride. Strava's new-app cap (one athlete until approval) applies.
- **Portal tabs:** Riders · Class plans · **Gym Settings** (Dashboard and Activities removed; rides stay reachable from each rider). **Class plans tab:** list (title, dates, length, source pill: today / e-mail / upload), Upload .seconds, the e-mail intake line with "last mail seen", drawer editor (title, dates, interval rows editable, zone strip, Save, provenance line). **Gym Settings tab:** bikes list (bike no., power-meter type and id, CycleOps hub id, assigned tablet with battery and last-seen, status pill), studio block (name, join code, broadcaster URL, staff), and a bike drawer reusing the 300 Pro illustration with **highlighted pedals = power meter** (yellow ring) and **highlighted flywheel = CycleOps hub id** (blue ring), power-meter type segmented (none / pedals / crank / CycleOps hub), meter id, hub id, tablet line, **health check** (power meter + battery, tablet battery/charging/Wi-Fi/app version/last seen, hub last seen) and a comments field.
- **Zwift Click:** support to be specified from the ANTicP implementation (lookup in progress); intended mapping: `+` = LAP / START CLASS, `−` = PAUSE / RESUME.

## 16. Zwift Click support (from the ANTicP implementation, `workout.html` lines 1095–1225, looked up 2026-10-17)

What worked on Laurent's own Click (author's notes, no tests in that repo):
- `requestDevice` filters `namePrefix: 'Zwift Click'` and `'CLICK'`; `optionalServices` `00000001-19ca-4651-86e5-fa29dcdd09d1` (Zwift), `0000fc82-0000-1000-8000-00805f9b34fb` (newer Zwift service, include it), `0x180F` battery.
- Characteristics under the Zwift service: `…0002` Measurement (notify, button data), `…0003` Control Point (write), `…0004` Response (notify/indicate).
- Handshake: subscribe Measurement and Response, then write ASCII `RideOn` to Control Point with **`writeValueWithoutResponse`** (`writeValue` fails — the one real fix in that repo). No key exchange, no protobuf, no reply wait.
- Notifications: `data[0] === 0x37` with length ≥ 5 → `data[2]` state (0x00 pressed, 0x01 released), `data[4]` button (0x01 = `+`, 0x00 = `−`). Observed: `+` press = `37 08 00 10 01`; `−` only ever reported **release** `37 08 01 10 00`, so `−` is detected on release with a 500 ms gap; `+` debounced 200 ms. `data[0] === 0x19`, length 3 = keepalive, ignore. A `0x23` bitmap message from the SwiftControl notes was never seen on this hardware — parse it as a fallback only (`up = !(bitmap & 1)`, `down = !(bitmap & 2)`).
- Zwift Play / Ride: not handled; out of scope.

**Our mapping (app `SensorSource`-style adapter `src/sensors/ble/zwift-click.ts`, slot `click`, paired from Sensors like the others):**
- `+` press → during warm-up `startClass()`, during class or free ride `lap()` (the 3 s tap guard applies), while idle with a plan selected → opens the Start dialog, while the Start dialog is open → START CLASS.
- `−` release → `pause()` / `resume()` toggle; a long `−` (release after > 1.5 s) while paused → opens the STOP confirmation.
- Battery level (0x180F) shown on the Sensors row. No resistance control (no trainer control in this app).
- Settings → Sensors gains a `Zwift Click` slot row (Pair / Forget / battery). Readings never enter `LiveStore` (it is a controller, not a sensor).

ANTicP's `.seconds` reader only took `packs[0].items[0]` and mapped colours `0→Z1, 5→Z2, 4→Z3, 3→Z4, 6→Z5`; our parser (all items, keyword-first mapping) already supersedes it. ANTicP's interval timer advanced intervals without creating laps and had no beep/vibration; ours does both.

## 17. v15 (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v15.html`; bike reference photo `docs/reference/brand/ref-300pro.avif`.
- **The 300 Pro has its flywheel at the REAR** (enclosed drive from the crank back to the flywheel under the saddle). Illustration regenerated as `docs/reference/brand/gen/bike300pro-rear.jpg`; callouts 1–4 and the two Gym-Settings highlight rings (pedals/crank = power meter, rear flywheel = CycleOps hub id) placed accordingly by percentage.
- **No `.seconds` import on the phone.** Plans come from the portal (e-mail intake or upload). The app's Import .seconds button is PARKED (code stays behind a hidden flag `?import=1` for Laurent's own testing; not shown to riders).
- Portal Studio block: three equal columns, labels on one line (Studio name · Join code · Broadcaster URL). Bike adjustment toggle: standard 34×18 switch with a 12 px knob.

## 18. v16 (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v16.html`.
- **Broadcaster gauges:** no needle; the arc **fills** from the left to the current power (stroke-dash on the gradient arc, eased 300 ms per update); pedal icon spins on each card at the rider's cadence. **Race view** (second TV mode, rotates with Gauges every 20 s or fixed from the TV menu): top-down oval track, one dot + username + W per rider, position along the lap = that rider's kJ this class relative to the leader (leader yellow, podium blue, rest white), the current interval and "lap n of N" in the infield, FINISH checker flag at the top. At the plan's last interval everyone rides to the line in finishing order with arms raised (stick figures), confetti in zone colours, then the podium three and everyone's kJ / avg W.
- **Platform bike drawer:** power-meter type `none | pedals L+R | pedal L | crank | hub`; **left and right meters as separate chip pairs** (name chip + id chip), right blank for single-sided; studio name **Tygervalley**; **Broadcast panel URL** is the full link with the studio code (`https://indoorgranny-broadcast.pages.dev/?studio=<code>`) with a **Copy** button; **Export gym settings (.xlsx)** and **Export riders (.xlsx)** (client-side SheetJS, one sheet per table, owner/admin only).
- **Rider accounts:** Active / Inactive. Inactive riders cannot sign in, are hidden from the TV and from the riders list by default ("show inactive (n)"), keep their history; toggled in the drawer.
- **Garmin Connect:** possible through the Garmin Connect Developer Program (Activity/Training API: OAuth per athlete, FIT upload), but it needs an approved developer application for the studio first (weeks, business details). Design: a second connector next to Strava in the app Settings (row "Garmin Connect — Soon") and in the portal drawer ("not linked · after Garmin developer approval" + Send link); same `connectors` table shape as Strava. Until approval riders download the FIT and import manually.
- **Zwift Click in the app:** Sensors shows a `Zwift Click` row (device name, battery, the two button meanings) and the ⋮ menu gains "Pair Zwift Click"; Training's bar shows a small Click badge with the current meanings (`+` lap / start class, `−` pause). Behaviour per §16.
- **Sensor icons animate when connected:** heart beats, bolt flashes, pedal spins, trainer wheel spins, Click pulses; a connecting row pulses a ring around its icon; offline rows dim to 45 %. Reconnect bar's Bluetooth icon pulses while reconnecting.
- All three apps (indoor cycling, broadcaster, platform) ship as installable PWAs (manifest, icons, service worker; the broadcaster adds TV-friendly focus handling and a wake lock).

## 19. v17 (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v17.html`.
- **Free ride** Training uses a **yellow → blue gradient** (`linear-gradient(135deg, #FFF200, #29ABE2)`, dark text) on the elapsed strip, chips, LAP and bottom tiles, with a gradient bar underline; a **class** stays solid blue. Same tokens, `gg.gradient` added.
- Platform Studio block gains **Open broadcast panel**, **Open indoor cycling app** and **Copy app link** (app URL with `?studio=<code>`).
- **Health check** = six items, each an **OK / Out of order** toggle: Power meter, CycleOps hub, Tablet, Chain, Seat, Handlebar. Any "Out of order" marks the bike `check · <item>` in the list and hides the bike from riders until cleared. Comments field stays.
- **Rider account** = a single Active toggle switch (green on); off = inactive (cannot sign in, hidden from TV and list, history kept).
- **Version number** at the bottom of the app (Login tagline line and Home footer, `v<package.json version>`), in addition to Settings.
- **Login background** lighter: overlay 25 % → 5 % → 45 % (was 40 / 15 / 65).

## 20. v18 (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v18.html`.
- **Broadcaster = split view**, one screen: gauges grid left (2 columns, up to 8 riders; more → page every 8 s), **race lane right** (≈36 % width). The lane is the whole class: START at the bottom, FINISH checker line at ~30 % from the top where the plan's last interval ends, the band above it is the **cool-down / celebration** zone where each sprite rides hands-free with arms up once it crosses. Rider position = kJ this class relative to the leader (eased 1 s per update); eight lanes, labels (username, W) under each sprite.
- **Style: Chrome dino-runner** — monochrome pixel terrain (light grey road, dashed centre line scrolling down as time passes, pixel cacti at the edges, pixel clouds in the cool-down band), `image-rendering: pixelated`. **Riders are rear-view pixel sprites** from one generated PNG (`docs/reference/brand/gen/rider-sprite.png`, 1024², RGBA; C2PA to strip; downscale to 128² for shipping) recoloured per rider with `filter: hue-rotate(<deg>)` (jersey hue assigned per username, stable).
- **Zwift Click badge on Training** is now prominent: yellow-bordered chip in the bar with the controller icon and `+` LAP / `−` PAUSE (meanings change with state: `+` START CLASS during warm-up; `−` RESUME while paused); it flashes on each press.

## 21. v19 (Laurent, 2026-10-17). Reference `docs/reference/brand/look-v19.html`.
- **Race lane** narrower (≈22 % of the TV width, gauges 3 columns beside it), **fully monochrome** (terrain and rider sprites greyscale; leader a touch darker), **no lanes**: riders bunch on one road with small horizontal jitter, overlap allowed. START band at the bottom, FINISH checker line near the top, cool-down above. **Collapsible**: a ▸ handle on the lane's left edge collapses it to a 24 px strip (gauges take the full width); state remembered per TV.
- **Zwift Click badge** moves from the top bar to the **right end of the elapsed strip** (dark pill: controller icon, `+LAP −PAUSE`), never overlapping the bar; on a button press it pulses a yellow ring (500 ms) and the acted-on control (LAP / PAUSE) does its press animation.
- **Lap progress bar effects:** the fill carries slow-moving diagonal stripes, a soft glow pulse in the interval's zone colour, and a brighter flash at each boundary.
- **Button press animation** on START / PAUSE / STOP / LAP / RESTART: scale to 0.94 with a white ripple from the touch point (CSS only; Chrome 81 fine).
- **Avatar in session:** the Training bar shows the rider's **uploaded photo** (square crop, 512 px, stored on the portal, cached in the app) when there is one, otherwise a gradient disc with the **first and last letter of the username** (`laurentdls` → `LS`). Same avatar on the TV cards and the Settings "My profile" row.
- **My profile (platform, rider view):** opened signed-in from the app (Settings → My profile; the app passes its session token) or by username + e-mailed code. Riders change: photo, username (unique, letters/digits; applies at next sign-in), display name (what the TV shows), e-mail, weight, HR strap code, bike setup, Strava / Garmin links. Read-only for riders: FTP, CP, W′, HR max (coach), active/inactive (studio). Second tab "My rides" (their own activity list with FIT download and Strava status). Portal nav for riders is just these two tabs; staff see Riders · Class plans · Gym Settings.
