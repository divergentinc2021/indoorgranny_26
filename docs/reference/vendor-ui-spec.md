# Vendor app visual spec ("Indoor Cycling" v19.4, com.sports.cycling)

Appearance only, derived from jadx resources at `D:\INDOORCycling\GrannyGear\CadenceApp\decompile\jadx\resources\res\` (paths below are relative to it). dp/sp are Android units; for CSS treat 1dp = 1px, 1sp = 1px at default font scale.
Not determined: anything set in Java at runtime (see "Unknowns" at the end).

## 1. App-wide

**Palette** (`values/colors.xml`)

| Name | Hex | Where used |
|---|---|---|
| `background` (= `headlinecolor`) | #093c64 | dark navy: ride screen page bg, tile gutters, title/footer bars, round-border stroke (colors.xml:14) |
| `light_blue` | #00bbff | cyan: home tiles, metric value strips, lap list bg, "off" button, sensor icon buttons, login page bg (colors.xml:55) |
| `white` / `text_color` / `training_screen` / `training_screen_other` | #ffffff | main text on navy/cyan, page bg of home/logs/sensors (colors.xml:100,108) |
| `black` / `zonecolortext` | #000000 | text on white/cyan (lap rows, tablet values), workouts page bg (colors.xml:19,111) |
| `green` / `button_pushed` | #0eef2c | "on" button fill (`round_border_button_on`), zone fill (colors.xml:50) |
| `orange` | #ffb872 | LAP button on tablets (layout-sw600dp/laps_screen.xml:829), a zone fill (colors.xml:77) |
| `yellow` | #ffff00 | workout-panel text on black (colors.xml:109) |
| `zonecolorbackground` | #d3d1c9 | warm light grey: zones ListView bg (laps_screen.xml:612) |
| zone fills (`drawable/fill*.xml`) | smeraldo #7adac6, green #0eef2c, light_green #abebcb, yellow #ffff00, darkyellow #e6e600, orange #ffb872, red #ff8787, vo2 #00faff | flat solid rectangles, no gradient; zone-to-fill order set in Java (not in res) |
| `matches_even_color` / `matches_odd_color` | #0a4141 / #0a2841 | defined (dark teal / dark navy) but referenced by NO layout/drawable -> Java-only; see Unknowns |
| `text_color2` | #17c8aa | defined, unreferenced in res |
| `mainmenu_color`, `dark_blue`, `team_color`, `giornata_color`, `vibrantgreen`, `grey`, `light_grey`, `off_white`, `blue`, `brightred`, `darkyellow` | #10667b, #1064a8, #2994a3, #172fb6, #00d800, #7f7f7f, #e5e5e5, #eee, #0083ff, #ff0000, #e6e600 | defined, no layout reference (legacy / Java) |
| `red` | #ff8787 | salmon pink (not red!) - `gradient_box_red` fill, zone fill (colors.xml:87) |

**Typography.** No custom font; platform default sans (Roboto). Only `fontFamily` found is AppCompat's `sans-serif` (styles.xml:1501). Sizes (`values/dimens.xml`): `values` 45sp (L149), `values_s` 39sp (L152), `values_buttons` 38sp (L151), `valueslap_buttons` 48sp (L155), `values_small` 25sp (L153), `headlines` 25sp (L98), `headlines_small` 14sp (L99), `values_avgmax` 20sp (L150), `info_avgmax` 14sp (L108), `values_smaller` 15sp (L154), `structuredW_text` 20sp (L136), `FontSize` 12dp (L3). Bold only on lap rows and workouts title. No uppercase transform; labels are literal strings (many already ALL CAPS).

**Shapes** (`drawable/`)
- `round_border.xml`: white fill, 2px #093c64 stroke, radius 15, padding 5/5 (used for sensor info panels).
- `round_border_button_on.xml`: same but fill #0eef2c. `round_border_button_off.xml`: fill #00bbff. Both radius 15, 2px navy stroke.
- `gradient_box.xml` white, radius 20, left pad 1 (name is misleading: no gradient). `gradient_box_data.xml` black, radius 20, left pad 10, v pad 1. `gradient_box_red.xml` #ff8787, radius 35. None of these three is referenced by any layout I was asked to read (Java-set).
- `fade_red.xml`: vertical gradient transparent red -> opaque #ff0000 (angle 90); unreferenced in layouts.
- `fill*.xml`: solid colour rectangles (zone swatches).

**Spacing.** `pad` 10dp (dimens.xml:128), `horizontal_pad`/`vertical_pad` 5dp (L107, L156), tile padding 4sp, home tile margin 20sp, row padding 5dp (laps/logs/workouts), sensor row padding 8dp. No elevation/shadows anywhere; flat colour blocks, no card borders except round_border panels.

**Theme.** Activities use `@android:style/Theme.NoTitleBar` (AndroidManifest.xml) = no app bar; the "title" is a navy TextView strip. Plain `<Button>` has NO background/colour in layout -> platform default button (grey, rounded, dark text on stock Android); only LAP (tablet, orange) and `gotostore` (cyan) are styled. Platform look cannot be read from res.

## 2. Home (`layout/main_activity.xml`)
- Whole page white (L5). Top strip (L8): navy, "Indoor Cycling" (`app_name`), 20sp white, centred, wrap height. Bottom strip (L86): navy, "improve your performance", 20dp white, centred.
- Between: vertical stack of 5 equal-height tiles (weight 1 each) filling the white area, each 20sp margin all round (so ~20px white gutters), no corner radius, flat cyan #00bbff, label 25sp white, centred both axes (text only, no icons).
- Order top-to-bottom: TRAINING (L24), ACTIVITY LOGS (L35), SETTINGS (L46), STRUCTURED WORKOUTS (L59), SENSORS (L72; 25dp not sp). Labels are ALL CAPS strings (`strings.xml` L530, L125, L471, L511, L456).
- `main_activity_old.xml` exists (older home) - not read.

## 3. Ride / Training (`layout/laps_screen.xml`, phone and sw480dp)
Page bg navy #093c64 (L5), vertical, top to bottom:
1. **Duration row** (L10-45): padding 5sp; one cyan strip with elapsed time "00:00:00" (`zeroes`), 25sp white, centred. A "Duration" caption and a "Previous Lap" row exist but are `gone`.
2. **Metric tiles row `t`** (L76): ONE row, 3 equal columns (weight 1): **Power | HR | Cadence**. Each tile = 4sp-padded navy cell holding a caption (14sp white, centred: "Power", "HR", "Cadence") above a cyan value strip (25sp white, centred, "0" initially). Power value strip also has a hidden right-aligned torque (L120, gone). Under each value, a hidden AVG/MAX pair (value 20sp white on cyan + "AVG"/"MAX" 14sp white) - `gone` on phone, shown on tablets.
3. **Lap block `t5`** (L399, weight 1 = takes remaining height):
   - Header row (L408, white bg, marginTop 10dp): column titles in black 14sp centred: Lap, Time, Avg Power, Avg HR, Avg CAD (Avg Speed, Distance, %dif HR hidden).
   - "now" row (L491, cyan bg): bold black 14sp: label "now", running lap time, live avg power / HR / cadence.
   - Lap `ListView` (L557) cyan bg; rows from `laps_list_row.xml`: no row bg of its own, bold black 14sp, centred, same 5 equal columns (Lap #, duration, avg power, avg HR, avg cadence). Row padding none; alternating colours not in XML.
   - Zones block (L565-619): header row (white bg, `gone`): "Power Zones | Lower | Upper" in black 20sp; a zones ListView on #d3d1c9 (`gone`); `zones_list_row.xml` = 3-4 equal columns, black 15sp (Zone name / lower / [mid] / upper), each row presumably tinted with the zone fill (Java).
4. **Graph section** (L620, `gone` by default): XYPlot/LineChart stack (power, cadence, HR, W'bal, SmO2), 50sp high on phone; chart/workout panel `sectionGraph2` (L657, black bg, padding 5sp, 300sp high, `gone`) holds structured-workout readouts in yellow 20sp on black: interval timer, "target %FTP"/target power, current %FTP, optional CAD/HR targets, plus a line chart.
5. **Start / controls** (L794, L809): idle = one full-width default-style button "START" (25sp). Running = row of equal-width buttons PAUSE | STOP | LAP (RESTART replaces PAUSE when paused), 25sp, 5sp bottom margin on navy.
6. **Bottom info row `a`** (L849, navy): equal-width cells, each caption (14sp white) over a cyan value strip (14sp white, centred). Visible by default: **Distance**, **HR max**, **%HR max**, **KJ**. Hidden until a sensor/setting enables: %FTP, THB (g/dL), SMO2 (%), Speed, Wbal (%exp).
7. Labels (strings.xml): Power, HR, Cadence, Distance, HR max, %HR max, KJ, AVG, MAX, START, PAUSE, RESTART, STOP, LAP, Lap, Time, Avg Power, Avg HR, Avg CAD.

**Tablet deltas (sw600dp, sw720dp; sw480dp = phone except minor heights):**
- Metric values 45sp (`values`) and BLACK (not white) on cyan; captions 25sp (`headlines`); AVG/MAX sub-rows visible (20sp black + "AVG"/"MAX" 14sp white); power value centred (sw600) or right-aligned (sw720).
- Lap header/now row text 20sp (not 14); lap list rows 20sp; zones rows 25sp (sw600) / 20sp (sw720).
- Buttons 38sp, order STOP | PAUSE | LAP; LAP button solid orange #ffb872 at 48sp; extra 5sp bottom margin; graph section 200sp high, visible.
- Bottom-row captions 14sp, values 39sp (`values_s`); distance/HR cells reflowed (distance block moved to the end).

## 4. Activity Logs (`layout/logs_main.xml`, `logs_list_row.xml`)
- Page white. Header strip navy, "Your activities" (20dp white, centred). Empty state text: "No activities at the moment". Bottom navy strip (20dp white, empty text).
- Row (cyan #00bbff, padding 5dp): left a 48x48 sport icon (`bike.png`: white cyclist on a green rounded square, shown at wrap size with 5dp padding; `run.png` is the running variant, same style - not viewed), right a two-line block of white default-size text: line 1 date (+ username); line 2 km | duration | calories. Row separators/alternation: not in XML.
- Hidden fields: sport name, uploaded flag, message id.

## 5. Sensors (`layout/antplusdemo.xml`, `sensors_list_row.xml`)
- Page white, scrollable, centred column of sensor "cards". Each card (margin 10dp) = square cyan button 60dp x 60dp (label inside: "BT LE HRM", "CBSC BTLE", "HRM", "CycleOps", "Power sensor", "FE sensor", "MO2", "SDM"*, "CBSC sensor", "Bike Speed sensor", "Bike Cadence sensor", *hidden) + a white `round_border` info panel filling the rest (title/status/readings in black 12dp: status, bpm, speed, cadence, power, wheel circumference, offset...).
- Footer bar navy: left "ANT Disabled" (white 12dp), middle optional cyan button "Enable ANT+ on Android" (20sp white text, hidden), right label "Sensors" (white 12dp, 3x width). `antplus.png` (367px black rounded square with white "ANT+" bold wordmark) is not referenced by any layout; likely a Java image swap for `ant_replace_img`.
- `sensors_list_row`: white row, 8dp padding, black left-aligned text (device pick list).
- Button "on/off" state (`round_border_button_on/off`) is applied at runtime to the cyan/green buttons (assumed from drawables; colours cyan = off, green = connected).

## 6. Structured Workouts (`layout/structuredworkouts_main.xml`, `structuredworkouts_row.xml`)
- Page BLACK. Header cyan strip: "STRUCTURED WORKOUTS" 20sp white centred. List on black, 1dp white dividers, grey pressed state (`darker_gray`).
- Row (padding 5dp): workout title bold 20sp CYAN; below, duration | target | date as 20sp WHITE, left aligned, 3 equal columns.

## 7. Settings (`xml/settingslayout.xml`)
Standard AndroidX preference list (platform default styling, not custom). Category "User" then flat items. Items (strings in `strings.xml`): auto-log checkbox, unit system, weight, FTP, W', countdown, smoothing, MO2 visibility, club number, structured-workout enable, app version. Titles/summary two-line list rows, no custom colours found.

## 8. Login (`layout/startpage_login.xml`)
Full cyan page, 10sp padding; header row: gear logo `icon.png` (72px gold cog with black "C") left + "WELCOME TO CADENCE CYCLING" white centred; below a login/signup radio pair (white labels), email field (default style), small "Go" button (79dp wide, 20sp top margin). Vendor-cloud (Selfloops) login only - no web analogue needed.

## 9. Countdown dialog (`layout/dialog_countdown.xml`)
Horizontal, padding 10dp: "Starting in:" (default text colour) + white countdown number. Dialog chrome is the platform dialog (`custom_dialog.xml` is an empty stub).

## 10. Images
`icon.png` (launcher, gold gear with black C), `bike.png`/`run.png` (48px hdpi sport icons), `antplus.png` (ANT+ badge), `marker_green/red/status.png` (20x34 / 39x34 map pins - map not in the screens read), `logo_circles.png` and `lineablue.png` are 1x1 transparent placeholders.

## 11. Mapping to the web app (current tokens: `tailwind.config.js` -> `gg.bg #111111`, `gg.panel #1c1c1c`, `gg.line #2e2e2e`, `gg.text #f2f2f2`, `gg.muted #9a9a9a`, `gg.accent #f28c1b`, `zone.z1..z7`; fonts Poppins/Inter)

**Token-only changes (tailwind.config.js + index.css)**
- `gg.bg` #111111 -> #093c64; add `gg.cyan #00bbff`, `gg.green #0eef2c`, `gg.orange #ffb872`, `gg.paper #ffffff`, `gg.zonebg #d3d1c9`, `gg.pink #ff8787`.
- Re-point existing: `gg.panel` -> #093c64 on dark screens (tiles sit on navy) or #00bbff for value strips; `gg.line` -> #093c64 (2px stroke); `gg.text` -> #ffffff; `gg.muted` -> #ffffff (vendor never dims text); `gg.accent` -> #00bbff for buttons/links (orange only for LAP).
- `zone.*` -> vendor fills: smeraldo #7adac6, #0eef2c, #abebcb, #ffff00, #e6e600, #ffb872, #ff8787 (+ #00faff vo2); only 7 slots in web, vendor has 8, order unverified.
- `fontFamily`: replace Poppins/Inter with system sans (Roboto, Arial fallback); drop `tracking-wide`.

**Home** (`src/ui/Home.tsx`): page white; wrap in navy top strip "Indoor Cycling" (20px white, centred) and navy bottom strip "improve your performance"; five tiles flush `flex-1`, 20px margin, bg #00bbff, white 25px label, centred, no border, no radius, no border-gg-line; remove "Granny Gear" h1 row or move into the navy strip (rider link goes in the strip).

**Rider** (`RiderScreen`): navy page, white text, form on white `round_border` panels (15px radius, 2px #093c64 stroke); selected rider uses the "on" button (#0eef2c fill), others "off" (#00bbff).

**Sensors** (`SensorsScreen`): white page; each sensor = 60x60 cyan square button + white round_border panel (black 12px text) to its right; footer navy bar with status and "Sensors" label; connected state green button.

**Training / Rider ride screen** (`TrainingScreen.tsx`, `components/Tile.tsx`, `LapTable.tsx`): page navy; metric tiles = 3-col grid (Power | HR | Cadence) with NO panel bg/border: 4px padding, caption 14px white centred, value strip bg #00bbff, 25px white (>=600px viewport: 45px black, caption 25px, show AVG/MAX sub-row 20px). Replace `Tile` classes `rounded bg-gg-panel border ...` with `bg-gg-bg p-1`, label `text-sm text-white text-center`, value `bg-gg-cyan text-white text-[25px] text-center` (md: `text-[45px] text-black`). Duration = full-width cyan strip 25px above the grid. Bottom info row (Distance | HR max | %HR max | KJ) same tile style, 14px captions. Lap table: white header row (black 14px, md 20px), cyan "now" row (bold black), cyan list rows bold black, no zebra from XML. Buttons: START full width; PAUSE | STOP | LAP row; LAP orange #ffb872 at md 48px; default button look otherwise (grey/platform) - safest is flat grey #d6d7d7 with black text, rounded 4px. Replace `bg-gg-accent text-black`/`bg-red-700` accordingly. Zones table: bg #d3d1c9, black 15px text, row tinted by zone fill.

**Logs** (`LogsScreen`): white page, navy header strip "Your activities" (20px white); each row cyan, 5px padding, 48px bike icon on the left (white cyclist on green rounded square - extract `bike.png`/`run.png` to /public), white text right: date + user / km | duration | calories.

**Session detail** (`SessionDetail`): no vendor equivalent file read (the app's detail view is Java/graph-driven); reuse the ride-screen look: navy page, cyan value strips, lap table as above, black-on-cyan lap rows, graphs on black with white axes (graph colours unknown).

**Workouts** (`WorkoutsScreen`, `WorkoutPanel`): black page; cyan header strip "STRUCTURED WORKOUTS" white 20px; rows with 1px white dividers, title bold 20px #00bbff, duration/target/date 20px white in 3 columns; in-ride panel: black bg, yellow #ffff00 20px text.

**Settings** (`SettingsScreen`): platform preference-list look: white page, black titles, grey summary, check boxes / dialogs; keep simple (colours not defined in res). Labels from strings: "Enable automatic log", unit system, Weight, FTP, W', Countdown, Smoothing, MO2 visibility, Club, Structured workouts, App version.

## 12. Unknowns - confirm with screenshots
- Platform default `<Button>` look (START/PAUSE/STOP/LAP, Go) and platform dialog/preference styling: depends on the Android version; not in res.
- Row alternation `matches_even_color`/`matches_odd_color` (#0a4141/#0a2841) and zone-row tinting: referenced nowhere in res, so set in Java (likely lap/log/zone list adapters); also unknown which of the 8 fills maps to which zone, and whether `gradient_box*`/`fade_red` are used (probably chart/bar overlays).
- Runtime colouring of the Power/HR/Cadence value strips (zone-coloured background?), connected-sensor button states (`round_border_button_on/off`), button text colours.
- Graph styling (androidplot `APDefacto` style: transparent border, 1dp grid, 13-15sp labels; series colours from Java), map pins, run.png contents, `main_activity_old.xml`, `endo.xml` layouts, orientation-landscape variants, dark-mode (`values-night` only AppCompat).
- Whether the cyan page strips on the home tiles have pressed states (default selector ripple assumed).
