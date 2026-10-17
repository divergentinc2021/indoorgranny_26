# Granny Gear riders portal — design (phase 2)

Date: 2026-10-17. New repo `divergentinc2021/indoorgranny_26-portal` (MIT). This document is written in the app repo and is copied into the portal repo as its first commit. Companion: `2026-10-17-class-mode-and-polish-design.md` (app side) — section 7 below lists the app changes the portal requires.

## 1. Intent

The vendor app stored riders, activities and classes on selfloops.com. Phase 1 replaced the ride app; riders live only on each phone and rides only in that phone's IndexedDB. The portal is the studio's back office that replaces SelfLoops for Granny Gear (Cadence Tygervalley): the owner manages riders, uploads or e-mails class plans, sees every ride, and rides flow on to Strava.

Reference the owner already knows: the SelfLoops team page (`/team/tygervalley`: team header with city / website / join code, tabs Classes (weekly calendar) and Coaches, members' activities elsewhere). We keep that mental model with the Granny Gear look, stripped to indoor cycling.

## 2. Goals / non-goals / anti-goals

**Goals**
- Riders are managed in one place (add / edit / deactivate, CSV import with preview, CSV export) with the same profile fields the app and SelfLoops use.
- The app pulls the rider list and class plans from the portal and pushes every saved ride (summary + FIT) to it, using a studio join code, with no rider passwords.
- Class plans arrive two ways: the owner cc's `laurent+workout@divergentbiz.com` with a `.seconds` attachment (primary), or uploads the file in the portal (backup). Either way the plan appears in the app's "Class plans" list, dated from its title, editable in the portal (title, dates, interval names / durations / zones).
- Every ride is stored on Cloudflare (D1 row + FIT in R2), listed per rider and per day, downloadable, and uploaded to Strava automatically for riders who connected Strava.
- Staff sign-in by e-mail one-time code; no third-party mail provider.

**Non-goals**
- No member self-service login in this phase. Riders see their own rides in the app's Logs, which merges this phone's rides with the rider's rides held by the portal (studio phones are shared, so a rider's history must follow the rider, not the device). A browser member view is a later phase.
- No payments, bookings or class attendance.
- No trainer control, no live telemetry.

**Anti-goals**
- Rider PII readable without a credential (the join code is a credential, held in the app's settings, rotatable by the owner).
- A ride lost because the phone was offline: the app queues and retries; the portal de-duplicates by `(riderId, startMs)`.
- Strava tokens in logs, in the client, or in git.

## 3. Constraints

- Cloudflare account **divergentbiz** (`7ad30a1a3e8b2d10900133e234c03948`). Pages project `indoorgranny-portal`, git-connected via the API (never `wrangler pages project create`), production branch `main`, URL `https://indoorgranny-portal.pages.dev` (custom domain later when the owner has one on Cloudflare). D1 database `indoorgranny`, R2 bucket `indoorgranny-activities`. Free tier: watch D1 writes and the 10 ms CPU cap in Functions; never parse FIT server-side beyond the header.
- Build order: the app's class-mode work lands first and owns the class-plan parser, its fixture and its test numbers; the portal copies `src/engine/classplan.ts` + tests + fixture from the app repo at a named commit, and its plan-ingestion tasks are scheduled last so everything else (auth, riders, CSV, activities, Strava) can start in parallel. The enrolment QR encodes an `app_url` studio setting (default `https://indoorgranny-26.pages.dev/`), which serves nothing until `phase1-pwa-parity` is merged — merging is a release step of this phase.
- Stack: Vite 6 + React 19 + TypeScript + Tailwind 3.4 + Zustand (same as the app, so tokens and the class-plan parser are copied verbatim); Pages Functions (`functions/api/**`) for the API; Vitest for unit tests; `wrangler d1` migrations in `migrations/`. Modern browsers only (no Chrome 81 rule here).
- `divergentbiz.com` mail is Google Workspace (MX `aspmx.l.google.com`, verified 2026-10-17), so `laurent+workout@divergentbiz.com` lands in that inbox and `GmailApp` sends from it. Mail out (OTP codes, Strava-connect links) and mail in (`.seconds` attachments) go through **one Apps Script on laurent@divergentbiz.com** (`gas/Code.gs`, clasp project, Google account laurent@divergentbiz.com): `doPost` sends mail on request from the portal (shared bearer `GAS_SECRET`, fail-open until set on both sides per the house rule), and a 5-minute time trigger scans Gmail for `.seconds` attachments and posts them to the portal. No DNS changes, no new provider.
- Strava: the owner (or Laurent) registers an API application at strava.com/settings/api with callback domain `indoorgranny-portal.pages.dev`; client id/secret become Pages secrets. New Strava apps are capped at one connected athlete until Strava approves the app — the portal must say so on the Strava page and the flow must work for that one athlete first.
- Licence MIT at repo creation. Tests, tsc and build green per task. UTF-8 explicit when scripting on Windows.

## 4. Data model (D1, `migrations/0001_init.sql`)

```
studio(id TEXT PK, name, join_code TEXT UNIQUE, city, website, created_at)        -- one row: 'gg'
staff(email TEXT PK, role TEXT CHECK(role IN ('owner','coach','admin')), name, created_at)
riders(id TEXT PK, studio_id, name, email, weight_kg REAL, ftp_w INT, cp_w INT NULL, wprime_kj REAL,
       hr_max INT, birth_year INT NULL, sex TEXT NULL, power_zones_json TEXT NULL, active INT DEFAULT 1,
       strava_athlete_id INT NULL, created_at, updated_at)
class_plans(id TEXT PK, studio_id, title, dates_json, intervals_json, total_s INT, source TEXT,  -- 'email'|'upload'|'manual'
            file_key TEXT NULL, created_at, updated_at)
activities(id TEXT PK, studio_id, rider_id, start_ms INT, duration_s INT, distance_m REAL, kj REAL, kcal INT,
           avg_power INT, avg_hr INT, max_hr INT, avg_cad INT, laps INT, plan_id TEXT NULL, plan_title TEXT NULL,
           fit_key TEXT, fit_bytes INT, device TEXT, strava_activity_id INT NULL, strava_status TEXT NULL,
           created_at, UNIQUE(rider_id, start_ms))
strava_tokens(rider_id TEXT PK, access_token, refresh_token, expires_at INT, scope, updated_at)
otp(email TEXT PK, code_hash, expires_at INT, attempts INT)
sessions(token TEXT PK, email, expires_at INT)
ingest_log(id INTEGER PK, kind, ref, status, detail, created_at)                   -- mail ingest + strava upload trail
```

`intervals_json` is the app's `ClassInterval[]` (`name, displayName, durationS, zone`). `dates_json` is `string[]` of ISO days. Rider ids are the app's existing rider ids where the app created them (`r_<ms>`), else `r_<uuid>` from the portal; the app keeps local riders that the portal does not know and shows them as "local only".

## 5. API (Pages Functions, JSON, `functions/api/`)

Two credentials:
- **Studio key** — header `X-Studio-Key: <join_code>` for the app. Read riders and plans, write activities. Rotating the code in the portal invalidates old phones until they enter the new one.
- **Staff session** — cookie `gg_sess` (HttpOnly, SameSite=Lax, 24 h) after e-mail OTP. Everything else.

App endpoints (studio key):
- `GET /api/app/riders` → `{ riders: [...] , updatedAt }` (active riders, public fields only: id, name, weightKg, ftpW, cpW, wprimeKj, hrMax, powerZones; no e-mail). `powerZones` is the app's existing `[name, lowerW][]` override (vendor parity); null means the 7 Coggan zones from FTP. Units are a device setting in the app (vendor parity) and are **not** a rider field.
- `GET /api/app/activities?rider=:id&limit=100` → the rider's activities (summary rows, newest first) so a shared phone shows the rider's history; `GET /api/app/activities/:id/fit` (studio key) streams the FIT for rows this phone does not hold.
- `PUT /api/app/riders/:id/self` `{weightKg?, ftpW?, cpW?, wprimeKj?, hrMax?}` — the only rider fields the app may change.
- `GET /api/app/classplans?from=YYYY-MM-DD` → plans dated from that day on, plus undated ones; `GET /api/app/classplans/:id`.
- `POST /api/app/activities` multipart: `summary` (JSON, the app's `SessionRecord` plus `laps` summary) and `fit` (bytes). Upsert on `(riderId, startMs)`; stores FIT at R2 key `fit/<riderId>/<startMs>.fit`; returns `{ id, stravaQueued: boolean }`; enqueues Strava upload when the rider has tokens. 10 MB cap. Idempotent so the app can retry.

Staff endpoints (session):
- `POST /api/auth/request` `{email}` → if `email` is in `staff`, generate a 5-char code, hash it into `otp`, ask the Apps Script to send it; always answer 204 (no account enumeration). `POST /api/auth/verify` `{email, code}` → session cookie; 5 attempts then the code dies. `POST /api/auth/logout`.
- `GET/POST/PUT/DELETE /api/riders[/:id]`, `POST /api/riders/import` (CSV text → `{preview:[{row, action:'create'|'update'|'skip', errors}]}` when `?dry=1`, else apply), `GET /api/riders/export.csv`.
- `GET/POST/PUT/DELETE /api/classplans[/:id]`, `POST /api/classplans/upload` (multipart `.seconds` → parsed plans with the app's parser, which derives `id = identifier:slug(title)`; duplicates are skipped by `id`, and a plan with a different id but an identical title is reported as a probable duplicate, not inserted twice).
- `GET /api/activities?rider=&from=&to=`, `GET /api/activities/:id/fit` (R2 stream, `Content-Disposition` with the same `GrannyGear_…` name the app uses), `DELETE /api/activities/:id`, `POST /api/activities/:id/strava` (retry upload).
- `GET /api/strava/connect?rider=:id` → 302 to Strava OAuth with `state` = signed rider id; `GET /api/strava/callback` stores tokens, marks the rider, shows a plain "Connected — you can close this" page. `POST /api/strava/link` `{rider}` → asks the Apps Script to e-mail the connect link to the rider's e-mail (the rider must authorise on their own device). `DELETE /api/strava/:rider` disconnects.
- `GET /api/studio`, `PUT /api/studio` (name, city, website, rotate join code), `GET /api/health` (D1 ping, R2 ping, last mail ingest time, Strava queue depth; no secrets).

Machine endpoints (shared bearer `GAS_SECRET`, from the Apps Script):
- `POST /api/ingest/seconds` multipart `file` + `meta` `{messageId, from, subject, receivedAt}` → accepted only when `from` is a `staff` e-mail; parses, inserts plans not already present by `id`, logs to `ingest_log`, returns `{added:[titles], skipped:[titles]}`.
- `POST /api/outbox/ack` is **not** needed: mail sending is request/response (portal → Apps Script `doPost` → `GmailApp.sendEmail`), so there is no outbox table.

Strava upload: `POST https://www.strava.com/api/v3/uploads` with `data_type=fit`, `name` = plan title or "Granny Gear class", `trainer=1`, `sport_type=VirtualRide`; refresh tokens when `expires_at` is within 5 minutes; poll `/uploads/:id` from a Pages Function cron (`functions/_scheduled` is not available on Pages, so use a tiny companion Worker `strava-poller` with a `*/5` cron **or** poll lazily when the activity list is opened). Decision: lazy poll on list open plus a "Check Strava" button — no extra Worker in this phase.

## 6. Portal UI (React, phone-usable, Granny Gear look: navy `#093c64` header, cyan `#00bbff` accents, white cards, Roboto)

Pages: `/login` (e-mail → code), `/` dashboard (today's plan, last 10 rides, rider count, health line "mail checked N min ago"), `/riders` (table, search, Add, Import CSV with preview step, Export, per-rider drawer with fields + Strava status + "Send Strava link" + rides), `/plans` (list by date, Upload `.seconds`, editor: title, dates, interval table with name / duration / zone select and live total, add / remove / reorder rows), `/activities` (filter by rider and date range, Download FIT, Strava status badge, Retry), `/studio` (name, city, website, join code with Rotate, staff list add/remove, Strava app status, health).

Join code is shown as big text and a QR of `<app_url>?studio=<code>` so a phone can be enrolled by scanning (the app reads `?studio=` once and stores it).

## 7. App changes required (in `indoorgranny_26`, after the portal API exists)

- Settings → "Studio" item: join code field (prefilled from `?studio=`), portal URL constant, "Sync now", last-sync line.
- Riders: `useRiders` merges portal riders (authoritative for shared fields, including `powerZones`) with local ones; portal riders are read-only in the app except weight/FTP/CP/W′/HRmax edits, which are sent back with `PUT /api/app/riders/:id/self`. `Rider.email` becomes optional in the app.
- Logs: the disabled Upload button becomes live: on Save the app posts the activity; failures queue in IndexedDB `outbox` and retry on app open / every 60 s while online; row shows "Uploaded ✓ / Queued / Failed". Logs also fetches the selected rider's activities from the portal and merges them with local rows by `startMs` (remote rows that are not on this phone show a cloud mark; Download FIT for those streams from the portal).
- Class plans: `loadRemote()` from `GET /api/app/classplans?from=<today-7d>` on Workouts open and Training mount, merged with bundled/imported; portal plans win on id.
- `SessionRecord.planId/planTitle` already added by the class-mode design.

## 8. Operations

- Secrets (Pages): `GAS_SECRET`, `GAS_URL`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `SESSION_SECRET`. Set with `wrangler pages secret put` on the personal profile after `whoami` shows `7ad30a1a…`; persist the refreshed profile back to `config-personal/`.
- Apps Script: project on laurent@divergentbiz.com (personal clasp login). Properties: `PORTAL_URL`, `PORTAL_SECRET`, `SEARCH_QUERY` (`has:attachment filename:seconds newer_than:7d -label:gg-ingested`). Trigger: `scanInbox` every 5 minutes; labels processed messages `gg-ingested`. `doPost` actions: `sendOtp`, `sendStravaLink`, `ping`. `clasp push` is free; one `clasp deploy` for the web app URL.
- Seed: `migrations/0002_seed.sql` inserts studio `gg` ("Granny Gear — Cadence Tygervalley", Cape Town, join code generated at deploy and printed once) and staff `laurent@divergentbiz.com` (admin); the owner's e-mail is added from `/studio` after first login.
- Health and failure visibility follow the Medic pattern in spirit (health endpoint, ingest log with the last mail seen), without the client-side Fix-it card.

## 9. Left to the builder

- CSV column names and aliases (must accept the SelfLoops export headers the owner may have; include `name,email,weight,ftp,cp,wprime,hrmax,birthyear,sex` plus optional `zones` as seven `;`-separated lower bounds in watts, and tolerate case/spacing).
- QR generation library (small, client-side).
- Exact OTP mail copy and the Strava-link mail copy.
- Table/drawer component details, as long as the pages above exist and work at phone width.
- Whether to copy the class-plan parser as a file or publish a tiny shared package; copying is acceptable for this phase.
