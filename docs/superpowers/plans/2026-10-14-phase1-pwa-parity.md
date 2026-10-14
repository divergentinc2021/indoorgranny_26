# Phase 1 PWA Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, installable web app that pairs BLE sensors, runs a ride with the vendor app's tiles, laps, zones and W'bal, stores sessions locally and exports FIT.

**Architecture:** Pure TypeScript modules for sensor parsing and ride maths (no React imports), a `LiveStore` fed by a Web Bluetooth adapter behind a `SensorSource` interface, a 1 Hz `RideEngine` that samples the store, Zustand stores bridging engine to React screens, IndexedDB for history, `@garmin/fitsdk` for export. Deployed from GitHub to Cloudflare Pages on the divergentbiz account.

**Tech Stack:** Vite 6, TypeScript 5, React 19, react-router-dom 7, Zustand 5, Tailwind 3.4, Chart.js 4, idb 8, @garmin/fitsdk, vite-plugin-pwa, Vitest 3, @testing-library/react, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-14-phase1-pwa-parity-design.md`

## Global Constraints

- Build target `chrome81` (`build.target: 'chrome81'` in `vite.config.ts`); no Tailwind 4, no CSS or JS feature newer than Chrome 81 in the shipped bundle.
- Engine (`src/engine/**`) and parsers (`src/sensors/ble/parse/**`, `src/sensors/ble/derive.ts`) import nothing from React or the DOM.
- Parsers return `null` on malformed input, never throw.
- Vendor formulas verbatim (spec §5); the one deviation is W'bal CP = rider `cpW` (fallback FTP).
- Fonts Poppins (headings) + Inter (body) via `<link>` in `index.html`, never CSS `@import`.
- Licence MIT; third-party licences listed in `THIRD_PARTY.md`.
- Cloudflare Pages project `indoorgranny-26`, account `7ad30a1a3e8b2d10900133e234c03948`, git-connected, production branch `main`, build `npm run build`, output `dist`.
- Commit after every task with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- All commands run from Git Bash (PowerShell is at Restricted policy on this machine; `npm`/`npx` fail there).

## Review Focus

1. A BLE packet shorter than its flags promise (e.g. CPS flags claim crank data, 4 bytes long) — parser returns `null`, tile keeps last value. Pinned in Task 2.
2. A CSC/CPS packet repeated with identical counters (Δt = 0) or a 16-bit time rollover — no divide-by-zero, no negative speed, rollover handled. Pinned in Task 3.
3. Ride paused while a sensor disconnects and reconnects — elapsed excludes the pause, samples during the pause are not written, averages unaffected. Pinned in Task 8.
4. Rider record without `cpW`/`powerZones` — zones from FTP, W'bal CP = FTP; FTP missing entirely → 250 as the vendor did. Pinned in Tasks 4 and 5.
5. Session stopped with zero samples (Start then immediate Stop) — Discard path deletes nothing it did not write; Save path writes a session with `nSamples: 0` and FIT export still produces a valid file with no Record messages. Pinned in Tasks 10 and 11.

---

### Task 1: Project scaffold, deployed hello page

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `public/_redirects`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `.gitignore`, `THIRD_PARTY.md`, `src/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test`, deployed URL `https://indoorgranny-26.pages.dev`.

- [ ] **Step 1: Initialise package and install dependencies**

```bash
cd /d/INDOORCycling/indoorgranny_26
npm init -y >/dev/null
npm pkg set name=indoorgranny_26 version=0.1.0 private=true type=module license=MIT
npm pkg set scripts.dev=vite scripts.build="tsc -b && vite build" scripts.preview="vite preview" scripts.test="vitest run" scripts.test:watch=vitest
npm i react@19 react-dom@19 react-router-dom@7 zustand@5 idb@8 chart.js@4 @garmin/fitsdk
npm i -D vite@6 @vitejs/plugin-react@4 typescript@5 @types/react@19 @types/react-dom@19 tailwindcss@3.4 postcss autoprefixer vite-plugin-pwa@0.21 vitest@3 jsdom @testing-library/react @testing-library/jest-dom fake-indexeddb @types/web-bluetooth
node -e "const m=require('@garmin/fitsdk'); if(!m.Encoder) { console.error('NO Encoder in @garmin/fitsdk — STOP and report'); process.exit(1) } console.log('fitsdk Encoder ok', require('@garmin/fitsdk/package.json').version)"
```

Expected last line: `fitsdk Encoder ok 21.x.y`. If it prints `NO Encoder`, stop and report; Task 11 depends on it.

- [ ] **Step 2: Config files**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Granny Gear Indoor Cycling',
        short_name: 'IndoorGranny',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  build: { target: 'chrome81' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
});
```

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "web-bluetooth", "vite-plugin-pwa/client"],
    "noEmit": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`: `{"compilerOptions":{"module":"ESNext","moduleResolution":"bundler","types":["node"]},"include":["vite.config.ts"]}` and add `"references":[{"path":"./tsconfig.node.json"}]` to `tsconfig.json`.

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { heading: ['Poppins', 'sans-serif'], body: ['Inter', 'sans-serif'] },
      colors: {
        gg: { bg: '#111111', panel: '#1c1c1c', line: '#2e2e2e', text: '#f2f2f2', muted: '#9a9a9a', accent: '#f28c1b' },
        zone: { z1: '#8fd3c7', z2: '#2ecc71', z3: '#f1c40f', z4: '#e67e22', z5: '#e74c3c', z6: '#8e44ad', z7: '#2c3e50' },
      },
    },
  },
  plugins: [],
};
```

`postcss.config.js`: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
html, body, #root { height: 100%; }
body { @apply bg-gg-bg text-gg-text font-body; }
h1, h2, h3 { @apply font-heading; }
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Inter:wght@400;500;600&display=swap" />
    <title>Granny Gear Indoor Cycling</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 13):
```tsx
export default function App() {
  return <main className="p-4"><h1 className="text-2xl">Granny Gear Indoor Cycling</h1><p>Phase 1 scaffold.</p></main>;
}
```

`src/vite-env.d.ts`: `/// <reference types="vite/client" />`

`public/_redirects`: `/*    /index.html   200`

Icons: generate two placeholder PNGs (orange square, replaced by brand icons later):
```bash
node -e "
const z=require('zlib');function png(n){const raw=Buffer.alloc((n*3+1)*n);for(let y=0;y<n;y++){raw[y*(n*3+1)]=0;for(let x=0;x<n;x++){const o=y*(n*3+1)+1+x*3;raw[o]=0xf2;raw[o+1]=0x8c;raw[o+2]=0x1b}}const crc=b=>{let c=~0;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1))}return(~c)>>>0};const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};const ih=Buffer.alloc(13);ih.writeUInt32BE(n,0);ih.writeUInt32BE(n,4);ih[8]=8;ih[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',z.deflateSync(raw)),ch('IEND',Buffer.alloc(0))])}
require('fs').mkdirSync('public/icons',{recursive:true});require('fs').writeFileSync('public/icons/icon-192.png',png(192));require('fs').writeFileSync('public/icons/icon-512.png',png(512));console.log('icons ok')"
```

`.gitignore`: `node_modules\ndist\ndev-dist\n.wrangler\n`

`THIRD_PARTY.md`:
```md
# Third-party licences
- @garmin/fitsdk — Garmin FIT SDK licence (https://developer.garmin.com/fit/download/), permits use in applications.
- React, react-router-dom, Zustand, idb, Chart.js, Tailwind CSS, Vite, vite-plugin-pwa — MIT.
```

- [ ] **Step 3: Smoke test**

`src/smoke.test.ts`:
```ts
describe('toolchain', () => {
  it('runs vitest with jsdom and fake-indexeddb', () => {
    expect(typeof indexedDB).toBe('object');
    expect(document.createElement('div')).toBeTruthy();
  });
});
```

Run: `npm test` → Expected: 1 passed. Run: `npm run build` → Expected: `dist/` with `index.html`, `sw.js`, `manifest.webmanifest`.

- [ ] **Step 4: Create GitHub repo and push**

```bash
cd /d/INDOORCycling/indoorgranny_26
git add -A && git commit -m "chore: Vite + React + Tailwind 3.4 + PWA scaffold, chrome81 target

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
gh repo create divergentinc2021/indoorgranny_26 --public --source=. --remote=origin --description "Granny Gear indoor cycling studio PWA" --push
```

- [ ] **Step 5: Create the Cloudflare Pages project git-connected (divergentbiz account)**

Switch wrangler to the personal profile and verify the account id, then create via API (never `wrangler pages project create`, which makes a direct-upload project that can never auto-deploy):

```bash
W="$APPDATA/xdg.config/.wrangler"; cp "$W/config-personal/default.toml" "$W/config/default.toml"
npx wrangler whoami | grep -q 7ad30a1a3e8b2d10900133e234c03948 && echo ACCOUNT_OK
TOK=$(grep -E '^oauth_token' "$W/config/default.toml" | sed -E 's/.*"([^"]+)".*/\1/')
curl -s -X POST -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/7ad30a1a3e8b2d10900133e234c03948/pages/projects" \
  -d '{"name":"indoorgranny-26","production_branch":"main","source":{"type":"github","config":{"owner":"divergentinc2021","repo_name":"indoorgranny_26","production_branch":"main","pr_comments_enabled":true,"deployments_enabled":true,"production_deployments_enabled":true,"preview_deployment_setting":"all"}},"build_config":{"build_command":"npm run build","destination_dir":"dist","root_dir":""}}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log('success',d.success,d.result&&d.result.subdomain,JSON.stringify(d.errors))})"
```

Expected: `success true indoorgranny-26.pages.dev []`. If the GitHub source is rejected (code 8000xxx about installation), the Cloudflare GitHub app needs access to this repo: open https://github.com/apps/cloudflare-workers-and-pages/installations and add `indoorgranny_26`, then re-run the curl.

Trigger the first build with an empty commit push and wait:
```bash
git commit --allow-empty -m "ci: first Pages build" && git push
sleep 90; curl -s -o /dev/null -w "%{http_code}\n" https://indoorgranny-26.pages.dev/
```
Expected: `200`. Open the URL on the Nothing Phone in Chrome; "Add to Home screen" must be offered.

---

### Task 2: BLE characteristic parsers (HR, CSC, CPS, FTMS)

**Files:**
- Create: `src/sensors/ble/uuids.ts`, `src/sensors/ble/parse/hr.ts`, `src/sensors/ble/parse/csc.ts`, `src/sensors/ble/parse/cps.ts`, `src/sensors/ble/parse/ftms.ts`
- Test: `src/sensors/ble/parse/parse.test.ts`

**Interfaces:**
- Produces:
  - `parseHeartRate(dv: DataView): { bpm: number; contact: boolean | null; rrMs: number[] } | null`
  - `parseCsc(dv: DataView): { wheelRevs?: number; wheelTime1024?: number; crankRevs?: number; crankTime1024?: number } | null`
  - `parseCyclingPower(dv: DataView): { watts: number; balancePctRight?: number; wheelRevs?: number; wheelTime2048?: number; crankRevs?: number; crankTime1024?: number } | null`
  - `parseIndoorBikeData(dv: DataView): { speedKmh?: number; cadenceRpm?: number; distanceM?: number; powerW?: number; kcalTotal?: number; hrBpm?: number; elapsedS?: number } | null`
  - `UUIDS` constants.

- [ ] **Step 1: Write failing tests**

`src/sensors/ble/parse/parse.test.ts`:
```ts
import { parseHeartRate } from './hr';
import { parseCsc } from './csc';
import { parseCyclingPower } from './cps';
import { parseIndoorBikeData } from './ftms';

const dv = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);

describe('parseHeartRate 0x2A37', () => {
  it('reads uint8 HR with no contact info', () => {
    expect(parseHeartRate(dv(0x00, 72))).toEqual({ bpm: 72, contact: null, rrMs: [] });
  });
  it('reads uint16 HR, contact detected, energy skipped, two RR intervals', () => {
    // flags: bit0=1 (u16), bits1-2=11 (contact supported+detected), bit3=1 energy, bit4=1 RR
    const r = parseHeartRate(dv(0x1f, 0x2c, 0x01, 0x10, 0x27, 0x00, 0x04, 0x33, 0x03));
    expect(r).toEqual({ bpm: 300, contact: true, rrMs: [1000, 800] });
  });
  it('returns null on empty or truncated packets', () => {
    expect(parseHeartRate(dv())).toBeNull();
    expect(parseHeartRate(dv(0x01, 0x2c))).toBeNull();
  });
});

describe('parseCsc 0x2A5B', () => {
  it('wheel + crank present', () => {
    const r = parseCsc(dv(0x03, 0x10, 0x27, 0x00, 0x00, 0x00, 0x04, 0x64, 0x00, 0x00, 0x08));
    expect(r).toEqual({ wheelRevs: 10000, wheelTime1024: 1024, crankRevs: 100, crankTime1024: 2048 });
  });
  it('crank only — fields start at offset 1 (vendor bug fixed)', () => {
    expect(parseCsc(dv(0x02, 0x64, 0x00, 0x00, 0x08))).toEqual({ crankRevs: 100, crankTime1024: 2048 });
  });
  it('returns null when flags promise more bytes than present', () => {
    expect(parseCsc(dv(0x03, 0x10, 0x27))).toBeNull();
  });
});

describe('parseCyclingPower 0x2A63', () => {
  it('power only', () => {
    expect(parseCyclingPower(dv(0x00, 0x00, 0xfa, 0x00))).toEqual({ watts: 250 });
  });
  it('balance + crank revolution data', () => {
    // flags 0x0021: bit0 balance present, bit5 crank data
    const r = parseCyclingPower(dv(0x21, 0x00, 0x2c, 0x01, 0x64, 0x05, 0x00, 0x00, 0x04));
    expect(r).toEqual({ watts: 300, balancePctRight: 50, crankRevs: 5, crankTime1024: 1024 });
  });
  it('negative power is clamped to 0, truncated packet is null', () => {
    expect(parseCyclingPower(dv(0x00, 0x00, 0xff, 0xff))).toEqual({ watts: 0 });
    expect(parseCyclingPower(dv(0x20, 0x00, 0x2c, 0x01))).toBeNull();
  });
});

describe('parseIndoorBikeData 0x2AD2', () => {
  it('KICKR-style packet: speed, cadence, power, distance, hr', () => {
    // flags 0x0254: bit2 cadence, bit4 distance, bit6 power, bit9 hr; bit0=0 so speed present
    const r = parseIndoorBikeData(dv(0x54, 0x02, 0x10, 0x0a, 0xb4, 0x00, 0xe8, 0x03, 0x00, 0xc8, 0x00, 0x8c));
    expect(r).toEqual({ speedKmh: 25.76, cadenceRpm: 90, distanceM: 1000, powerW: 200, hrBpm: 140 });
  });
  it('more-data packet without speed, with kcal and elapsed', () => {
    // flags 0x0901: bit0=1 (no speed), bit8 energy, bit11 elapsed
    const r = parseIndoorBikeData(dv(0x01, 0x09, 0x2c, 0x01, 0x90, 0x01, 0x05, 0x3c, 0x00));
    expect(r).toEqual({ kcalTotal: 300, elapsedS: 60 });
  });
  it('returns null on truncation', () => {
    expect(parseIndoorBikeData(dv(0x54, 0x02, 0x10))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/sensors/ble/parse` → Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/sensors/ble/uuids.ts`:
```ts
export const UUIDS = {
  HR_SERVICE: 0x180d, HR_MEASUREMENT: 0x2a37,
  CSC_SERVICE: 0x1816, CSC_MEASUREMENT: 0x2a5b,
  CPS_SERVICE: 0x1818, CPS_MEASUREMENT: 0x2a63,
  FTMS_SERVICE: 0x1826, FTMS_INDOOR_BIKE: 0x2ad2,
} as const;
export const ALL_SERVICES = [UUIDS.HR_SERVICE, UUIDS.CSC_SERVICE, UUIDS.CPS_SERVICE, UUIDS.FTMS_SERVICE];
```

`src/sensors/ble/parse/hr.ts`:
```ts
export interface HeartRateReading { bpm: number; contact: boolean | null; rrMs: number[] }

export function parseHeartRate(dv: DataView): HeartRateReading | null {
  if (dv.byteLength < 2) return null;
  const flags = dv.getUint8(0);
  const u16 = (flags & 0x01) !== 0;
  let o = 1;
  if (dv.byteLength < o + (u16 ? 2 : 1)) return null;
  const bpm = u16 ? dv.getUint16(o, true) : dv.getUint8(o);
  o += u16 ? 2 : 1;
  const contactSupported = (flags & 0x04) !== 0;
  const contact = contactSupported ? (flags & 0x02) !== 0 : null;
  if (flags & 0x08) { if (dv.byteLength < o + 2) return null; o += 2; }
  const rrMs: number[] = [];
  if (flags & 0x10) {
    while (o + 2 <= dv.byteLength) { rrMs.push(Math.round((dv.getUint16(o, true) * 1000) / 1024)); o += 2; }
  }
  return { bpm, contact, rrMs };
}
```

`src/sensors/ble/parse/csc.ts`:
```ts
export interface CscReading { wheelRevs?: number; wheelTime1024?: number; crankRevs?: number; crankTime1024?: number }

export function parseCsc(dv: DataView): CscReading | null {
  if (dv.byteLength < 1) return null;
  const flags = dv.getUint8(0);
  let o = 1;
  const r: CscReading = {};
  if (flags & 0x01) {
    if (dv.byteLength < o + 6) return null;
    r.wheelRevs = dv.getUint32(o, true); r.wheelTime1024 = dv.getUint16(o + 4, true); o += 6;
  }
  if (flags & 0x02) {
    if (dv.byteLength < o + 4) return null;
    r.crankRevs = dv.getUint16(o, true); r.crankTime1024 = dv.getUint16(o + 2, true); o += 4;
  }
  return r;
}
```

`src/sensors/ble/parse/cps.ts`:
```ts
export interface CyclingPowerReading {
  watts: number; balancePctRight?: number;
  wheelRevs?: number; wheelTime2048?: number; crankRevs?: number; crankTime1024?: number;
}

export function parseCyclingPower(dv: DataView): CyclingPowerReading | null {
  if (dv.byteLength < 4) return null;
  const flags = dv.getUint16(0, true);
  const r: CyclingPowerReading = { watts: Math.max(0, dv.getInt16(2, true)) };
  let o = 4;
  const need = (n: number) => { if (dv.byteLength < o + n) throw new RangeError('short'); };
  try {
    if (flags & 0x0001) { need(1); r.balancePctRight = dv.getUint8(o) / 2; o += 1; }
    if (flags & 0x0004) { need(2); o += 2; }                               // accumulated torque
    if (flags & 0x0010) { need(6); r.wheelRevs = dv.getUint32(o, true); r.wheelTime2048 = dv.getUint16(o + 4, true); o += 6; }
    if (flags & 0x0020) { need(4); r.crankRevs = dv.getUint16(o, true); r.crankTime1024 = dv.getUint16(o + 2, true); o += 4; }
  } catch { return null; }
  return r;
}
```

`src/sensors/ble/parse/ftms.ts`:
```ts
export interface IndoorBikeReading {
  speedKmh?: number; cadenceRpm?: number; distanceM?: number; powerW?: number;
  kcalTotal?: number; hrBpm?: number; elapsedS?: number;
}

export function parseIndoorBikeData(dv: DataView): IndoorBikeReading | null {
  if (dv.byteLength < 2) return null;
  const f = dv.getUint16(0, true);
  const r: IndoorBikeReading = {};
  let o = 2;
  const need = (n: number) => { if (dv.byteLength < o + n) throw new RangeError('short'); };
  try {
    if ((f & 0x0001) === 0) { need(2); r.speedKmh = dv.getUint16(o, true) / 100; o += 2; }
    if (f & 0x0002) { need(2); o += 2; }                                            // avg speed
    if (f & 0x0004) { need(2); r.cadenceRpm = dv.getUint16(o, true) / 2; o += 2; }
    if (f & 0x0008) { need(2); o += 2; }                                            // avg cadence
    if (f & 0x0010) { need(3); r.distanceM = dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getUint8(o + 2) << 16); o += 3; }
    if (f & 0x0020) { need(2); o += 2; }                                            // resistance
    if (f & 0x0040) { need(2); r.powerW = Math.max(0, dv.getInt16(o, true)); o += 2; }
    if (f & 0x0080) { need(2); o += 2; }                                            // avg power
    if (f & 0x0100) { need(5); r.kcalTotal = dv.getUint16(o, true); o += 5; }      // total, per hour, per minute
    if (f & 0x0200) { need(1); r.hrBpm = dv.getUint8(o); o += 1; }
    if (f & 0x0400) { need(1); o += 1; }                                            // MET
    if (f & 0x0800) { need(2); r.elapsedS = dv.getUint16(o, true); o += 2; }
  } catch { return null; }
  return r;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/sensors/ble/parse` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sensors && git commit -m "feat(sensors): BLE HR, CSC, CPS and FTMS indoor-bike parsers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Derived speed/cadence with rollover and stale-to-zero

**Files:**
- Create: `src/sensors/ble/derive.ts`
- Test: `src/sensors/ble/derive.test.ts`

**Interfaces:**
- Produces: `class RevCounter { constructor(opts: { timeHz: number; revBits: 16 | 32; staleMs?: number }); push(revs: number, time: number, nowMs: number): number | null; value(nowMs: number): number }` — returns revolutions per second from the last two events, `null` when Δt is 0 (duplicate packet); `value()` returns the last rate or 0 when stale (default 5000 ms).
- `speedMs(revPerSec: number, circumferenceMm: number): number`, `cadenceRpm(revPerSec: number): number`.

- [ ] **Step 1: Failing tests**

`src/sensors/ble/derive.test.ts`:
```ts
import { RevCounter, speedMs, cadenceRpm } from './derive';

describe('RevCounter', () => {
  it('first packet yields null, second yields rate', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 32 });
    expect(c.push(100, 0, 0)).toBeNull();
    expect(c.push(102, 1024, 1000)).toBeCloseTo(2, 5);      // 2 revs in 1 s
  });
  it('duplicate packet (Δt=0) yields null and keeps last value', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 32 });
    c.push(0, 0, 0); c.push(1, 1024, 1000);
    expect(c.push(1, 1024, 1200)).toBeNull();
    expect(c.value(1500)).toBeCloseTo(1, 5);
  });
  it('handles 16-bit time and rev rollover', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 16 });
    c.push(65534, 65000, 0);
    expect(c.push(1, 488, 1000)).toBeCloseTo(3 / (1024 / 1024), 5);   // 3 revs, Δt=1024 ticks
  });
  it('goes stale to zero after staleMs', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 32, staleMs: 5000 });
    c.push(0, 0, 0); c.push(1, 1024, 1000);
    expect(c.value(5999)).toBeCloseTo(1, 5);
    expect(c.value(6001)).toBe(0);
  });
});

describe('conversions', () => {
  it('speed from wheel rev/s and circumference', () => { expect(speedMs(5, 2000)).toBeCloseTo(10, 6); });
  it('cadence from crank rev/s', () => { expect(cadenceRpm(1.5)).toBe(90); });
});
```

- [ ] **Step 2: Run** `npx vitest run src/sensors/ble/derive` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/sensors/ble/derive.ts`:
```ts
export interface RevCounterOpts { timeHz: number; revBits: 16 | 32; staleMs?: number }

export class RevCounter {
  private lastRevs: number | null = null;
  private lastTime = 0;
  private lastAt = 0;
  private rate = 0;
  private readonly revMod: number;
  private readonly staleMs: number;
  constructor(private readonly o: RevCounterOpts) {
    this.revMod = o.revBits === 16 ? 0x10000 : 0x100000000;
    this.staleMs = o.staleMs ?? 5000;
  }
  push(revs: number, time: number, nowMs: number): number | null {
    if (this.lastRevs === null) { this.lastRevs = revs; this.lastTime = time; this.lastAt = nowMs; return null; }
    const dRev = (revs - this.lastRevs + this.revMod) % this.revMod;
    const dT = (time - this.lastTime + 0x10000) % 0x10000;
    if (dT === 0) return null;
    this.lastRevs = revs; this.lastTime = time; this.lastAt = nowMs;
    this.rate = dRev / (dT / this.o.timeHz);
    return this.rate;
  }
  value(nowMs: number): number { return nowMs - this.lastAt > this.staleMs ? 0 : this.rate; }
}

export const speedMs = (revPerSec: number, circumferenceMm: number) => (revPerSec * circumferenceMm) / 1000;
export const cadenceRpm = (revPerSec: number) => Math.round(revPerSec * 60);
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(sensors): revolution counter with rollover and stale-to-zero`.

---

### Task 4: Smoothing and zones

**Files:**
- Create: `src/engine/smoothing.ts`, `src/engine/zones.ts`
- Test: `src/engine/smoothing.test.ts`, `src/engine/zones.test.ts`

**Interfaces:**
- `class Ema { constructor(n: number); push(x: number): number; value: number }` — running mean until `n` samples, then EMA α = 2/(n+1); `n = 1` passes through.
- `type Zone = { name: string; lowerW: number; upperW: number | null; cls: string }`
- `powerZones(ftpW: number, custom?: [string, number][]): Zone[]` (7 zones)
- `zoneIndex(zones: Zone[], watts: number): number` (0-based)
- `hrBand(pctHrMax: number): 'z1'|'z2'|'z3'|'z4'|'z5'` (≤50, ≤65, ≤75, ≤85, >85)
- `DEFAULT_FTP = 250`

- [ ] **Step 1: Failing tests**

`src/engine/smoothing.test.ts`:
```ts
import { Ema } from './smoothing';
describe('Ema', () => {
  it('n=1 passes values through', () => { const e = new Ema(1); expect(e.push(100)).toBe(100); expect(e.push(50)).toBe(50); });
  it('running mean until n samples, then EMA', () => {
    const e = new Ema(5);
    expect(e.push(100)).toBe(100);
    expect(e.push(200)).toBe(150);
    e.push(300); e.push(400);
    expect(e.push(500)).toBe(300);                           // mean of 5
    expect(e.push(600)).toBeCloseTo(300 + (2 / 6) * 300, 6); // α = 2/(5+1)
  });
});
```

`src/engine/zones.test.ts`:
```ts
import { powerZones, zoneIndex, hrBand, DEFAULT_FTP } from './zones';
describe('powerZones', () => {
  it('builds 7 Coggan zones from FTP 250 matching the vendor table within rounding', () => {
    const z = powerZones(250);
    expect(z.map((x) => x.lowerW)).toEqual([0, 138, 188, 225, 263, 300, 375]);
    expect(z[0].upperW).toBe(137);
    expect(z[6].upperW).toBeNull();
    expect(z.map((x) => x.name)).toEqual(['Active recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Neuromuscular']);
  });
  it('custom list overrides, upper = next lower − 1', () => {
    const z = powerZones(250, [['Easy', 0], ['Hard', 200]]);
    expect(z).toEqual([
      { name: 'Easy', lowerW: 0, upperW: 199, cls: 'z1' },
      { name: 'Hard', lowerW: 200, upperW: null, cls: 'z2' },
    ]);
  });
  it('falls back to DEFAULT_FTP when ftp is 0/NaN', () => { expect(powerZones(0)[3].lowerW).toBe(225); expect(DEFAULT_FTP).toBe(250); });
  it('zoneIndex picks the band', () => { const z = powerZones(250); expect(zoneIndex(z, 0)).toBe(0); expect(zoneIndex(z, 225)).toBe(3); expect(zoneIndex(z, 999)).toBe(6); });
});
describe('hrBand', () => {
  it('maps %HRmax to five bands', () => {
    expect(hrBand(50)).toBe('z1'); expect(hrBand(60)).toBe('z2'); expect(hrBand(75)).toBe('z3'); expect(hrBand(85)).toBe('z4'); expect(hrBand(86)).toBe('z5');
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/engine/smoothing.ts`:
```ts
export class Ema {
  value = 0;
  private count = 0;
  private sum = 0;
  constructor(private readonly n: number) {}
  push(x: number): number {
    this.count++;
    if (this.n <= 1) { this.value = x; return x; }
    if (this.count <= this.n) { this.sum += x; this.value = this.sum / this.count; return this.value; }
    const a = 2 / (this.n + 1);
    this.value = this.value + a * (x - this.value);
    return this.value;
  }
}
```

`src/engine/zones.ts`:
```ts
export const DEFAULT_FTP = 250;
export interface Zone { name: string; lowerW: number; upperW: number | null; cls: string }
const NAMES = ['Active recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Neuromuscular'];
const PCT = [0, 0.55, 0.75, 0.9, 1.05, 1.2, 1.5];

export function powerZones(ftpW: number, custom?: [string, number][]): Zone[] {
  const ftp = ftpW > 0 && Number.isFinite(ftpW) ? ftpW : DEFAULT_FTP;
  const pairs: [string, number][] = custom && custom.length ? custom : NAMES.map((n, i) => [n, Math.round(PCT[i] * ftp)]);
  return pairs.map(([name, lowerW], i) => ({
    name, lowerW, cls: `z${i + 1}`,
    upperW: i + 1 < pairs.length ? pairs[i + 1][1] - 1 : null,
  }));
}
export function zoneIndex(zones: Zone[], watts: number): number {
  let idx = 0;
  for (let i = 0; i < zones.length; i++) if (watts >= zones[i].lowerW) idx = i;
  return idx;
}
export function hrBand(pct: number): 'z1' | 'z2' | 'z3' | 'z4' | 'z5' {
  return pct <= 50 ? 'z1' : pct <= 65 ? 'z2' : pct <= 75 ? 'z3' : pct <= 85 ? 'z4' : 'z5';
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(engine): EMA smoothing, power zones, HR bands`.

---

### Task 5: W'bal (Skiba integral, incremental)

**Files:**
- Create: `src/engine/wbal.ts`
- Test: `src/engine/wbal.test.ts`

**Interfaces:**
- `class WBal { constructor(cpW: number, wprimeJ: number); tick(powerW: number): void; expendedJ: number; remainingJ: number; pctExpended: number; tau: number }` — one `tick` per second.

- [ ] **Step 1: Failing tests**

`src/engine/wbal.test.ts`:
```ts
import { WBal } from './wbal';
describe('WBal', () => {
  it('τ with no sub-CP samples uses DCP = CP', () => {
    const w = new WBal(250, 20000);
    expect(w.tau).toBeCloseTo(546 * Math.exp(-0.01 * 250) + 316, 6);
  });
  it('accumulates above CP and decays with τ', () => {
    const w = new WBal(250, 20000);
    w.tick(350);                                 // +100 J
    expect(w.expendedJ).toBeCloseTo(100, 6);
    w.tick(350);
    expect(w.expendedJ).toBeCloseTo(100 * Math.exp(-1 / w.tau) + 100, 6);
    expect(w.remainingJ).toBeCloseTo(20000 - w.expendedJ, 6);
    expect(w.pctExpended).toBeCloseTo((w.expendedJ / 20000) * 100, 6);
  });
  it('τ shrinks as recovery power rises (mean of sub-CP samples)', () => {
    const w = new WBal(250, 20000);
    const t0 = w.tau; w.tick(150); // DCP = 250-150 = 100 → τ = 546e^-1+316
    expect(w.tau).toBeCloseTo(546 * Math.exp(-1) + 316, 6);
    expect(w.tau).toBeGreaterThan(t0);
  });
  it('cp fallback: cpW 0 behaves as 250', () => { expect(new WBal(0, 20000).tau).toBeCloseTo(new WBal(250, 20000).tau, 9); });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/engine/wbal.ts`:
```ts
import { DEFAULT_FTP } from './zones';
export class WBal {
  expendedJ = 0;
  private belowSum = 0;
  private belowN = 0;
  readonly cp: number;
  constructor(cpW: number, readonly wprimeJ: number) { this.cp = cpW > 0 ? cpW : DEFAULT_FTP; }
  get tau(): number {
    const dcp = this.belowN ? this.cp - this.belowSum / this.belowN : this.cp;
    return 546 * Math.exp(-0.01 * dcp) + 316;
  }
  tick(powerW: number): void {
    if (powerW < this.cp) { this.belowSum += powerW; this.belowN++; }
    this.expendedJ = this.expendedJ * Math.exp(-1 / this.tau) + Math.max(powerW - this.cp, 0);
  }
  get remainingJ(): number { return this.wprimeJ - this.expendedJ; }
  get pctExpended(): number { return this.wprimeJ > 0 ? (this.expendedJ / this.wprimeJ) * 100 : 0; }
}
```

Note the test for decay: after the second tick `tau` is recomputed from the same (empty) sub-CP set, so the expected value uses the same τ; this matches the implementation order (update sub-CP stats, then decay with the new τ).

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(engine): Skiba W'bal`.

---

### Task 6: Metric accumulators, calories, distance

**Files:**
- Create: `src/engine/metrics.ts`
- Test: `src/engine/metrics.test.ts`

**Interfaces:**
- `class Stat { push(x: number): void; avg: number; max: number; n: number; reset(): void }`
- `caloriesMet(weightKg: number, hours: number, met?: number): number` (MET default 8)
- `class DistanceIntegrator { push(speedMs: number, dtS: number): number; meters: number; reset(): void }` — trapezoidal.
- `kJ(avgPowerW: number, elapsedS: number): number`
- `pctOf(value: number, ref: number): number` — 0 when ref ≤ 0.

- [ ] **Step 1: Failing tests**

`src/engine/metrics.test.ts`:
```ts
import { Stat, caloriesMet, DistanceIntegrator, kJ, pctOf } from './metrics';
describe('Stat', () => {
  it('tracks avg, max, n and resets', () => {
    const s = new Stat(); s.push(100); s.push(300);
    expect(s.avg).toBe(200); expect(s.max).toBe(300); expect(s.n).toBe(2);
    s.reset(); expect(s.avg).toBe(0); expect(s.max).toBe(0); expect(s.n).toBe(0);
  });
});
describe('calories', () => {
  it('MET × kg × h with MET 8 default', () => { expect(caloriesMet(70, 0.5)).toBeCloseTo(280, 6); expect(caloriesMet(70, 1, 4)).toBe(280); });
});
describe('DistanceIntegrator', () => {
  it('trapezoid of speed over dt', () => {
    const d = new DistanceIntegrator();
    expect(d.push(10, 1)).toBeCloseTo(5, 6);     // first sample: (0+10)/2 × 1
    expect(d.push(10, 1)).toBeCloseTo(15, 6);
  });
});
describe('kJ and pct', () => {
  it('kJ = avgW × s / 1000', () => { expect(kJ(200, 3600)).toBe(720); });
  it('pctOf guards zero reference', () => { expect(pctOf(125, 250)).toBe(50); expect(pctOf(10, 0)).toBe(0); });
});
```

- [ ] **Step 2: Run** `npx vitest run src/engine/metrics` → FAIL. **Step 3: Implement**

`src/engine/metrics.ts`:
```ts
export class Stat {
  private sum = 0; n = 0; max = 0;
  push(x: number) { this.sum += x; this.n++; if (x > this.max) this.max = x; }
  get avg() { return this.n ? this.sum / this.n : 0; }
  reset() { this.sum = 0; this.n = 0; this.max = 0; }
}
export const caloriesMet = (weightKg: number, hours: number, met = 8) => met * weightKg * hours;
export class DistanceIntegrator {
  meters = 0; private last = 0;
  push(speedMs: number, dtS: number) { this.meters += ((this.last + speedMs) / 2) * dtS; this.last = speedMs; return this.meters; }
  reset() { this.meters = 0; this.last = 0; }
}
export const kJ = (avgPowerW: number, elapsedS: number) => (avgPowerW * elapsedS) / 1000;
export const pctOf = (value: number, ref: number) => (ref > 0 ? (value / ref) * 100 : 0);
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(engine): stat accumulators, calories, distance, kJ`.

---

### Task 7: Laps

**Files:**
- Create: `src/engine/laps.ts`
- Test: `src/engine/laps.test.ts`

**Interfaces:**
- `interface LapRow { number: number; startOffsetS: number; durationS: number; distanceM: number; calories: number; avgPower: number; avgCad: number; avgSpeedMs: number; avgHr: number; difHrPct: number | null }`
- `interface LapSample { power: number; hr: number; cadence: number; speedMs: number; distanceM: number; calories: number; elapsedS: number }`
- `class LapTracker { constructor(startOffsetS?: number); sample(s: LapSample): void; close(elapsedS: number): LapRow; readonly current: { number: number; durationS: number; avgPower: number; avgHr: number; avgCad: number; distanceM: number }; rows: LapRow[] }` — `close` pushes a row (oldest first in `rows`; UI reverses), computes `difHrPct` vs previous row, starts the next lap at `elapsedS`.

- [ ] **Step 1: Failing tests**

`src/engine/laps.test.ts`:
```ts
import { LapTracker } from './laps';
const s = (power: number, hr: number, cadence: number, speedMs: number, distanceM: number, calories: number, elapsedS: number) => ({ power, hr, cadence, speedMs, distanceM, calories, elapsedS });
describe('LapTracker', () => {
  it('closes laps with averages, lap-relative distance, and %dif HR', () => {
    const t = new LapTracker();
    t.sample(s(100, 120, 80, 5, 5, 1, 1)); t.sample(s(200, 140, 90, 5, 10, 2, 2));
    const r1 = t.close(2);
    expect(r1).toEqual({ number: 1, startOffsetS: 0, durationS: 2, distanceM: 10, calories: 2, avgPower: 150, avgCad: 85, avgSpeedMs: 5, avgHr: 130, difHrPct: null });
    t.sample(s(300, 156, 90, 10, 20, 3, 3));
    const r2 = t.close(3);
    expect(r2.number).toBe(2); expect(r2.startOffsetS).toBe(2); expect(r2.durationS).toBe(1);
    expect(r2.distanceM).toBe(10); expect(r2.calories).toBe(1);
    expect(r2.difHrPct).toBeCloseTo(20, 6);        // (156-130)/130 × 100
    expect(t.rows).toHaveLength(2);
  });
  it('current lap exposes live values and an empty lap closes with zeros', () => {
    const t = new LapTracker();
    expect(t.current.number).toBe(1);
    const r = t.close(0);
    expect(r.avgPower).toBe(0); expect(r.durationS).toBe(0); expect(r.difHrPct).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/engine/laps.ts`:
```ts
import { Stat } from './metrics';
export interface LapRow { number: number; startOffsetS: number; durationS: number; distanceM: number; calories: number; avgPower: number; avgCad: number; avgSpeedMs: number; avgHr: number; difHrPct: number | null }
export interface LapSample { power: number; hr: number; cadence: number; speedMs: number; distanceM: number; calories: number; elapsedS: number }

export class LapTracker {
  rows: LapRow[] = [];
  private n = 1;
  private start: number;
  private startDist = 0; private startCal = 0;
  private lastDist = 0; private lastCal = 0; private lastElapsed: number;
  private power = new Stat(); private hr = new Stat(); private cad = new Stat(); private speed = new Stat();
  constructor(startOffsetS = 0) { this.start = startOffsetS; this.lastElapsed = startOffsetS; }
  sample(s: LapSample) {
    this.power.push(s.power); this.hr.push(s.hr); this.cad.push(s.cadence); this.speed.push(s.speedMs);
    this.lastDist = s.distanceM; this.lastCal = s.calories; this.lastElapsed = s.elapsedS;
  }
  get current() {
    return { number: this.n, durationS: this.lastElapsed - this.start, avgPower: this.power.avg, avgHr: this.hr.avg, avgCad: this.cad.avg, distanceM: this.lastDist - this.startDist };
  }
  close(elapsedS: number): LapRow {
    const prev = this.rows[this.rows.length - 1];
    const avgHr = this.hr.avg;
    const row: LapRow = {
      number: this.n, startOffsetS: this.start, durationS: elapsedS - this.start,
      distanceM: this.lastDist - this.startDist, calories: this.lastCal - this.startCal,
      avgPower: this.power.avg, avgCad: this.cad.avg, avgSpeedMs: this.speed.avg, avgHr,
      difHrPct: prev && prev.avgHr > 0 ? ((avgHr - prev.avgHr) / prev.avgHr) * 100 : null,
    };
    this.rows.push(row);
    this.n++; this.start = elapsedS; this.startDist = this.lastDist; this.startCal = this.lastCal; this.lastElapsed = elapsedS;
    this.power.reset(); this.hr.reset(); this.cad.reset(); this.speed.reset();
    return row;
  }
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(engine): lap tracker with %dif HR`.

---

### Task 8: Ride engine (state machine + 1 Hz sampling)

**Files:**
- Create: `src/engine/ride.ts`
- Test: `src/engine/ride.test.ts`

**Interfaces:**
- Consumes: `Stat`, `DistanceIntegrator`, `caloriesMet`, `kJ`, `pctOf` (Task 6), `LapTracker`, `LapRow` (Task 7), `WBal` (Task 5), `Ema` (Task 4).
- `interface LiveInput { hr: number; power: number; cadence: number; speedMs: number; trainerDistanceM?: number; trainerKcal?: number }`
- `interface RiderParams { weightKg: number; ftpW: number; cpW?: number; wprimeKj: number; hrMax: number }`
- `interface RideOpts { rider: RiderParams; smoothingN: 1 | 5 | 10 | 30; now?: () => number }`
- `type RideState = 'idle' | 'recording' | 'paused' | 'stopped'`
- `interface Sample { t: number; hr: number; cadence: number; power: number; lap: number; distanceM: number; speedMs: number }`
- `class RideEngine { constructor(o: RideOpts); state: RideState; start(): void; pause(): void; resume(): void; lap(): LapRow; stop(): void; tick(input: LiveInput): Sample | null; readonly view: RideView; samples: Sample[]; laps: LapTracker; startMs: number }`
- `interface RideView { elapsedS; lapS; prevLapS: number | null; power; powerSmooth; avgPower; maxPower; hr; avgHr; maxHr; cadence; cadenceSmooth; avgCad; maxCad; speedMs; distanceM; calories; kJ; pctFtp; pctHrMax; wbalPct; wbalRemainingJ; lapNumber }` (all `number` unless noted)
- `tick` is called once per second by the caller; it returns the written `Sample`, or `null` when not recording. Elapsed = floor((now − startMs − pausedMs)/1000) + 1 as the vendor did.

- [ ] **Step 1: Failing tests**

`src/engine/ride.test.ts`:
```ts
import { RideEngine } from './ride';
const rider = { weightKg: 70, ftpW: 250, cpW: 250, wprimeKj: 20, hrMax: 180 };
function mk(smoothingN: 1 | 5 | 10 | 30 = 1) {
  let t = 1_000_000;
  const e = new RideEngine({ rider, smoothingN, now: () => t });
  return { e, advance: (ms: number) => { t += ms; } };
}
const live = (power: number, hr = 120, cadence = 90, speedMs = 8) => ({ hr, power, cadence, speedMs });

describe('RideEngine', () => {
  it('idle → recording → stopped, elapsed counts from 1 like the vendor', () => {
    const { e, advance } = mk();
    expect(e.state).toBe('idle');
    e.start(); expect(e.state).toBe('recording');
    expect(e.tick(live(200))).toMatchObject({ t: 1, power: 200, lap: 1 });
    advance(1000); e.tick(live(300));
    expect(e.view.elapsedS).toBe(2); expect(e.view.avgPower).toBe(250); expect(e.view.maxPower).toBe(300);
    e.stop(); expect(e.state).toBe('stopped'); expect(e.tick(live(100))).toBeNull();
    expect(e.samples).toHaveLength(2);
  });
  it('pause excludes time and writes no samples; resume continues', () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(200)); advance(1000);
    e.pause(); expect(e.state).toBe('paused');
    advance(5000); expect(e.tick(live(999))).toBeNull();
    e.resume(); advance(1000); e.tick(live(200));
    expect(e.view.elapsedS).toBe(3);          // 1 s + 1 s, pause excluded, +1 vendor offset
    expect(e.samples).toHaveLength(2); expect(e.view.avgPower).toBe(200);
  });
  it('laps, kJ, %FTP, %HRmax, distance, calories', () => {
    const { e, advance } = mk();
    e.start();
    for (let i = 0; i < 60; i++) { e.tick(live(250, 90, 90, 10)); advance(1000); }
    const row = e.lap();
    expect(row.number).toBe(1); expect(row.avgPower).toBe(250); expect(e.view.lapNumber).toBe(2);
    expect(e.view.pctFtp).toBe(100); expect(e.view.pctHrMax).toBe(50);
    expect(e.view.kJ).toBeCloseTo((250 * 61) / 1000, 6);        // elapsed is 61 after 60 advances
    expect(e.view.distanceM).toBeCloseTo(595, 0);               // 5 (first half-trapezoid) + 59 × 10
    expect(e.view.calories).toBeCloseTo(8 * 70 * (60 / 3600), 6);
    e.tick(live(250, 90, 90, 10)); advance(1000);
    expect(e.view.lapS).toBe(1); expect(e.view.prevLapS).toBe(60);
  });
  it('trainer distance and kcal override integration when present', () => {
    const { e, advance } = mk();
    e.start(); e.tick({ ...live(100), trainerDistanceM: 1234, trainerKcal: 42 }); advance(1000);
    expect(e.view.distanceM).toBe(1234); expect(e.view.calories).toBe(42);
  });
  it('smoothing applies to displayed power/cadence only', () => {
    const { e, advance } = mk(5);
    e.start(); e.tick(live(100, 120, 80)); advance(1000); e.tick(live(300, 120, 100));
    expect(e.view.powerSmooth).toBe(200); expect(e.view.power).toBe(300);
    expect(e.view.cadenceSmooth).toBe(90); expect(e.samples[1].power).toBe(300);
  });
  it("W'bal: riding above CP expends", () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(350)); advance(1000);
    expect(e.view.wbalPct).toBeCloseTo(0.5, 6);                // 100 J of 20 kJ
    expect(e.view.wbalRemainingJ).toBeCloseTo(19900, 6);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/engine/ride.ts`:
```ts
import { Stat, DistanceIntegrator, caloriesMet, kJ, pctOf } from './metrics';
import { LapTracker, LapRow } from './laps';
import { WBal } from './wbal';
import { Ema } from './smoothing';

export interface LiveInput { hr: number; power: number; cadence: number; speedMs: number; trainerDistanceM?: number; trainerKcal?: number }
export interface RiderParams { weightKg: number; ftpW: number; cpW?: number; wprimeKj: number; hrMax: number }
export interface RideOpts { rider: RiderParams; smoothingN: 1 | 5 | 10 | 30; now?: () => number }
export type RideState = 'idle' | 'recording' | 'paused' | 'stopped';
export interface Sample { t: number; hr: number; cadence: number; power: number; lap: number; distanceM: number; speedMs: number }
export interface RideView {
  elapsedS: number; lapS: number; prevLapS: number | null;
  power: number; powerSmooth: number; avgPower: number; maxPower: number;
  hr: number; avgHr: number; maxHr: number;
  cadence: number; cadenceSmooth: number; avgCad: number; maxCad: number;
  speedMs: number; distanceM: number; calories: number; kJ: number; pctFtp: number; pctHrMax: number;
  wbalPct: number; wbalRemainingJ: number; lapNumber: number;
}

export class RideEngine {
  state: RideState = 'idle';
  samples: Sample[] = [];
  laps = new LapTracker();
  startMs = 0;
  private pausedMs = 0; private pauseStartedAt = 0;
  private readonly now: () => number;
  private power = new Stat(); private hr = new Stat(); private cad = new Stat();
  private dist = new DistanceIntegrator();
  private wbal: WBal;
  private emaP: Ema; private emaC: Ema;
  private last: LiveInput = { hr: 0, power: 0, cadence: 0, speedMs: 0 };
  private distanceM = 0; private calories = 0; private lastTickMs = 0;

  constructor(private readonly o: RideOpts) {
    this.now = o.now ?? (() => Date.now());
    this.wbal = new WBal(o.rider.cpW ?? o.rider.ftpW, o.rider.wprimeKj * 1000);
    this.emaP = new Ema(o.smoothingN); this.emaC = new Ema(o.smoothingN);
  }
  start() { if (this.state !== 'idle') return; this.state = 'recording'; this.startMs = this.now(); this.lastTickMs = this.startMs; }
  pause() { if (this.state !== 'recording') return; this.state = 'paused'; this.pauseStartedAt = this.now(); }
  resume() { if (this.state !== 'paused') return; this.pausedMs += this.now() - this.pauseStartedAt; this.state = 'recording'; this.lastTickMs = this.now(); }
  stop() { if (this.state === 'paused') this.resume(); if (this.state === 'recording') this.state = 'stopped'; }
  lap(): LapRow { return this.laps.close(this.elapsedS()); }

  private elapsedS(): number {
    if (this.state === 'idle') return 0;
    const end = this.state === 'paused' ? this.pauseStartedAt : this.now();
    return Math.floor((end - this.startMs - this.pausedMs) / 1000) + 1;
  }

  tick(input: LiveInput): Sample | null {
    if (this.state !== 'recording') return null;
    const nowMs = this.now();
    const dtS = this.samples.length ? Math.max(0, (nowMs - this.lastTickMs) / 1000) : 1;
    this.lastTickMs = nowMs;
    this.last = input;
    this.power.push(input.power); this.hr.push(input.hr); this.cad.push(input.cadence);
    this.emaP.push(input.power); this.emaC.push(input.cadence);
    this.wbal.tick(input.power);
    const elapsedS = this.elapsedS();
    this.distanceM = input.trainerDistanceM ?? this.dist.push(input.speedMs, dtS);
    this.calories = input.trainerKcal ?? caloriesMet(this.o.rider.weightKg, (elapsedS - 1) / 3600);
    this.laps.sample({ power: input.power, hr: input.hr, cadence: input.cadence, speedMs: input.speedMs, distanceM: this.distanceM, calories: this.calories, elapsedS });
    const s: Sample = { t: elapsedS, hr: input.hr, cadence: input.cadence, power: input.power, lap: this.laps.current.number, distanceM: this.distanceM, speedMs: input.speedMs };
    this.samples.push(s);
    return s;
  }

  get view(): RideView {
    const elapsedS = this.elapsedS();
    const prev = this.laps.rows[this.laps.rows.length - 1];
    return {
      elapsedS, lapS: this.laps.current.durationS, prevLapS: prev ? prev.durationS : null,
      power: this.last.power, powerSmooth: this.emaP.value, avgPower: this.power.avg, maxPower: this.power.max,
      hr: this.last.hr, avgHr: this.hr.avg, maxHr: this.hr.max,
      cadence: this.last.cadence, cadenceSmooth: this.emaC.value, avgCad: this.cad.avg, maxCad: this.cad.max,
      speedMs: this.last.speedMs, distanceM: this.distanceM, calories: this.calories,
      kJ: kJ(this.power.avg, elapsedS), pctFtp: pctOf(this.last.power, this.o.rider.ftpW), pctHrMax: pctOf(this.last.hr, this.o.rider.hrMax),
      wbalPct: this.wbal.pctExpended, wbalRemainingJ: this.wbal.remainingJ, lapNumber: this.laps.current.number,
    };
  }
}
```

Note on the lap test: after 60 ticks each followed by `advance(1000)`, the clock sits 60 s after start, so `elapsedS` is 61 (vendor +1); the lap closed at 61 reports `durationS` 61 − 0 = 61. Adjust the test's `prevLapS` expectation to 61 and `lapS` to 1 if the first run reports so; the vendor's +1 offset is the source of truth, not the round number. Calories use `(elapsedS − 1)/3600` so one minute of riding is exactly 60 s.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(engine): ride state machine with 1 Hz sampling`.

---

### Task 9: Structured workout model

**Files:**
- Create: `src/engine/workout.ts`
- Test: `src/engine/workout.test.ts`

**Interfaces:**
- `interface Workout { id: string; title: string; type: 'PWR' | 'HR' | 'CAD'; wdate: string; totalduration: number; timeS: number[]; pwrS: number[]; cadS: number[]; hrS: number[] }`
- `parseWorkout(json: unknown): Workout | null` — validates shape, equal-length arrays, finite numbers.
- `workoutAt(w: Workout, elapsedS: number): { step: number; remainingS: number; pctFtp: number; cadence: number; pctHr: number } | null` — `null` after the end.
- `targetWatts(pctFtp: number, ftpW: number): number` = round(pct × ftp / 100).

- [ ] **Step 1: Failing tests**

`src/engine/workout.test.ts`:
```ts
import { parseWorkout, workoutAt, targetWatts } from './workout';
const w = { id: 'w1', title: 'Test', type: 'PWR', wdate: '2026-10-14', totalduration: 30, timeS: [10, 20], pwrS: [50, 100], cadS: [80, 90], hrS: [60, 80] };
describe('workout', () => {
  it('parses a valid workout and rejects ragged arrays', () => {
    expect(parseWorkout(w)?.title).toBe('Test');
    expect(parseWorkout({ ...w, pwrS: [50] })).toBeNull();
    expect(parseWorkout({ ...w, type: 'XX' })).toBeNull();
    expect(parseWorkout('nope')).toBeNull();
  });
  it('locates the step and remaining time', () => {
    const p = parseWorkout(w)!;
    expect(workoutAt(p, 0)).toEqual({ step: 0, remainingS: 10, pctFtp: 50, cadence: 80, pctHr: 60 });
    expect(workoutAt(p, 10)).toEqual({ step: 1, remainingS: 20, pctFtp: 100, cadence: 90, pctHr: 80 });
    expect(workoutAt(p, 29)!.remainingS).toBe(1);
    expect(workoutAt(p, 30)).toBeNull();
  });
  it('target watts', () => { expect(targetWatts(100, 250)).toBe(250); expect(targetWatts(55, 250)).toBe(138); });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/engine/workout.ts`:
```ts
export interface Workout { id: string; title: string; type: 'PWR' | 'HR' | 'CAD'; wdate: string; totalduration: number; timeS: number[]; pwrS: number[]; cadS: number[]; hrS: number[] }
const nums = (a: unknown): a is number[] => Array.isArray(a) && a.every((x) => typeof x === 'number' && Number.isFinite(x));
export function parseWorkout(json: unknown): Workout | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (typeof o.title !== 'string' || !['PWR', 'HR', 'CAD'].includes(String(o.type))) return null;
  if (!nums(o.timeS) || !nums(o.pwrS) || !nums(o.cadS) || !nums(o.hrS)) return null;
  const n = o.timeS.length;
  if (!n || o.pwrS.length !== n || o.cadS.length !== n || o.hrS.length !== n) return null;
  return {
    id: String(o.id ?? o.title), title: o.title, type: o.type as Workout['type'], wdate: String(o.wdate ?? ''),
    totalduration: typeof o.totalduration === 'number' ? o.totalduration : o.timeS.reduce((a, b) => a + b, 0),
    timeS: o.timeS, pwrS: o.pwrS, cadS: o.cadS, hrS: o.hrS,
  };
}
export function workoutAt(w: Workout, elapsedS: number) {
  let acc = 0;
  for (let i = 0; i < w.timeS.length; i++) {
    const end = acc + w.timeS[i];
    if (elapsedS < end) return { step: i, remainingS: end - elapsedS, pctFtp: w.pwrS[i], cadence: w.cadS[i], pctHr: w.hrS[i] };
    acc = end;
  }
  return null;
}
export const targetWatts = (pctFtp: number, ftpW: number) => Math.round((pctFtp * ftpW) / 100);
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(engine): structured workout model`.

---

### Task 10: IndexedDB schema, riders, sessions

**Files:**
- Create: `src/data/db.ts`, `src/data/riders.ts`, `src/data/sessions.ts`, `src/data/remote.ts`
- Test: `src/data/data.test.ts`

**Interfaces:**
- `interface Rider { id: string; name: string; email: string; weightKg: number; ftpW: number; cpW?: number; wprimeKj: number; hrMax: number; powerZones?: [string, number][]; createdAt: number }`
- `interface SessionRecord { id: number; riderId: string; riderName: string; sport: 'indoor_cycling'; startMs: number; durationS: number; distanceM: number; calories: number; nSamples: number; avgPower: number; maxPower: number; avgHr: number; maxHr: number; avgCad: number; uploaded: null | { service: string; remoteId: string }; synced: boolean }`
- `interface LapRecord extends LapRow { sessionId: number }`, `interface SampleRecord extends Sample { sessionId: number }`
- `getDb(): Promise<IDBPDatabase<Schema>>`
- riders: `listRiders()`, `putRider(r)`, `deleteRider(id)`, `newRider(partial): Rider` (defaults weight 70, ftp 250, wprime 20, hrMax 180, cp = ftp).
- sessions: `saveSession(s, laps, samples)` (one transaction), `listSessions()` newest first, `getSession(id)`, `getLaps(id)`, `getSamples(id)`, `deleteSession(id)` (cascades), `deleteAllSessions()`.
- `remote.ts`: `export const remote = { enabled: false, async pushSession(_s: SessionRecord) {} }` — phase 2 hook, no network in phase 1.

- [ ] **Step 1: Failing tests**

`src/data/data.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { listRiders, putRider, newRider, deleteRider } from './riders';
import { saveSession, listSessions, getLaps, getSamples, deleteSession, deleteAllSessions, getSession } from './sessions';
import type { SessionRecord } from './db';

const sess = (id: number, n = 2): SessionRecord => ({ id, riderId: 'r1', riderName: 'Ann', sport: 'indoor_cycling', startMs: id, durationS: n, distanceM: 10, calories: 1, nSamples: n, avgPower: 100, maxPower: 120, avgHr: 130, maxHr: 140, avgCad: 85, uploaded: null, synced: false });
const lap = { number: 1, startOffsetS: 0, durationS: 2, distanceM: 10, calories: 1, avgPower: 100, avgCad: 85, avgSpeedMs: 5, avgHr: 130, difHrPct: null };
const smp = (t: number) => ({ t, hr: 130, cadence: 85, power: 100, lap: 1, distanceM: t * 5, speedMs: 5 });

describe('riders', () => {
  it('newRider fills vendor defaults and cp = ftp', () => {
    const r = newRider({ name: 'Ann', email: 'a@x', ftpW: 300 });
    expect(r).toMatchObject({ weightKg: 70, ftpW: 300, cpW: 300, wprimeKj: 20, hrMax: 180 });
    expect(r.id).toBeTruthy();
  });
  it('put/list/delete', async () => {
    const r = newRider({ name: 'Ann', email: 'a@x' });
    await putRider(r);
    expect((await listRiders()).map((x) => x.name)).toEqual(['Ann']);
    await deleteRider(r.id);
    expect(await listRiders()).toEqual([]);
  });
});

describe('sessions', () => {
  it('saves session with laps and samples, lists newest first, cascades delete', async () => {
    await saveSession(sess(1000), [lap], [smp(1), smp(2)]);
    await saveSession(sess(2000), [], []);
    expect((await listSessions()).map((s) => s.id)).toEqual([2000, 1000]);
    expect(await getLaps(1000)).toHaveLength(1);
    expect(await getSamples(1000)).toHaveLength(2);
    expect((await getSession(2000))?.nSamples).toBe(2);
    await deleteSession(1000);
    expect(await getSamples(1000)).toHaveLength(0);
    expect(await getSession(1000)).toBeUndefined();
    await deleteAllSessions();
    expect(await listSessions()).toEqual([]);
  });
  it('zero-sample session saves and loads cleanly', async () => {
    await saveSession(sess(3000, 0), [], []);
    expect((await getSession(3000))?.nSamples).toBe(0);
    expect(await getSamples(3000)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/data/data` → FAIL. **Step 3: Implement**

`src/data/db.ts`:
```ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';

export interface Rider { id: string; name: string; email: string; weightKg: number; ftpW: number; cpW?: number; wprimeKj: number; hrMax: number; powerZones?: [string, number][]; createdAt: number }
export interface SessionRecord { id: number; riderId: string; riderName: string; sport: 'indoor_cycling'; startMs: number; durationS: number; distanceM: number; calories: number; nSamples: number; avgPower: number; maxPower: number; avgHr: number; maxHr: number; avgCad: number; uploaded: null | { service: string; remoteId: string }; synced: boolean }
export interface LapRecord extends LapRow { sessionId: number }
export interface SampleRecord extends Sample { sessionId: number }

export interface Schema extends DBSchema {
  riders: { key: string; value: Rider };
  sessions: { key: number; value: SessionRecord; indexes: { byStart: number } };
  laps: { key: [number, number]; value: LapRecord; indexes: { bySession: number } };
  samples: { key: [number, number]; value: SampleRecord; indexes: { bySession: number } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
export function getDb() {
  dbp ??= openDB<Schema>('indoorgranny', 1, {
    upgrade(db) {
      db.createObjectStore('riders', { keyPath: 'id' });
      db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byStart', 'startMs');
      db.createObjectStore('laps', { keyPath: ['sessionId', 'number'] }).createIndex('bySession', 'sessionId');
      db.createObjectStore('samples', { keyPath: ['sessionId', 't'] }).createIndex('bySession', 'sessionId');
    },
  });
  return dbp;
}
```

`src/data/riders.ts`:
```ts
import { getDb, Rider } from './db';
export type { Rider };
export function newRider(p: Partial<Rider> & { name: string; email: string }): Rider {
  const ftpW = p.ftpW ?? 250;
  return { id: p.id ?? `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, name: p.name, email: p.email, weightKg: p.weightKg ?? 70, ftpW, cpW: p.cpW ?? ftpW, wprimeKj: p.wprimeKj ?? 20, hrMax: p.hrMax ?? 180, powerZones: p.powerZones, createdAt: p.createdAt ?? Date.now() };
}
export async function listRiders() { return (await (await getDb()).getAll('riders')).sort((a, b) => a.name.localeCompare(b.name)); }
export async function putRider(r: Rider) { await (await getDb()).put('riders', r); }
export async function deleteRider(id: string) { await (await getDb()).delete('riders', id); }
```

`src/data/sessions.ts`:
```ts
import { getDb, SessionRecord } from './db';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';
export type { SessionRecord };

export async function saveSession(s: SessionRecord, laps: LapRow[], samples: Sample[]) {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'laps', 'samples'], 'readwrite');
  await tx.objectStore('sessions').put(s);
  for (const l of laps) await tx.objectStore('laps').put({ ...l, sessionId: s.id });
  for (const x of samples) await tx.objectStore('samples').put({ ...x, sessionId: s.id });
  await tx.done;
}
export async function listSessions() { return (await (await getDb()).getAllFromIndex('sessions', 'byStart')).reverse(); }
export async function getSession(id: number) { return (await getDb()).get('sessions', id); }
export async function getLaps(id: number) { return (await getDb()).getAllFromIndex('laps', 'bySession', id); }
export async function getSamples(id: number) { return (await getDb()).getAllFromIndex('samples', 'bySession', id); }
export async function deleteSession(id: number) {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'laps', 'samples'], 'readwrite');
  await tx.objectStore('sessions').delete(id);
  for (const k of await tx.objectStore('laps').index('bySession').getAllKeys(id)) await tx.objectStore('laps').delete(k);
  for (const k of await tx.objectStore('samples').index('bySession').getAllKeys(id)) await tx.objectStore('samples').delete(k);
  await tx.done;
}
export async function deleteAllSessions() {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'laps', 'samples'], 'readwrite');
  await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('laps').clear(), tx.objectStore('samples').clear()]);
  await tx.done;
}
```

`src/data/remote.ts`:
```ts
import type { SessionRecord } from './db';
/** Phase 2 hook: the portal API. No network calls in phase 1. */
export const remote = { enabled: false, async pushSession(_s: SessionRecord): Promise<void> {} };
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(data): IndexedDB schema, riders, sessions`.

---

### Task 11: FIT export

**Files:**
- Create: `src/data/fit.ts`
- Test: `src/data/fit.test.ts`

**Interfaces:**
- `buildFit(session: SessionRecord, laps: LapRow[], samples: Sample[]): Uint8Array`
- `fitFileName(session: SessionRecord): string` → `indoorgranny_YYYYMMDD_HHMM.fit`

- [ ] **Step 1: Failing tests**

`src/data/fit.test.ts`:
```ts
import { Decoder, Stream } from '@garmin/fitsdk';
import { buildFit, fitFileName } from './fit';
import type { SessionRecord } from './db';
const session: SessionRecord = { id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000000000, durationS: 3, distanceM: 30, calories: 2, nSamples: 3, avgPower: 200, maxPower: 250, avgHr: 140, maxHr: 150, avgCad: 90, uploaded: null, synced: false };
const laps = [{ number: 1, startOffsetS: 0, durationS: 3, distanceM: 30, calories: 2, avgPower: 200, avgCad: 90, avgSpeedMs: 10, avgHr: 140, difHrPct: null }];
const samples = [1, 2, 3].map((t) => ({ t, hr: 140, cadence: 90, power: t === 2 ? 250 : 175, lap: 1, distanceM: t * 10, speedMs: 10 }));

describe('buildFit', () => {
  it('round-trips through the SDK decoder with the vendor message set', () => {
    const bytes = buildFit(session, laps, samples);
    const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read();
    expect(errors).toEqual([]);
    expect(messages.fileIdMesgs[0]).toMatchObject({ type: 'activity', manufacturer: 'development' });
    expect(messages.recordMesgs).toHaveLength(3);
    expect(messages.recordMesgs[1]).toMatchObject({ power: 250, heartRate: 140, cadence: 90, distance: 20 });
    expect(messages.lapMesgs).toHaveLength(1);
    expect(messages.sessionMesgs[0]).toMatchObject({ sport: 'cycling', subSport: 'indoorCycling', numLaps: 1, totalCalories: 2 });
    expect(messages.activityMesgs).toHaveLength(1);
  });
  it('zero samples still yields a valid file', () => {
    const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit({ ...session, nSamples: 0 }, [], []))).read();
    expect(errors).toEqual([]); expect(messages.recordMesgs ?? []).toHaveLength(0);
  });
  it('file name from start time', () => { expect(fitFileName(session)).toMatch(/^indoorgranny_\d{8}_\d{4}\.fit$/); });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/data/fit.ts`:
```ts
import { Encoder, Profile } from '@garmin/fitsdk';
import type { SessionRecord } from './db';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';

export function buildFit(s: SessionRecord, laps: LapRow[], samples: Sample[]): Uint8Array {
  const enc = new Encoder();
  const start = new Date(s.startMs);
  const at = (offsetS: number) => new Date(s.startMs + offsetS * 1000);
  enc.writeMesg({ mesgNum: Profile.MesgNum.FILE_ID, type: 'activity', manufacturer: 'development', product: 1, serialNumber: Math.floor(s.startMs / 1000) % 0xffffffff, timeCreated: start });
  enc.writeMesg({ mesgNum: Profile.MesgNum.DEVICE_INFO, timestamp: start, deviceIndex: 0, manufacturer: 'development', product: 1, serialNumber: 1 });
  enc.writeMesg({ mesgNum: Profile.MesgNum.EVENT, timestamp: start, event: 'timer', eventType: 'start' });
  for (const x of samples) {
    enc.writeMesg({ mesgNum: Profile.MesgNum.RECORD, timestamp: at(x.t), heartRate: x.hr, cadence: Math.min(254, Math.round(x.cadence)), power: Math.round(x.power), speed: x.speedMs, distance: x.distanceM });
  }
  for (const l of laps) {
    enc.writeMesg({ mesgNum: Profile.MesgNum.LAP, timestamp: at(l.startOffsetS + l.durationS), startTime: at(l.startOffsetS), totalElapsedTime: l.durationS, totalTimerTime: l.durationS, totalDistance: l.distanceM, avgPower: Math.round(l.avgPower), avgHeartRate: Math.round(l.avgHr), avgCadence: Math.round(l.avgCad), totalCalories: Math.round(l.calories), event: 'lap', eventType: 'stop' });
  }
  const end = at(s.durationS);
  enc.writeMesg({ mesgNum: Profile.MesgNum.EVENT, timestamp: end, event: 'timer', eventType: 'stopAll' });
  enc.writeMesg({ mesgNum: Profile.MesgNum.SESSION, timestamp: end, startTime: start, sport: 'cycling', subSport: 'indoorCycling', totalElapsedTime: s.durationS, totalTimerTime: s.durationS, totalDistance: s.distanceM, totalCalories: Math.round(s.calories), avgPower: Math.round(s.avgPower), maxPower: Math.round(s.maxPower), avgHeartRate: Math.round(s.avgHr), maxHeartRate: Math.round(s.maxHr), avgCadence: Math.round(s.avgCad), avgSpeed: s.durationS ? s.distanceM / s.durationS : 0, numLaps: Math.max(1, laps.length), firstLapIndex: 0, event: 'session', eventType: 'stop' });
  enc.writeMesg({ mesgNum: Profile.MesgNum.ACTIVITY, timestamp: end, totalTimerTime: s.durationS, numSessions: 1, type: 'manual', event: 'activity', eventType: 'stop' });
  return enc.close();
}
export function fitFileName(s: SessionRecord): string {
  const d = new Date(s.startMs); const p = (n: number) => String(n).padStart(2, '0');
  return `indoorgranny_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.fit`;
}
```

If the SDK rejects a field name it throws naming the valid fields; correct the name from `node -e "const {Profile}=require('@garmin/fitsdk');console.log(Object.keys(Profile.messages[Profile.MesgNum.SESSION].fields).map(k=>Profile.messages[Profile.MesgNum.SESSION].fields[k].name))"` rather than dropping the field.

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(data): FIT export via Garmin SDK encoder`.

---

### Task 12: SensorSource interface, LiveStore, Web Bluetooth adapter

**Files:**
- Create: `src/sensors/types.ts`, `src/sensors/live-store.ts`, `src/sensors/ble/adapter.ts`
- Test: `src/sensors/live-store.test.ts`, `src/sensors/ble/adapter.test.ts`

**Interfaces:**
- `type SensorKind = 'hr' | 'power' | 'cadence' | 'speed' | 'trainer'`
- `type Slot = 'hr' | 'power' | 'csc' | 'trainer'` (the four pairing slots; priority hr > power > csc > trainer)
- `interface SensorReading { kind: SensorKind; value: number; at: number; slot: Slot; extra?: { distanceM?: number; kcal?: number } }`
- `type SensorState = 'unpaired' | 'connecting' | 'connected' | 'offline'`
- `interface PairedDevice { slot: Slot; id: string; name: string }`
- `interface SensorSource { id: string; pair(slot: Slot): Promise<PairedDevice>; connect(d: PairedDevice): Promise<void>; disconnect(d: PairedDevice): Promise<void>; onReading(cb: (r: SensorReading) => void): () => void; onState(cb: (slot: Slot, s: SensorState, msg?: string) => void): () => void }`
- `class LiveStore { setPaired(slots: Slot[]): void; accept(r: SensorReading): boolean; snapshot(nowMs: number): LiveInput; staleMs = 5000 }` — `accept` returns false when a higher-priority slot owns that kind; `snapshot` returns zeros for stale kinds; `trainer` readings carry `extra.distanceM`/`kcal` into `trainerDistanceM`/`trainerKcal`.
- `class BleAdapter implements SensorSource` with `constructor(opts: { circumferenceMm: () => number; bluetooth?: Bluetooth })`.

- [ ] **Step 1: Failing tests**

`src/sensors/live-store.test.ts`:
```ts
import { LiveStore } from './live-store';
const r = (kind: any, value: number, slot: any, at = 1000, extra?: any) => ({ kind, value, at, slot, extra });
describe('LiveStore', () => {
  it('trainer feeds power/cadence/speed when nothing more specific is paired', () => {
    const s = new LiveStore(); s.setPaired(['trainer']);
    expect(s.accept(r('power', 200, 'trainer'))).toBe(true);
    expect(s.accept(r('trainer', 0, 'trainer', 1000, { distanceM: 500, kcal: 12 }))).toBe(true);
    expect(s.snapshot(1500)).toMatchObject({ power: 200, trainerDistanceM: 500, trainerKcal: 12 });
  });
  it('a paired power meter owns power and cadence over the trainer', () => {
    const s = new LiveStore(); s.setPaired(['power', 'trainer']);
    expect(s.accept(r('power', 300, 'power'))).toBe(true);
    expect(s.accept(r('power', 200, 'trainer'))).toBe(false);
    expect(s.snapshot(1500).power).toBe(300);
  });
  it('stale kinds read zero after staleMs', () => {
    const s = new LiveStore(); s.setPaired(['hr']);
    s.accept(r('hr', 150, 'hr', 1000));
    expect(s.snapshot(5999).hr).toBe(150); expect(s.snapshot(6001).hr).toBe(0);
  });
});
```

`src/sensors/ble/adapter.test.ts` (unit test of the adapter's pure dispatch, with a fake characteristic):
```ts
import { BleAdapter } from './adapter';
describe('BleAdapter.handleValue', () => {
  it('turns an FTMS packet into power/cadence/speed/trainer readings', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    const dv = new DataView(Uint8Array.from([0x54, 0x02, 0x10, 0x0a, 0xb4, 0x00, 0xe8, 0x03, 0x00, 0xc8, 0x00, 0x8c]).buffer);
    a.handleValue('trainer', 0x2ad2, dv, 1000);
    expect(out.map((x) => [x.kind, x.value])).toEqual([['power', 200], ['cadence', 90], ['speed', 25.76 / 3.6], ['hr', 140], ['trainer', 0]]);
    expect(out[4].extra).toEqual({ distanceM: 1000, kcal: undefined });
  });
  it('CSC crank-only packets become cadence after two events', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    a.handleValue('csc', 0x2a5b, new DataView(Uint8Array.from([0x02, 0x00, 0x00, 0x00, 0x00]).buffer), 0);
    a.handleValue('csc', 0x2a5b, new DataView(Uint8Array.from([0x02, 0x02, 0x00, 0x00, 0x04]).buffer), 1000);
    expect(out).toEqual([{ kind: 'cadence', value: 120, at: 1000, slot: 'csc' }]);
  });
  it('malformed packets emit nothing', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    a.handleValue('hr', 0x2a37, new DataView(new ArrayBuffer(0)), 0);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/sensors/types.ts`:
```ts
export type SensorKind = 'hr' | 'power' | 'cadence' | 'speed' | 'trainer';
export type Slot = 'hr' | 'power' | 'csc' | 'trainer';
export const SLOT_PRIORITY: Slot[] = ['hr', 'power', 'csc', 'trainer'];
export const SLOT_KINDS: Record<Slot, SensorKind[]> = { hr: ['hr'], power: ['power', 'cadence'], csc: ['speed', 'cadence'], trainer: ['power', 'cadence', 'speed', 'hr', 'trainer'] };
export interface SensorReading { kind: SensorKind; value: number; at: number; slot: Slot; extra?: { distanceM?: number; kcal?: number } }
export type SensorState = 'unpaired' | 'connecting' | 'connected' | 'offline';
export interface PairedDevice { slot: Slot; id: string; name: string }
export interface SensorSource {
  id: string;
  pair(slot: Slot): Promise<PairedDevice>;
  connect(d: PairedDevice): Promise<void>;
  disconnect(d: PairedDevice): Promise<void>;
  onReading(cb: (r: SensorReading) => void): () => void;
  onState(cb: (slot: Slot, s: SensorState, msg?: string) => void): () => void;
}
```

`src/sensors/live-store.ts`:
```ts
import { SensorKind, SensorReading, Slot, SLOT_KINDS, SLOT_PRIORITY } from './types';
import type { LiveInput } from '../engine/ride';
export class LiveStore {
  staleMs = 5000;
  private paired: Slot[] = [];
  private v = new Map<SensorKind, { value: number; at: number; extra?: SensorReading['extra'] }>();
  setPaired(slots: Slot[]) { this.paired = SLOT_PRIORITY.filter((s) => slots.includes(s)); }
  owner(kind: SensorKind): Slot | undefined { return this.paired.find((s) => SLOT_KINDS[s].includes(kind)); }
  accept(r: SensorReading): boolean {
    if (this.owner(r.kind) !== r.slot) return false;
    this.v.set(r.kind, { value: r.value, at: r.at, extra: r.extra });
    return true;
  }
  private get(kind: SensorKind, now: number) { const e = this.v.get(kind); return e && now - e.at <= this.staleMs ? e : undefined; }
  snapshot(now: number): LiveInput {
    const t = this.get('trainer', now);
    return { hr: this.get('hr', now)?.value ?? 0, power: this.get('power', now)?.value ?? 0, cadence: this.get('cadence', now)?.value ?? 0, speedMs: this.get('speed', now)?.value ?? 0, trainerDistanceM: t?.extra?.distanceM, trainerKcal: t?.extra?.kcal };
  }
}
```

`src/sensors/ble/adapter.ts`:
```ts
import { PairedDevice, SensorReading, SensorSource, SensorState, Slot } from '../types';
import { UUIDS, ALL_SERVICES } from './uuids';
import { parseHeartRate } from './parse/hr';
import { parseCsc } from './parse/csc';
import { parseCyclingPower } from './parse/cps';
import { parseIndoorBikeData } from './parse/ftms';
import { RevCounter, speedMs, cadenceRpm } from './derive';

const SLOT_SERVICE: Record<Slot, number> = { hr: UUIDS.HR_SERVICE, power: UUIDS.CPS_SERVICE, csc: UUIDS.CSC_SERVICE, trainer: UUIDS.FTMS_SERVICE };
const SLOT_CHAR: Record<Slot, number> = { hr: UUIDS.HR_MEASUREMENT, power: UUIDS.CPS_MEASUREMENT, csc: UUIDS.CSC_MEASUREMENT, trainer: UUIDS.FTMS_INDOOR_BIKE };

export class BleAdapter implements SensorSource {
  id = 'ble';
  private readingCbs = new Set<(r: SensorReading) => void>();
  private stateCbs = new Set<(slot: Slot, s: SensorState, msg?: string) => void>();
  private devices = new Map<Slot, BluetoothDevice>();
  private wheel = new Map<Slot, RevCounter>();
  private crank = new Map<Slot, RevCounter>();
  private readonly bt: Bluetooth | undefined;
  constructor(private readonly o: { circumferenceMm: () => number; bluetooth?: Bluetooth }) { this.bt = o.bluetooth ?? (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined); }
  static available() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }

  onReading(cb: (r: SensorReading) => void) { this.readingCbs.add(cb); return () => this.readingCbs.delete(cb); }
  onState(cb: (slot: Slot, s: SensorState, msg?: string) => void) { this.stateCbs.add(cb); return () => this.stateCbs.delete(cb); }
  private emit(r: SensorReading) { this.readingCbs.forEach((cb) => cb(r)); }
  private setState(slot: Slot, s: SensorState, msg?: string) { this.stateCbs.forEach((cb) => cb(slot, s, msg)); }

  async pair(slot: Slot): Promise<PairedDevice> {
    if (!this.bt) throw new Error('Web Bluetooth is not available in this browser. Use Chrome on Android.');
    const dev = await this.bt.requestDevice({ filters: [{ services: [SLOT_SERVICE[slot]] }], optionalServices: ALL_SERVICES });
    const d: PairedDevice = { slot, id: dev.id, name: dev.name ?? 'Unnamed' };
    this.devices.set(slot, dev);
    await this.connectDevice(slot, dev);
    return d;
  }

  async connect(d: PairedDevice): Promise<void> {
    let dev = this.devices.get(d.slot);
    if (!dev && this.bt?.getDevices) dev = (await this.bt.getDevices()).find((x) => x.id === d.id);
    if (!dev) { this.setState(d.slot, 'offline', 'Tap Reconnect to choose the device again'); return; }
    this.devices.set(d.slot, dev);
    await this.connectDevice(d.slot, dev);
  }

  async disconnect(d: PairedDevice): Promise<void> {
    const dev = this.devices.get(d.slot); this.devices.delete(d.slot);
    dev?.gatt?.disconnect(); this.setState(d.slot, 'unpaired');
  }

  private async connectDevice(slot: Slot, dev: BluetoothDevice, attempt = 0): Promise<void> {
    this.setState(slot, 'connecting');
    try {
      const gatt = await dev.gatt!.connect();
      const svc = await gatt.getPrimaryService(SLOT_SERVICE[slot]);
      const ch = await svc.getCharacteristic(SLOT_CHAR[slot]);
      ch.addEventListener('characteristicvaluechanged', (ev) => {
        const v = (ev.target as BluetoothRemoteGATTCharacteristic).value; if (v) this.handleValue(slot, SLOT_CHAR[slot], v, Date.now());
      });
      await ch.startNotifications();
      dev.addEventListener('gattserverdisconnected', () => {
        this.setState(slot, 'offline', 'Disconnected, reconnecting…');
        if (this.devices.get(slot) === dev) this.reconnect(slot, dev);
      }, { once: true });
      this.setState(slot, 'connected');
    } catch (e) {
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); return this.connectDevice(slot, dev, attempt + 1); }
      this.setState(slot, 'offline', (e as Error).message);
    }
  }
  private reconnect(slot: Slot, dev: BluetoothDevice) { void this.connectDevice(slot, dev, 0); }

  /** Pure dispatch, exported for tests. */
  handleValue(slot: Slot, char: number, dv: DataView, at: number) {
    if (char === UUIDS.HR_MEASUREMENT) { const r = parseHeartRate(dv); if (r) this.emit({ kind: 'hr', value: r.bpm, at, slot }); return; }
    if (char === UUIDS.CSC_MEASUREMENT) {
      const r = parseCsc(dv); if (!r) return;
      if (r.wheelRevs !== undefined && r.wheelTime1024 !== undefined) { const c = this.counter(this.wheel, slot, 1024, 32); const rate = c.push(r.wheelRevs, r.wheelTime1024, at); if (rate !== null) this.emit({ kind: 'speed', value: speedMs(rate, this.o.circumferenceMm()), at, slot }); }
      if (r.crankRevs !== undefined && r.crankTime1024 !== undefined) { const c = this.counter(this.crank, slot, 1024, 16); const rate = c.push(r.crankRevs, r.crankTime1024, at); if (rate !== null) this.emit({ kind: 'cadence', value: cadenceRpm(rate), at, slot }); }
      return;
    }
    if (char === UUIDS.CPS_MEASUREMENT) {
      const r = parseCyclingPower(dv); if (!r) return;
      this.emit({ kind: 'power', value: r.watts, at, slot });
      if (r.crankRevs !== undefined && r.crankTime1024 !== undefined) { const c = this.counter(this.crank, slot, 1024, 16); const rate = c.push(r.crankRevs, r.crankTime1024, at); if (rate !== null) this.emit({ kind: 'cadence', value: cadenceRpm(rate), at, slot }); }
      if (r.wheelRevs !== undefined && r.wheelTime2048 !== undefined) { const c = this.counter(this.wheel, slot, 2048, 32); const rate = c.push(r.wheelRevs, r.wheelTime2048, at); if (rate !== null) this.emit({ kind: 'speed', value: speedMs(rate, this.o.circumferenceMm()), at, slot }); }
      return;
    }
    if (char === UUIDS.FTMS_INDOOR_BIKE) {
      const r = parseIndoorBikeData(dv); if (!r) return;
      if (r.powerW !== undefined) this.emit({ kind: 'power', value: r.powerW, at, slot });
      if (r.cadenceRpm !== undefined) this.emit({ kind: 'cadence', value: r.cadenceRpm, at, slot });
      if (r.speedKmh !== undefined) this.emit({ kind: 'speed', value: r.speedKmh / 3.6, at, slot });
      if (r.hrBpm !== undefined && r.hrBpm > 0) this.emit({ kind: 'hr', value: r.hrBpm, at, slot });
      this.emit({ kind: 'trainer', value: 0, at, slot, extra: { distanceM: r.distanceM, kcal: r.kcalTotal } });
    }
  }
  private counter(map: Map<Slot, RevCounter>, slot: Slot, timeHz: number, revBits: 16 | 32) {
    let c = map.get(slot); if (!c) { c = new RevCounter({ timeHz, revBits }); map.set(slot, c); } return c;
  }
}
```

- [ ] **Step 4: Run** → PASS (the CSC test expects cadence 120: 2 revs in 1024 ticks = 2 rev/s = 120 rpm). **Step 5: Commit** `feat(sensors): SensorSource, LiveStore, Web Bluetooth adapter`.

---

### Task 13: Zustand stores (settings, rider, sensors, ride) and app shell

**Files:**
- Create: `src/app/settings-store.ts`, `src/app/rider-store.ts`, `src/app/sensor-store.ts`, `src/app/ride-store.ts`, `src/app/format.ts`
- Modify: `src/App.tsx` (routes), create `src/ui/Shell.tsx`
- Test: `src/app/stores.test.ts`, `src/app/format.test.ts`

**Interfaces:**
- settings (persisted key `ig.settings`): `{ unitSystem: 'metric'|'imperial'; countdownS: 0|5|3600|7200|10800; smoothingN: 1|5|10|30; wheelMm: number; structuredWorkoutEnabled: boolean; licenseAccepted: boolean; devices: Partial<Record<Slot, PairedDevice>>; set(p: Partial<Settings>): void; setDevice(slot, d|undefined): void }`
- rider store: `{ riders: Rider[]; currentId: string|null; load(): Promise<void>; save(r: Rider): Promise<void>; remove(id): Promise<void>; select(id|null): void; current(): Rider|undefined }`
- sensor store: `{ adapter: BleAdapter; live: LiveStore; states: Record<Slot, SensorState>; messages: Partial<Record<Slot,string>>; values: Partial<Record<SensorKind, number>>; pair(slot): Promise<void>; forget(slot): Promise<void>; reconnectAll(): Promise<void> }` — wires adapter → live store and mirrors values for the Sensors screen.
- ride store: `{ engine: RideEngine|null; view: RideView|null; state: RideState; lapRows: LapRow[]; countdownLeft: number|null; begin(): void; pause(); resume(); lap(); stop(); save(): Promise<SessionRecord>; discard(): void }` — `begin` creates the engine from current rider + settings, runs the countdown (setInterval 1 s), then `start()` and a 1 s `setInterval` that calls `engine.tick(live.snapshot(Date.now()))` and refreshes `view`.
- `format.ts`: `fmtDuration(s): 'h:mm:ss'`, `fmtDistance(m, unit): string` (km 2 dp or mi), `fmtSpeed(ms, unit)`, `fmtDate(ms): 'dd MMMM yyyy, HH:mm:ss'`.

- [ ] **Step 1: Failing tests**

`src/app/format.test.ts`:
```ts
import { fmtDuration, fmtDistance, fmtSpeed, fmtDate } from './format';
describe('format', () => {
  it('duration h:mm:ss', () => { expect(fmtDuration(3661)).toBe('1:01:01'); expect(fmtDuration(59)).toBe('0:00:59'); });
  it('distance and speed per unit system', () => {
    expect(fmtDistance(1234, 'metric')).toBe('1.23 km'); expect(fmtDistance(1609.344, 'imperial')).toBe('1.00 mi');
    expect(fmtSpeed(10, 'metric')).toBe('36.0 km/h'); expect(fmtSpeed(10, 'imperial')).toBe('22.4 mph');
  });
  it('vendor date format', () => { expect(fmtDate(Date.UTC(2026, 9, 14, 6, 5, 9) + new Date().getTimezoneOffset() * 60000)).toBe('14 October 2026, 06:05:09'); });
});
```

`src/app/stores.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { useSettings } from './settings-store';
import { useRiders } from './rider-store';
import { useRide } from './ride-store';
import { useSensors } from './sensor-store';
import { newRider } from '../data/riders';

describe('settings store', () => {
  it('has vendor defaults and persists device per slot', () => {
    const s = useSettings.getState();
    expect(s).toMatchObject({ unitSystem: 'metric', countdownS: 0, smoothingN: 1, wheelMm: 1782, structuredWorkoutEnabled: false, licenseAccepted: false });
    s.setDevice('hr', { slot: 'hr', id: 'x', name: 'Strap' });
    expect(useSettings.getState().devices.hr?.name).toBe('Strap');
    expect(JSON.parse(localStorage.getItem('ig.settings')!).state.devices.hr.id).toBe('x');
  });
});

describe('ride store', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('begin → countdown → recording → save writes a session for the current rider', async () => {
    const r = newRider({ name: 'Ann', email: 'a@x' });
    await useRiders.getState().save(r); useRiders.getState().select(r.id);
    useSettings.getState().set({ countdownS: 5 });
    useSensors.getState().live.setPaired([]);
    useRide.getState().begin();
    expect(useRide.getState().countdownLeft).toBe(5);
    vi.advanceTimersByTime(5000);
    expect(useRide.getState().state).toBe('recording');
    vi.advanceTimersByTime(3000);
    expect(useRide.getState().view?.elapsedS).toBeGreaterThanOrEqual(3);
    useRide.getState().lap(); expect(useRide.getState().lapRows).toHaveLength(1);
    useRide.getState().stop();
    const saved = await useRide.getState().save();
    expect(saved).toMatchObject({ riderId: r.id, riderName: 'Ann', sport: 'indoor_cycling' });
    expect(saved.nSamples).toBeGreaterThanOrEqual(3);
    expect(useRide.getState().state).toBe('idle');
  });
  it('discard resets without writing', async () => {
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin(); vi.advanceTimersByTime(1000);
    useRide.getState().stop(); useRide.getState().discard();
    expect(useRide.getState().engine).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/app/format.ts`:
```ts
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const p = (n: number) => String(n).padStart(2, '0');
export const fmtDuration = (s: number) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; };
export const fmtDistance = (m: number, u: 'metric' | 'imperial') => (u === 'metric' ? `${(m / 1000).toFixed(2)} km` : `${(m / 1609.344).toFixed(2)} mi`);
export const fmtSpeed = (ms: number, u: 'metric' | 'imperial') => (u === 'metric' ? `${(ms * 3.6).toFixed(1)} km/h` : `${(ms * 2.236936).toFixed(1)} mph`);
export const fmtDate = (ms: number) => { const d = new Date(ms); return `${p(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
```

`src/app/settings-store.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PairedDevice, Slot } from '../sensors/types';
export interface Settings { unitSystem: 'metric' | 'imperial'; countdownS: 0 | 5 | 3600 | 7200 | 10800; smoothingN: 1 | 5 | 10 | 30; wheelMm: number; structuredWorkoutEnabled: boolean; licenseAccepted: boolean; devices: Partial<Record<Slot, PairedDevice>>; workoutId: string | null }
interface Actions { set(p: Partial<Settings>): void; setDevice(slot: Slot, d: PairedDevice | undefined): void }
export const useSettings = create<Settings & Actions>()(persist((set) => ({
  unitSystem: 'metric', countdownS: 0, smoothingN: 1, wheelMm: 1782, structuredWorkoutEnabled: false, licenseAccepted: false, devices: {}, workoutId: null,
  set: (p) => set(p),
  setDevice: (slot, d) => set((s) => { const devices = { ...s.devices }; if (d) devices[slot] = d; else delete devices[slot]; return { devices }; }),
}), { name: 'ig.settings' }));
```

`src/app/rider-store.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Rider, listRiders, putRider, deleteRider } from '../data/riders';
interface S { riders: Rider[]; currentId: string | null; load(): Promise<void>; save(r: Rider): Promise<void>; remove(id: string): Promise<void>; select(id: string | null): void; current(): Rider | undefined }
export const useRiders = create<S>()(persist((set, get) => ({
  riders: [], currentId: null,
  load: async () => set({ riders: await listRiders() }),
  save: async (r) => { await putRider(r); await get().load(); },
  remove: async (id) => { await deleteRider(id); if (get().currentId === id) set({ currentId: null }); await get().load(); },
  select: (id) => set({ currentId: id }),
  current: () => get().riders.find((r) => r.id === get().currentId),
}), { name: 'ig.rider', partialize: (s) => ({ currentId: s.currentId }) as S }));
```

`src/app/sensor-store.ts`:
```ts
import { create } from 'zustand';
import { BleAdapter } from '../sensors/ble/adapter';
import { LiveStore } from '../sensors/live-store';
import { SensorKind, SensorState, Slot, SLOT_PRIORITY } from '../sensors/types';
import { useSettings } from './settings-store';

interface S { adapter: BleAdapter; live: LiveStore; states: Record<Slot, SensorState>; messages: Partial<Record<Slot, string>>; values: Partial<Record<SensorKind, number>>; pair(slot: Slot): Promise<void>; forget(slot: Slot): Promise<void>; reconnectAll(): Promise<void> }
const adapter = new BleAdapter({ circumferenceMm: () => useSettings.getState().wheelMm });
const live = new LiveStore();
const pairedSlots = () => SLOT_PRIORITY.filter((s) => useSettings.getState().devices[s]);
live.setPaired(pairedSlots());
useSettings.subscribe(() => live.setPaired(pairedSlots()));

export const useSensors = create<S>((set, get) => {
  adapter.onReading((r) => { if (live.accept(r)) set((s) => ({ values: { ...s.values, [r.kind]: r.value } })); });
  adapter.onState((slot, st, msg) => set((s) => ({ states: { ...s.states, [slot]: st }, messages: { ...s.messages, [slot]: msg } })));
  return {
    adapter, live, states: { hr: 'unpaired', power: 'unpaired', csc: 'unpaired', trainer: 'unpaired' }, messages: {}, values: {},
    pair: async (slot) => { try { const d = await adapter.pair(slot); useSettings.getState().setDevice(slot, d); } catch (e) { set((s) => ({ states: { ...s.states, [slot]: 'unpaired' }, messages: { ...s.messages, [slot]: (e as Error).message } })); } },
    forget: async (slot) => { const d = useSettings.getState().devices[slot]; if (d) await adapter.disconnect(d); useSettings.getState().setDevice(slot, undefined); },
    reconnectAll: async () => { for (const slot of pairedSlots()) { const d = useSettings.getState().devices[slot]!; if (get().states[slot] !== 'connected') await adapter.connect(d); } },
  };
});
```

`src/app/ride-store.ts`:
```ts
import { create } from 'zustand';
import { RideEngine, RideState, RideView } from '../engine/ride';
import type { LapRow } from '../engine/laps';
import { saveSession, SessionRecord } from '../data/sessions';
import { remote } from '../data/remote';
import { useRiders } from './rider-store';
import { useSettings } from './settings-store';
import { useSensors } from './sensor-store';

interface S { engine: RideEngine | null; view: RideView | null; state: RideState; lapRows: LapRow[]; countdownLeft: number | null; begin(): void; pause(): void; resume(): void; lap(): void; stop(): void; save(): Promise<SessionRecord>; discard(): void }
let timer: ReturnType<typeof setInterval> | null = null;
const clear = () => { if (timer) clearInterval(timer); timer = null; };

export const useRide = create<S>((set, get) => ({
  engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null,
  begin: () => {
    const rider = useRiders.getState().current();
    const st = useSettings.getState();
    const engine = new RideEngine({ rider: { weightKg: rider?.weightKg ?? 70, ftpW: rider?.ftpW ?? 250, cpW: rider?.cpW, wprimeKj: rider?.wprimeKj ?? 20, hrMax: rider?.hrMax ?? 180 }, smoothingN: st.smoothingN });
    set({ engine, lapRows: [], view: null, state: 'idle' });
    const run = () => {
      engine.start(); set({ countdownLeft: null, state: 'recording' });
      clear();
      timer = setInterval(() => { engine.tick(useSensors.getState().live.snapshot(Date.now())); set({ view: engine.view, state: engine.state }); }, 1000);
    };
    if (st.countdownS > 0) {
      set({ countdownLeft: st.countdownS });
      clear();
      timer = setInterval(() => { const left = (get().countdownLeft ?? 1) - 1; if (left <= 0) run(); else set({ countdownLeft: left }); }, 1000);
    } else run();
  },
  pause: () => { get().engine?.pause(); set({ state: 'paused' }); },
  resume: () => { get().engine?.resume(); set({ state: 'recording' }); },
  lap: () => { const e = get().engine; if (!e || e.state !== 'recording') return; e.lap(); set({ lapRows: [...e.laps.rows], view: e.view }); },
  stop: () => { const e = get().engine; if (!e) return; e.stop(); clear(); set({ state: 'stopped', view: e.view, countdownLeft: null }); },
  save: async () => {
    const e = get().engine; if (!e) throw new Error('no ride');
    const rider = useRiders.getState().current();
    const v = e.view;
    const s: SessionRecord = { id: e.startMs, riderId: rider?.id ?? '', riderName: rider?.name ?? 'Guest', sport: 'indoor_cycling', startMs: e.startMs, durationS: Math.max(0, v.elapsedS - 1), distanceM: v.distanceM, calories: v.calories, nSamples: e.samples.length, avgPower: v.avgPower, maxPower: v.maxPower, avgHr: v.avgHr, maxHr: v.maxHr, avgCad: v.avgCad, uploaded: null, synced: false };
    await saveSession(s, e.laps.rows, e.samples);
    if (remote.enabled) void remote.pushSession(s);
    set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null });
    return s;
  },
  discard: () => { clear(); set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null }); },
}));
```

`src/ui/Shell.tsx` (nav frame used by every screen):
```tsx
import { Link, useLocation } from 'react-router-dom';
export default function Shell({ title, children, back = true }: { title: string; children: React.ReactNode; back?: boolean }) {
  const loc = useLocation();
  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gg-line bg-gg-panel">
        {back && loc.pathname !== '/' && <Link to="/" className="text-gg-accent font-semibold" aria-label="Home">‹</Link>}
        <h1 className="text-lg">{title}</h1>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
```

`src/App.tsx`:
```tsx
import { Routes, Route } from 'react-router-dom';
import Home from './ui/Home';
import RiderScreen from './ui/RiderScreen';
import SensorsScreen from './ui/SensorsScreen';
import TrainingScreen from './ui/TrainingScreen';
import LogsScreen from './ui/LogsScreen';
import SessionDetail from './ui/SessionDetail';
import WorkoutsScreen from './ui/WorkoutsScreen';
import SettingsScreen from './ui/SettingsScreen';
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rider" element={<RiderScreen />} />
      <Route path="/sensors" element={<SensorsScreen />} />
      <Route path="/training" element={<TrainingScreen />} />
      <Route path="/logs" element={<LogsScreen />} />
      <Route path="/logs/:id" element={<SessionDetail />} />
      <Route path="/workouts" element={<WorkoutsScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
    </Routes>
  );
}
```
Until Tasks 14–17 land, create each screen file as `export default function X(){ return null }` placeholders so the build passes; Task 14 onwards replaces them.

- [ ] **Step 4: Run** `npx vitest run src/app` → PASS. `npm run build` → OK. **Step 5: Commit** `feat(app): settings, rider, sensor and ride stores; route shell`.

---

### Task 14: Home, Terms dialog, Rider screen

**Files:**
- Create: `src/ui/Home.tsx`, `src/ui/TermsDialog.tsx`, `src/ui/RiderScreen.tsx`
- Test: `src/ui/Home.test.tsx`, `src/ui/RiderScreen.test.tsx`

**Interfaces:** screens only; consume `useSettings`, `useRiders`.

- [ ] **Step 1: Failing tests**

`src/ui/Home.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useSettings } from '../app/settings-store';
describe('Home', () => {
  it('shows the five vendor tiles and gates on terms', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByText(/terms/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    for (const t of ['TRAINING', 'ACTIVITY LOGS', 'SETTINGS', 'STRUCTURED WORKOUTS', 'SENSORS']) expect(screen.getByRole('link', { name: t })).toBeInTheDocument();
    expect(useSettings.getState().licenseAccepted).toBe(true);
  });
});
```

`src/ui/RiderScreen.test.tsx`:
```tsx
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RiderScreen from './RiderScreen';
import { useRiders } from '../app/rider-store';
describe('RiderScreen', () => {
  it('adds a rider with vendor defaults and selects it', async () => {
    render(<MemoryRouter><RiderScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /add rider/i }));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Ann' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ann@x.za' } });
    fireEvent.change(screen.getByLabelText(/ftp/i), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(useRiders.getState().riders.map((r) => r.name)).toEqual(['Ann']));
    fireEvent.click(await screen.findByRole('button', { name: /Ann/ }));
    expect(useRiders.getState().current()?.ftpW).toBe(300);
    expect(useRiders.getState().current()?.hrMax).toBe(180);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/ui/TermsDialog.tsx`:
```tsx
export default function TermsDialog({ onAccept }: { onAccept: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/80 flex items-center justify-center p-6">
      <div className="bg-gg-panel border border-gg-line rounded p-5 max-w-md space-y-3">
        <h2 className="text-xl">Terms and privacy</h2>
        <p className="text-gg-muted text-sm">This app records your heart rate, power, cadence and speed during studio rides and stores them on this device. Sessions can be exported as FIT files. Nothing leaves the device unless you export or connect a service.</p>
        <button className="w-full bg-gg-accent text-black font-semibold rounded py-2" onClick={onAccept}>Accept</button>
      </div>
    </div>
  );
}
```

`src/ui/Home.tsx`:
```tsx
import { Link } from 'react-router-dom';
import { useSettings } from '../app/settings-store';
import { useRiders } from '../app/rider-store';
import TermsDialog from './TermsDialog';
const TILES: [string, string][] = [['TRAINING', '/training'], ['ACTIVITY LOGS', '/logs'], ['SETTINGS', '/settings'], ['STRUCTURED WORKOUTS', '/workouts'], ['SENSORS', '/sensors']];
export default function Home() {
  const accepted = useSettings((s) => s.licenseAccepted);
  const set = useSettings((s) => s.set);
  const rider = useRiders((s) => s.current());
  return (
    <div className="min-h-full p-4 flex flex-col gap-4">
      {!accepted && <TermsDialog onAccept={() => set({ licenseAccepted: true })} />}
      <header className="flex items-baseline justify-between"><h1 className="text-2xl">Granny Gear</h1><Link to="/rider" className="text-gg-accent text-sm">{rider ? rider.name : 'Choose rider'}</Link></header>
      <nav className="grid grid-cols-1 gap-3">
        {TILES.map(([label, to]) => <Link key={to} to={to} className="block rounded bg-gg-panel border border-gg-line px-4 py-5 text-lg font-heading font-semibold tracking-wide">{label}</Link>)}
      </nav>
      <footer className="mt-auto text-xs text-gg-muted">indoorgranny_26 · phase 1</footer>
    </div>
  );
}
```

`src/ui/RiderScreen.tsx`:
```tsx
import { useEffect, useState } from 'react';
import Shell from './Shell';
import { useRiders } from '../app/rider-store';
import { newRider, Rider } from '../data/riders';
const num = (v: string, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export default function RiderScreen() {
  const { riders, currentId, load, save, remove, select } = useRiders();
  const [edit, setEdit] = useState<Partial<Rider> | null>(null);
  useEffect(() => { void load(); }, [load]);
  const field = (id: keyof Rider, label: string, type = 'text') => (
    <label className="block text-sm" htmlFor={`f-${id}`}>{label}
      <input id={`f-${id}`} type={type} className="mt-1 w-full rounded bg-gg-bg border border-gg-line px-2 py-1" value={String(edit?.[id] ?? '')} onChange={(e) => setEdit({ ...edit, [id]: type === 'number' ? e.target.value : e.target.value })} />
    </label>
  );
  return (
    <Shell title="Rider">
      {edit ? (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = newRider({ ...(edit as any), name: String(edit.name ?? ''), email: String(edit.email ?? ''), weightKg: num(String(edit.weightKg ?? ''), 70), ftpW: num(String(edit.ftpW ?? ''), 250), cpW: edit.cpW ? num(String(edit.cpW), 250) : undefined, wprimeKj: num(String(edit.wprimeKj ?? ''), 20), hrMax: num(String(edit.hrMax ?? ''), 180) }); await save(r); setEdit(null); }}>
          {field('name', 'Name')}{field('email', 'Email', 'email')}{field('weightKg', 'Weight (kg)', 'number')}{field('ftpW', 'FTP (W)', 'number')}{field('cpW', 'CP (W, blank = FTP)', 'number')}{field('wprimeKj', "W' (kJ)", 'number')}{field('hrMax', 'HR max (bpm)', 'number')}
          <div className="flex gap-2"><button className="bg-gg-accent text-black font-semibold rounded px-4 py-2" type="submit">Save</button><button type="button" className="border border-gg-line rounded px-4 py-2" onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y divide-gg-line">
            {riders.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <button className={`text-left ${r.id === currentId ? 'text-gg-accent' : ''}`} onClick={() => select(r.id)}>{r.name} <span className="text-gg-muted text-xs">FTP {r.ftpW} W · {r.weightKg} kg</span></button>
                <span className="flex gap-3 text-sm"><button onClick={() => setEdit(r)}>Edit</button><button className="text-red-400" onClick={() => void remove(r.id)}>Delete</button></span>
              </li>
            ))}
          </ul>
          <button className="bg-gg-accent text-black font-semibold rounded px-4 py-2" onClick={() => setEdit({})}>Add rider</button>
        </div>
      )}
    </Shell>
  );
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(ui): home tiles, terms dialog, rider screen`.

---

### Task 15: Sensors screen

**Files:**
- Create: `src/ui/SensorsScreen.tsx`
- Test: `src/ui/SensorsScreen.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SensorsScreen from './SensorsScreen';
import { useSensors } from '../app/sensor-store';
import { useSettings } from '../app/settings-store';
describe('SensorsScreen', () => {
  it('renders four slots, shows paired name + live value, calls pair/forget', () => {
    const pair = vi.fn(async () => {}); const forget = vi.fn(async () => {});
    useSensors.setState({ pair, forget, values: { hr: 123 }, states: { hr: 'connected', power: 'unpaired', csc: 'unpaired', trainer: 'unpaired' } });
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getByText('Polar H10')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pair power/i })); expect(pair).toHaveBeenCalledWith('power');
    fireEvent.click(screen.getByRole('button', { name: /forget heart rate/i })); expect(forget).toHaveBeenCalledWith('hr');
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/ui/SensorsScreen.tsx`:
```tsx
import Shell from './Shell';
import { useSensors } from '../app/sensor-store';
import { useSettings } from '../app/settings-store';
import { BleAdapter } from '../sensors/ble/adapter';
import type { Slot } from '../sensors/types';
const SLOTS: { slot: Slot; label: string; value: (v: Record<string, number | undefined>) => string }[] = [
  { slot: 'hr', label: 'Heart rate', value: (v) => v.hr !== undefined ? String(v.hr) : '—' },
  { slot: 'power', label: 'Power', value: (v) => v.power !== undefined ? `${Math.round(v.power)} W` : '—' },
  { slot: 'csc', label: 'Speed / cadence', value: (v) => `${v.speedMs !== undefined ? (v.speedMs * 3.6).toFixed(1) + ' km/h' : '—'} · ${v.cadence !== undefined ? Math.round(v.cadence) + ' rpm' : '—'}` },
  { slot: 'trainer', label: 'Trainer', value: (v) => v.power !== undefined ? `${Math.round(v.power)} W` : '—' },
];
export default function SensorsScreen() {
  const { states, messages, values, pair, forget, reconnectAll } = useSensors();
  const devices = useSettings((s) => s.devices);
  const v = { ...values, speedMs: values.speed };
  return (
    <Shell title="Sensors">
      {!BleAdapter.available() && <p className="mb-3 text-sm text-yellow-400">Web Bluetooth is not available here. Use Chrome on Android (6.0 or newer).</p>}
      <ul className="space-y-3">
        {SLOTS.map(({ slot, label, value }) => {
          const d = devices[slot];
          return (
            <li key={slot} className="rounded bg-gg-panel border border-gg-line p-3">
              <div className="flex items-center justify-between"><span className="font-heading font-semibold">{label}</span><span className={`text-xs ${states[slot] === 'connected' ? 'text-green-400' : 'text-gg-muted'}`}>{states[slot]}</span></div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm">{d ? d.name : <span className="text-gg-muted">not paired</span>}</span>
                <span className="font-mono text-lg tabular-nums">{value(v)}</span>
              </div>
              {messages[slot] && <p className="text-xs text-yellow-400 mt-1">{messages[slot]}</p>}
              <div className="mt-2 flex gap-2 text-sm">
                {d ? <button className="border border-gg-line rounded px-3 py-1" onClick={() => void forget(slot)} aria-label={`Forget ${label}`}>Forget</button> : null}
                <button className="bg-gg-accent text-black rounded px-3 py-1 font-semibold" onClick={() => void pair(slot)} aria-label={`Pair ${label}`}>{d ? 'Pair again' : 'Pair'}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button className="mt-4 w-full border border-gg-line rounded py-2" onClick={() => void reconnectAll()}>Reconnect all</button>
    </Shell>
  );
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(ui): sensors screen with four pairing slots`.

---

### Task 16: Training screen (tiles, lap table, charts, controls, countdown, workout panel)

**Files:**
- Create: `src/ui/TrainingScreen.tsx`, `src/ui/components/Tile.tsx`, `src/ui/components/LapTable.tsx`, `src/ui/components/RollingChart.tsx`, `src/ui/components/CountdownModal.tsx`, `src/ui/components/WorkoutPanel.tsx`, `src/ui/useWakeLock.ts`
- Test: `src/ui/TrainingScreen.test.tsx`, `src/ui/components/LapTable.test.tsx`

**Interfaces:**
- `Tile({ label, value, sub, cls })`, `LapTable({ rows: LapRow[]; now: { number, durationS, avgSpeedMs?, distanceM, avgPower, avgHr, avgCad }; zones: Zone[]; unit })` — renders newest first, 8 columns Lap / Time / Avg Speed / Distance / Avg Power / Avg HR / %dif HR / Avg CAD, row class from `zoneIndex`.
- `RollingChart({ series: { label: string; data: number[]; min: number; max: number; color: string }[]; window?: 800 })` — one Chart.js line chart, no animation, `maintainAspectRatio: false`.
- `CountdownModal({ left: number; onSkip(): void })`.
- `WorkoutPanel({ workout: Workout; elapsedS: number; ftpW: number; hrMax: number; pctFtp: number; pctHr: number })` — stepped profile chart + targets + interval countdown.
- `useWakeLock(active: boolean)` — requests `navigator.wakeLock` when active, releases otherwise, tolerates rejection.

- [ ] **Step 1: Failing tests**

`src/ui/components/LapTable.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import LapTable from './LapTable';
import { powerZones } from '../../engine/zones';
const rows = [
  { number: 1, startOffsetS: 0, durationS: 60, distanceM: 500, calories: 10, avgPower: 150, avgCad: 85, avgSpeedMs: 8, avgHr: 130, difHrPct: null },
  { number: 2, startOffsetS: 60, durationS: 60, distanceM: 600, calories: 12, avgPower: 260, avgCad: 90, avgSpeedMs: 10, avgHr: 143, difHrPct: 10 },
];
describe('LapTable', () => {
  it('renders the vendor columns newest first with zone colouring and a NOW row', () => {
    render(<LapTable rows={rows} now={{ number: 3, durationS: 5, distanceM: 20, avgPower: 100, avgHr: 120, avgCad: 80, avgSpeedMs: 7 }} zones={powerZones(250)} unit="metric" />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Lap', 'Time', 'Avg Speed', 'Distance', 'Avg Power', 'Avg HR', '%dif HR', 'Avg CAD']);
    const cells = screen.getAllByRole('row').map((r) => r.textContent);
    expect(cells[1]).toContain('NOW'); expect(cells[2]).toContain('2'); expect(cells[2]).toContain('+10.0%');
    expect(screen.getAllByRole('row')[2].className).toContain('z3');   // 260 W at FTP 250 → zone 4 index 3 → class z4? see note
  });
});
```
Note: `zoneIndex(powerZones(250), 260)` is 3 (Threshold, "z4"); the row class is `zone.cls`, so the assertion must be `toContain('z4')`. Write the assertion as `z4`.

`src/ui/TrainingScreen.test.tsx`:
```tsx
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrainingScreen from './TrainingScreen';
import { useRide } from '../app/ride-store';
import { useSettings } from '../app/settings-store';
describe('TrainingScreen', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('Start → tiles live → Lap → Stop → confirm → Save prompt', async () => {
    useSettings.getState().set({ countdownS: 0 });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(useRide.getState().state).toBe('recording');
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^lap$/i }));
    expect(useRide.getState().lapRows).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(screen.getByText(/STOP this session\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /yes, stop/i }));
    expect(screen.getByText(/save it\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(useRide.getState().engine).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/ui/components/Tile.tsx`:
```tsx
export default function Tile({ label, value, sub, cls = '' }: { label: string; value: string | number; sub?: string; cls?: string }) {
  return (
    <div className={`rounded bg-gg-panel border border-gg-line p-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wide text-gg-muted">{label}</div>
      <div className="text-2xl font-heading font-semibold tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-xs text-gg-muted tabular-nums">{sub}</div>}
    </div>
  );
}
```

`src/ui/components/LapTable.tsx`:
```tsx
import type { LapRow } from '../../engine/laps';
import { Zone, zoneIndex } from '../../engine/zones';
import { fmtDuration, fmtDistance, fmtSpeed } from '../../app/format';
type Now = { number: number; durationS: number; distanceM: number; avgPower: number; avgHr: number; avgCad: number; avgSpeedMs: number };
const ZONE_BG: Record<string, string> = { z1: 'z1 bg-zone-z1/20', z2: 'z2 bg-zone-z2/20', z3: 'z3 bg-zone-z3/20', z4: 'z4 bg-zone-z4/20', z5: 'z5 bg-zone-z5/20', z6: 'z6 bg-zone-z6/20', z7: 'z7 bg-zone-z7/20' };
export default function LapTable({ rows, now, zones, unit }: { rows: LapRow[]; now: Now; zones: Zone[]; unit: 'metric' | 'imperial' }) {
  const cls = (w: number) => ZONE_BG[zones[zoneIndex(zones, w)].cls];
  const cell = (r: Now | LapRow, lap: string, dif: string) => (
    <>
      <td className="px-1">{lap}</td><td className="px-1 tabular-nums">{fmtDuration(r.durationS)}</td><td className="px-1">{fmtSpeed(r.avgSpeedMs, unit)}</td><td className="px-1">{fmtDistance(r.distanceM, unit)}</td>
      <td className="px-1">{Math.round(r.avgPower)}</td><td className="px-1">{Math.round(r.avgHr)}</td><td className="px-1">{dif}</td><td className="px-1">{Math.round(r.avgCad)}</td>
    </>
  );
  return (
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr>{['Lap', 'Time', 'Avg Speed', 'Distance', 'Avg Power', 'Avg HR', '%dif HR', 'Avg CAD'].map((h) => <th key={h} className="text-left px-1 py-1 text-gg-muted font-normal">{h}</th>)}</tr></thead>
      <tbody>
        <tr className={cls(now.avgPower)}>{cell(now, 'NOW', '')}</tr>
        {[...rows].reverse().map((r) => <tr key={r.number} className={cls(r.avgPower)}>{cell(r, String(r.number), r.difHrPct === null ? '' : `${r.difHrPct >= 0 ? '+' : ''}${r.difHrPct.toFixed(1)}%`)}</tr>)}
      </tbody>
    </table></div>
  );
}
```

`src/ui/components/RollingChart.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale);
export interface Series { label: string; data: number[]; min: number; max: number; color: string }
export default function RollingChart({ series, window = 800, height = 120 }: { series: Series[]; window?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null); const chart = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new Chart(ref.current, { type: 'line', data: { labels: [], datasets: [] }, options: { animation: false, responsive: true, maintainAspectRatio: false, elements: { point: { radius: 0 }, line: { borderWidth: 1.5 } }, scales: { x: { display: false } }, plugins: { legend: { display: false } } } });
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => {
    const c = chart.current; if (!c) return;
    const n = Math.max(...series.map((s) => s.data.length), 0);
    c.data.labels = Array.from({ length: Math.min(n, window) }, (_, i) => i);
    c.data.datasets = series.map((s, i) => ({ label: s.label, data: s.data.slice(-window), borderColor: s.color, yAxisID: `y${i}` }));
    c.options.scales = { x: { display: false }, ...Object.fromEntries(series.map((s, i) => [`y${i}`, { min: s.min, max: s.max, display: i === 0, position: 'left' }])) };
    c.update('none');
  }, [series, window]);
  return <div style={{ height }}><canvas ref={ref} /></div>;
}
```

`src/ui/components/CountdownModal.tsx`:
```tsx
import { fmtDuration } from '../../app/format';
export default function CountdownModal({ left, onSkip }: { left: number; onSkip: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/80 flex items-center justify-center" onClick={onSkip}>
      <div className="text-center"><div className="text-6xl font-heading font-bold tabular-nums">{left < 60 ? left : fmtDuration(left)}</div><div className="text-gg-muted mt-2">tap to start now</div></div>
    </div>
  );
}
```

`src/ui/components/WorkoutPanel.tsx`:
```tsx
import { useMemo } from 'react';
import { Workout, workoutAt, targetWatts } from '../../engine/workout';
export default function WorkoutPanel({ workout, elapsedS, ftpW, pctFtp, pctHr }: { workout: Workout; elapsedS: number; ftpW: number; hrMax: number; pctFtp: number; pctHr: number }) {
  const at = workoutAt(workout, elapsedS);
  const total = workout.timeS.reduce((a, b) => a + b, 0);
  const maxPct = Math.max(100, ...workout.pwrS, ...workout.hrS);
  const steps = useMemo(() => { let x = 0; return workout.timeS.map((t, i) => { const s = { x, w: t, v: workout.type === 'HR' ? workout.hrS[i] : workout.pwrS[i] }; x += t; return s; }); }, [workout]);
  const live = workout.type === 'HR' ? pctHr : pctFtp;
  return (
    <section className="rounded bg-gg-panel border border-gg-line p-3">
      <div className="flex justify-between text-sm"><span className="font-heading font-semibold">{workout.title}</span><span className="tabular-nums">{at ? `${at.remainingS}s left in step ${at.step + 1}/${workout.timeS.length}` : 'workout complete'}</span></div>
      <svg viewBox={`0 0 ${total} ${maxPct}`} preserveAspectRatio="none" className="w-full h-20 mt-2" role="img" aria-label="workout profile">
        {steps.map((s, i) => <rect key={i} x={s.x} y={maxPct - s.v} width={s.w} height={s.v} fill={i === at?.step ? '#f28c1b' : '#3a3a3a'} />)}
        <line x1={Math.min(elapsedS, total)} x2={Math.min(elapsedS, total)} y1={0} y2={maxPct} stroke="#f2f2f2" strokeWidth={total / 300} />
        <circle cx={Math.min(elapsedS, total)} cy={Math.max(0, maxPct - live)} r={total / 150} fill="#2ecc71" />
      </svg>
      {at && (
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          <div><div className="text-[11px] text-gg-muted">TARGET W</div><div className="text-xl tabular-nums">{targetWatts(at.pctFtp, ftpW)}</div></div>
          <div><div className="text-[11px] text-gg-muted">TARGET CAD</div><div className="text-xl tabular-nums">{at.cadence}</div></div>
          <div><div className="text-[11px] text-gg-muted">TARGET %HR</div><div className="text-xl tabular-nums">{at.pctHr}</div></div>
        </div>
      )}
    </section>
  );
}
```

`src/ui/useWakeLock.ts`:
```ts
import { useEffect } from 'react';
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const req = () => navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {});
    void req();
    const onVis = () => { if (document.visibilityState === 'visible') void req(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release(); };
  }, [active]);
}
```

`src/ui/TrainingScreen.tsx`:
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from './Shell';
import Tile from './components/Tile';
import LapTable from './components/LapTable';
import RollingChart from './components/RollingChart';
import CountdownModal from './components/CountdownModal';
import WorkoutPanel from './components/WorkoutPanel';
import { useWakeLock } from './useWakeLock';
import { useRide } from '../app/ride-store';
import { useRiders } from '../app/rider-store';
import { useSettings } from '../app/settings-store';
import { useSensors } from '../app/sensor-store';
import { powerZones, hrBand } from '../engine/zones';
import { fmtDuration, fmtDistance, fmtSpeed } from '../app/format';
import { parseWorkout } from '../engine/workout';
import { useWorkouts } from '../app/workout-store';

const HR_BG: Record<string, string> = { z1: 'bg-sky-900/40', z2: 'bg-green-900/40', z3: 'bg-yellow-900/40', z4: 'bg-orange-900/40', z5: 'bg-red-900/50' };

export default function TrainingScreen() {
  const ride = useRide();
  const rider = useRiders((s) => s.current());
  const st = useSettings();
  const nav = useNavigate();
  const { reconnectAll } = useSensors();
  const [confirmStop, setConfirmStop] = useState(false);
  const [askSave, setAskSave] = useState(false);
  const [hist, setHist] = useState<{ hr: number[]; power: number[]; cad: number[]; wbal: number[] }>({ hr: [], power: [], cad: [], wbal: [] });
  const zones = useMemo(() => powerZones(rider?.ftpW ?? 250, rider?.powerZones), [rider]);
  const workoutJson = useWorkouts((s) => s.selected());
  const workout = useMemo(() => (workoutJson ? parseWorkout(workoutJson) : null), [workoutJson]);
  const riding = ride.state === 'recording' || ride.state === 'paused';
  useWakeLock(riding);
  useEffect(() => { void reconnectAll(); }, [reconnectAll]);
  useEffect(() => {
    if (!riding) return;
    const onPop = () => { history.pushState(null, '', location.href); alert('Stop the activity first.'); };
    history.pushState(null, '', location.href); window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [riding]);
  const v = ride.view;
  useEffect(() => { if (!v || ride.state !== 'recording') return; setHist((h) => ({ hr: [...h.hr, v.hr].slice(-800), power: [...h.power, v.powerSmooth].slice(-800), cad: [...h.cad, v.cadenceSmooth].slice(-800), wbal: [...h.wbal, v.wbalRemainingJ / 1000].slice(-800) })); }, [v?.elapsedS]);
  const unit = st.unitSystem;
  const wide = typeof window !== 'undefined' && window.innerWidth >= 600;

  return (
    <Shell title="Training" back={!riding}>
      {ride.countdownLeft !== null && <CountdownModal left={ride.countdownLeft} onSkip={() => { ride.discard(); st.set({ countdownS: 0 }); ride.begin(); }} />}
      {confirmStop && <Dialog text="STOP this session?" yes="Yes, stop" onYes={() => { setConfirmStop(false); ride.stop(); setAskSave(true); }} onNo={() => setConfirmStop(false)} />}
      {askSave && <Dialog text="Do you want to save it?" yes="Save" no="Discard" onYes={async () => { setAskSave(false); await ride.save(); setHist({ hr: [], power: [], cad: [], wbal: [] }); nav('/logs'); }} onNo={() => { setAskSave(false); ride.discard(); setHist({ hr: [], power: [], cad: [], wbal: [] }); }} />}
      <div className="text-sm text-gg-muted mb-2">Rider: {rider?.name ?? 'Guest'}</div>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Elapsed" value={fmtDuration(v?.elapsedS ?? 0)} sub={`lap ${fmtDuration(v?.lapS ?? 0)}${v?.prevLapS != null ? ` · prev ${fmtDuration(v.prevLapS)}` : ''}`} />
        <Tile label="Power" value={Math.round(v?.powerSmooth ?? 0)} sub={`avg ${Math.round(v?.avgPower ?? 0)} · max ${Math.round(v?.maxPower ?? 0)}`} cls={`bg-zone-${zones[Math.max(0, zones.findIndex((z) => (v?.powerSmooth ?? 0) < (z.upperW ?? Infinity)))].cls}/20`} />
        <Tile label="Heart rate" value={Math.round(v?.hr ?? 0)} sub={`avg ${Math.round(v?.avgHr ?? 0)} · max ${Math.round(v?.maxHr ?? 0)}`} cls={HR_BG[hrBand(v?.pctHrMax ?? 0)]} />
        <Tile label="Cadence" value={Math.round(v?.cadenceSmooth ?? 0)} sub={`avg ${Math.round(v?.avgCad ?? 0)} · max ${Math.round(v?.maxCad ?? 0)}`} />
        <Tile label="%FTP" value={Math.round(v?.pctFtp ?? 0)} sub={`FTP ${rider?.ftpW ?? 250} W`} />
        <Tile label="%HRmax" value={Math.round(v?.pctHrMax ?? 0)} sub={`HRmax ${rider?.hrMax ?? 180}`} />
        <Tile label="Speed" value={fmtSpeed(v?.speedMs ?? 0, unit)} />
        <Tile label="Distance" value={fmtDistance(v?.distanceM ?? 0, unit)} />
        <Tile label="W'bal" value={`${(v?.wbalPct ?? 0).toFixed(0)}%`} sub="expended" />
        <Tile label="kJ" value={(v?.kJ ?? 0).toFixed(0)} sub={`${Math.round(v?.calories ?? 0)} kcal`} />
      </div>
      <div className="mt-3 space-y-2">
        <RollingChart series={[{ label: 'HR', data: hist.hr, min: 45, max: 220, color: '#e74c3c' }, { label: 'Power', data: hist.power, min: 0, max: 550, color: '#f28c1b' }]} />
        <RollingChart series={[{ label: 'Cadence', data: hist.cad, min: 0, max: 150, color: '#3498db' }, { label: "W'bal kJ", data: hist.wbal, min: 0, max: 50, color: '#2ecc71' }]} height={90} />
      </div>
      {workout && st.structuredWorkoutEnabled && wide && v && <div className="mt-3"><WorkoutPanel workout={workout} elapsedS={Math.max(0, v.elapsedS - 1)} ftpW={rider?.ftpW ?? 250} hrMax={rider?.hrMax ?? 180} pctFtp={v.pctFtp} pctHr={v.pctHrMax} /></div>}
      <div className="mt-3"><LapTable rows={ride.lapRows} now={{ number: v?.lapNumber ?? 1, durationS: v?.lapS ?? 0, distanceM: ride.engine?.laps.current.distanceM ?? 0, avgPower: ride.engine?.laps.current.avgPower ?? 0, avgHr: ride.engine?.laps.current.avgHr ?? 0, avgCad: ride.engine?.laps.current.avgCad ?? 0, avgSpeedMs: v?.speedMs ?? 0 }} zones={zones} unit={unit} /></div>
      <div className="sticky bottom-0 mt-4 grid grid-cols-3 gap-2 bg-gg-bg py-2">
        {ride.state === 'idle' && <button className="col-span-3 bg-gg-accent text-black font-semibold rounded py-3" onClick={() => ride.begin()}>Start</button>}
        {ride.state === 'recording' && <><button className="border border-gg-line rounded py-3" onClick={() => ride.pause()}>Pause</button><button className="bg-gg-accent text-black font-semibold rounded py-3" onClick={() => ride.lap()}>Lap</button><button className="bg-red-700 rounded py-3" onClick={() => setConfirmStop(true)}>Stop</button></>}
        {ride.state === 'paused' && <><button className="bg-gg-accent text-black font-semibold rounded py-3" onClick={() => ride.resume()}>Restart</button><span /><button className="bg-red-700 rounded py-3" onClick={() => setConfirmStop(true)}>Stop</button></>}
        {ride.state === 'stopped' && !askSave && <button className="col-span-3 border border-gg-line rounded py-3" onClick={() => setAskSave(true)}>Save or discard</button>}
      </div>
    </Shell>
  );
}

function Dialog({ text, yes, no = 'No', onYes, onNo }: { text: string; yes: string; no?: string; onYes: () => void; onNo: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-10">
      <div className="bg-gg-panel border border-gg-line rounded p-5 w-full max-w-sm space-y-4">
        <p className="text-lg">{text}</p>
        <div className="flex gap-2"><button className="flex-1 bg-gg-accent text-black font-semibold rounded py-2" onClick={onYes}>{yes}</button><button className="flex-1 border border-gg-line rounded py-2" onClick={onNo}>{no}</button></div>
      </div>
    </div>
  );
}
```

`src/app/workout-store.ts` (small, used by Tasks 16 and 17):
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseWorkout, Workout } from '../engine/workout';
interface S { workouts: Workout[]; selectedId: string | null; add(json: unknown): boolean; remove(id: string): void; select(id: string | null): void; selected(): Workout | null; loadBundled(): Promise<void> }
export const useWorkouts = create<S>()(persist((set, get) => ({
  workouts: [], selectedId: null,
  add: (json) => { const w = parseWorkout(json); if (!w) return false; set((s) => ({ workouts: [...s.workouts.filter((x) => x.id !== w.id), w] })); return true; },
  remove: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
  select: (id) => set({ selectedId: id }),
  selected: () => get().workouts.find((w) => w.id === get().selectedId) ?? null,
  loadBundled: async () => { try { const idx: string[] = await (await fetch('/workouts/index.json')).json(); for (const f of idx) get().add(await (await fetch(`/workouts/${f}`)).json()); } catch { /* offline or none bundled */ } },
}), { name: 'ig.workouts' }));
```
Also add `public/workouts/index.json` = `["sweetspot-3x10.json"]` and `public/workouts/sweetspot-3x10.json`:
```json
{ "id": "sweetspot-3x10", "title": "Sweet spot 3×10", "type": "PWR", "wdate": "2026-10-14", "totalduration": 2700,
  "timeS": [600, 600, 300, 600, 300, 600, 300, 300], "pwrS": [50, 88, 55, 88, 55, 88, 55, 40], "cadS": [85, 90, 85, 90, 85, 90, 85, 80], "hrS": [60, 85, 65, 85, 65, 85, 65, 55] }
```

- [ ] **Step 4: Run** `npx vitest run src/ui` → PASS; `npm run build` → OK. **Step 5: Commit** `feat(ui): training screen with tiles, laps, charts, countdown, workout panel`.

---

### Task 17: Activity logs, session detail, FIT share

**Files:**
- Create: `src/ui/LogsScreen.tsx`, `src/ui/SessionDetail.tsx`, `src/ui/share.ts`
- Test: `src/ui/LogsScreen.test.tsx`, `src/ui/share.test.ts`

**Interfaces:**
- `shareOrDownload(name: string, bytes: Uint8Array, mime: string): Promise<'shared' | 'downloaded'>` — Web Share with files when `navigator.canShare({ files })`, else an `<a download>` click.

- [ ] **Step 1: Failing tests**

`src/ui/share.test.ts`:
```ts
import { shareOrDownload } from './share';
describe('shareOrDownload', () => {
  it('downloads when Web Share with files is unavailable', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:x'); (globalThis.URL as any).revokeObjectURL = vi.fn();
    expect(await shareOrDownload('a.fit', new Uint8Array([1]), 'application/octet-stream')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });
});
```

`src/ui/LogsScreen.test.tsx`:
```tsx
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LogsScreen from './LogsScreen';
import { saveSession, listSessions } from '../data/sessions';
describe('LogsScreen', () => {
  it('lists sessions with vendor row fields and deletes one', async () => {
    await saveSession({ id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000000000, durationS: 3600, distanceM: 25000, calories: 600, nSamples: 3600, avgPower: 150, maxPower: 300, avgHr: 140, maxHr: 170, avgCad: 85, uploaded: null, synced: false }, [], []);
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    expect(await screen.findByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('1:00:00')).toBeInTheDocument();
    expect(screen.getByText('25.00 km')).toBeInTheDocument();
    expect(screen.getByText(/600 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(async () => expect(await listSessions()).toHaveLength(0));
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/ui/share.ts`:
```ts
export async function shareOrDownload(name: string, bytes: Uint8Array, mime: string): Promise<'shared' | 'downloaded'> {
  const file = new File([bytes], name, { type: mime });
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (n.canShare && n.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch { /* user cancelled → fall back */ } }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  return 'downloaded';
}
```

`src/ui/LogsScreen.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from './Shell';
import { listSessions, deleteSession, deleteAllSessions, getLaps, getSamples, SessionRecord } from '../data/sessions';
import { buildFit, fitFileName } from '../data/fit';
import { shareOrDownload } from './share';
import { fmtDate, fmtDuration, fmtDistance } from '../app/format';
import { useSettings } from '../app/settings-store';
export default function LogsScreen() {
  const [rows, setRows] = useState<SessionRecord[]>([]); const [open, setOpen] = useState<number | null>(null); const [confirmAll, setConfirmAll] = useState(false);
  const unit = useSettings((s) => s.unitSystem);
  const reload = async () => setRows(await listSessions());
  useEffect(() => { void reload(); }, []);
  const share = async (s: SessionRecord) => { const bytes = buildFit(s, await getLaps(s.id), await getSamples(s.id)); await shareOrDownload(fitFileName(s), bytes, 'application/vnd.ant.fit'); };
  return (
    <Shell title="Activity logs">
      <div className="flex justify-end mb-2"><button className="text-sm text-red-400" onClick={() => setConfirmAll(true)}>Delete all</button></div>
      {confirmAll && <div role="dialog" className="mb-3 rounded border border-red-700 p-3 text-sm">Delete every session on this device? <button className="ml-2 text-red-400" onClick={async () => { await deleteAllSessions(); setConfirmAll(false); await reload(); }}>Yes, delete all</button> <button className="ml-2" onClick={() => setConfirmAll(false)}>No</button></div>}
      {rows.length === 0 && <p className="text-gg-muted">No sessions yet.</p>}
      <ul className="divide-y divide-gg-line">
        {rows.map((s) => (
          <li key={s.id} className="py-3">
            <Link to={`/logs/${s.id}`} className="block">
              <div className="flex justify-between"><span>{fmtDate(s.startMs)}</span><span className="text-gg-muted text-sm">{s.uploaded ? `#${s.uploaded.remoteId}` : ''}</span></div>
              <div className="flex justify-between text-sm mt-1"><span>{s.riderName}</span><span className="tabular-nums">{fmtDuration(s.durationS)}</span><span>{fmtDistance(s.distanceM, unit)}</span><span>{Math.round(s.calories)} kcal</span></div>
            </Link>
            <button className="mt-1 text-xs text-gg-accent" aria-label={`Actions for ${fmtDate(s.startMs)}`} onClick={() => setOpen(open === s.id ? null : s.id)}>Actions</button>
            {open === s.id && (
              <div className="mt-2 flex gap-3 text-sm">
                <button className="border border-gg-line rounded px-3 py-1 text-gg-muted" disabled title="Available after the portal is connected">Upload</button>
                <button className="border border-gg-line rounded px-3 py-1" onClick={() => void share(s)}>Share as FIT</button>
                <button className="border border-red-700 text-red-400 rounded px-3 py-1" onClick={async () => { await deleteSession(s.id); setOpen(null); await reload(); }}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}
```

`src/ui/SessionDetail.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Shell from './Shell';
import LapTable from './components/LapTable';
import RollingChart from './components/RollingChart';
import { getSession, getLaps, getSamples, SessionRecord } from '../data/sessions';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';
import { powerZones } from '../engine/zones';
import { fmtDate, fmtDuration } from '../app/format';
import { useSettings } from '../app/settings-store';
export default function SessionDetail() {
  const { id } = useParams(); const unit = useSettings((s) => s.unitSystem);
  const [s, setS] = useState<SessionRecord | undefined>(); const [laps, setLaps] = useState<LapRow[]>([]); const [samples, setSamples] = useState<Sample[]>([]);
  useEffect(() => { const n = Number(id); void (async () => { setS(await getSession(n)); setLaps(await getLaps(n)); setSamples(await getSamples(n)); })(); }, [id]);
  if (!s) return <Shell title="Session">Loading…</Shell>;
  return (
    <Shell title={fmtDate(s.startMs)}>
      <p className="text-sm text-gg-muted mb-2">{s.riderName} · {fmtDuration(s.durationS)} · avg {Math.round(s.avgPower)} W · avg {Math.round(s.avgHr)} bpm · {Math.round(s.calories)} kcal</p>
      <RollingChart window={samples.length || 1} series={[{ label: 'HR', data: samples.map((x) => x.hr), min: 45, max: 220, color: '#e74c3c' }, { label: 'Power', data: samples.map((x) => x.power), min: 0, max: 550, color: '#f28c1b' }]} />
      <div className="mt-3"><LapTable rows={laps} now={{ number: laps.length + 1, durationS: 0, distanceM: 0, avgPower: 0, avgHr: 0, avgCad: 0, avgSpeedMs: 0 }} zones={powerZones(250)} unit={unit} /></div>
    </Shell>
  );
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(ui): activity logs, session detail, FIT share`.

---

### Task 18: Structured workouts screen and Settings screen

**Files:**
- Create: `src/ui/WorkoutsScreen.tsx`, `src/ui/SettingsScreen.tsx`
- Test: `src/ui/SettingsScreen.test.tsx`

- [ ] **Step 1: Failing test**

`src/ui/SettingsScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { useSettings } from '../app/settings-store';
describe('SettingsScreen', () => {
  it('exposes the vendor keys and writes them to the store', () => {
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/unit system/i), { target: { value: 'imperial' } });
    fireEvent.change(screen.getByLabelText(/countdown/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/smoothing/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/wheel/i), { target: { value: '2096' } });
    fireEvent.click(screen.getByLabelText(/structured workout/i));
    expect(useSettings.getState()).toMatchObject({ unitSystem: 'imperial', countdownS: 5, smoothingN: 10, wheelMm: 2096, structuredWorkoutEnabled: true });
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

`src/ui/SettingsScreen.tsx`:
```tsx
import Shell from './Shell';
import { useSettings } from '../app/settings-store';
import pkg from '../../package.json';
export default function SettingsScreen() {
  const s = useSettings();
  const sel = (id: string, label: string, value: string | number, opts: [string | number, string][], on: (v: string) => void) => (
    <label className="block text-sm" htmlFor={id}>{label}<select id={id} className="mt-1 w-full rounded bg-gg-bg border border-gg-line px-2 py-1" value={String(value)} onChange={(e) => on(e.target.value)}>{opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}</select></label>
  );
  return (
    <Shell title="Settings">
      <div className="space-y-4">
        {sel('unit', 'Unit system', s.unitSystem, [['metric', 'Metric'], ['imperial', 'Imperial']], (v) => s.set({ unitSystem: v as 'metric' | 'imperial' }))}
        {sel('countdown', 'Countdown before start', s.countdownS, [[0, 'None'], [5, '5 seconds'], [3600, '1 hour'], [7200, '2 hours'], [10800, '3 hours']], (v) => s.set({ countdownS: Number(v) as 0 | 5 | 3600 | 7200 | 10800 }))}
        {sel('smoothing', 'Power smoothing', s.smoothingN, [[1, 'Off'], [5, '5 s'], [10, '10 s'], [30, '30 s']], (v) => s.set({ smoothingN: Number(v) as 1 | 5 | 10 | 30 }))}
        <label className="block text-sm" htmlFor="wheel">Wheel circumference (mm)<input id="wheel" type="number" min={1500} max={4000} className="mt-1 w-full rounded bg-gg-bg border border-gg-line px-2 py-1" value={s.wheelMm} onChange={(e) => { const n = Number(e.target.value); if (n >= 1500 && n <= 4000) s.set({ wheelMm: n }); }} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.structuredWorkoutEnabled} onChange={(e) => s.set({ structuredWorkoutEnabled: e.target.checked })} aria-label="Structured workout panel" />Structured workout panel (tablets)</label>
        <p className="text-sm text-gg-muted">Recording interval: 1 s · App version {pkg.version}</p>
      </div>
    </Shell>
  );
}
```
Add `"resolveJsonModule": true` to `tsconfig.json` compilerOptions.

`src/ui/WorkoutsScreen.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import Shell from './Shell';
import { useWorkouts } from '../app/workout-store';
import { fmtDuration } from '../app/format';
export default function WorkoutsScreen() {
  const { workouts, selectedId, select, add, remove, loadBundled } = useWorkouts();
  const file = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState('');
  useEffect(() => { void loadBundled(); }, [loadBundled]);
  return (
    <Shell title="Structured workouts">
      <ul className="divide-y divide-gg-line">
        {workouts.map((w) => (
          <li key={w.id} className="py-2 flex items-center justify-between">
            <button className={`text-left ${w.id === selectedId ? 'text-gg-accent' : ''}`} onClick={() => { select(w.id); setMsg(`${w.title} selected`); }}>
              <div>{w.title}</div><div className="text-xs text-gg-muted">{w.wdate} · {fmtDuration(w.totalduration)} · {w.type}</div>
            </button>
            <button className="text-xs text-red-400" onClick={() => remove(w.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setMsg(add(JSON.parse(await f.text())) ? 'Workout imported' : 'Not a valid workout file'); } catch { setMsg('Not a valid workout file'); } e.target.value = ''; }} />
      <button className="mt-4 bg-gg-accent text-black font-semibold rounded px-4 py-2" onClick={() => file.current?.click()}>Import JSON</button>
      {msg && <p className="mt-2 text-sm text-gg-muted" role="status">{msg}</p>}
    </Shell>
  );
}
```

- [ ] **Step 4: Run** → PASS; `npm run build` → OK. **Step 5: Commit** `feat(ui): structured workouts and settings screens`.

---

### Task 19: PWA polish, sample writes during ride, deploy and phone verification

**Files:**
- Modify: `src/app/ride-store.ts` (periodic sample flush), `index.html` (theme-color, apple-touch-icon), `README.md` (run/test/deploy + phone test checklist)
- Test: `src/app/ride-store.flush.test.ts`

**Interfaces:** none new. Ride store gains a 10 s partial flush: every 10 ticks while recording it writes the session row + new samples (so a crash loses ≤ 10 s); `save()` becomes the final write.

- [ ] **Step 1: Failing test**

`src/app/ride-store.flush.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { useRide } from './ride-store';
import { useSettings } from './settings-store';
import { getSamples, getSession } from '../data/sessions';
describe('ride store partial flush', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it('writes samples every 10 s while recording', async () => {
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin();
    await vi.advanceTimersByTimeAsync(21000);
    const id = useRide.getState().engine!.startMs;
    expect((await getSamples(id)).length).toBeGreaterThanOrEqual(20);
    expect((await getSession(id))?.nSamples).toBeGreaterThanOrEqual(20);
    useRide.getState().stop(); useRide.getState().discard();
    expect(await getSession(id)).toBeUndefined();          // discard removes the partial write
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**

In `src/app/ride-store.ts`:
- add `import { deleteSession } from '../data/sessions';`
- extract `const toRecord = (e: RideEngine, rider: Rider | undefined): SessionRecord => ({ ...same object literal as in save()... })` and use it in `save()`.
- in the recording `setInterval` callback, after `engine.tick(...)`: `if (engine.samples.length % 10 === 0) void saveSession(toRecord(engine, useRiders.getState().current()), engine.laps.rows, engine.samples.slice(-10));`
- in `discard`: `const e = get().engine; if (e && e.startMs) void deleteSession(e.startMs);` before clearing.

`index.html`: add `<meta name="theme-color" content="#111111">` and `<link rel="apple-touch-icon" href="/icons/icon-192.png">`.

`README.md` — replace the stub with: what it is, `npm run dev` (serve over HTTPS for Web Bluetooth on a phone: `npx vite --host` + `adb reverse tcp:5173 tcp:5173`, or use the Pages preview URL), `npm test`, deploy (push to `main`; previews per branch), and the phone checklist:
```md
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
```

- [ ] **Step 4: Run** `npm test` (all) → PASS; `npm run build`; push; wait for Pages; run the phone checklist and record results in `docs/superpowers/plans/2026-10-14-phase1-pwa-parity.md` under a "Phone verification log" heading (date, device, each step pass/fail). **Step 5: Commit** `feat(app): periodic sample flush, PWA meta, phone verification checklist`.

---

## Self-review notes

- Spec §4.2 reconnect-on-disconnect: Task 12 `connectDevice` retries 3× with 2/4/8 s backoff, then `offline`.
- Spec §5 smoothing applies to displayed power/cadence only: Task 8 test "smoothing applies to displayed power/cadence only".
- Spec §5 CP deviation: Task 8 constructs `WBal(cpW ?? ftpW)`; Task 10 `newRider` sets `cpW = ftpW`.
- Spec §6 screen 2 rider picker: Task 14. Screens 3–7: Tasks 15–18.
- Spec §7 settings/devices in localStorage: Task 13 `persist`.
- Spec §8 FIT manufacturer `development`: Task 11.
- Spec §9 no-Web-Bluetooth message: Task 15 banner; pairing error text shown per slot via `messages`.
- Spec §10 phone test: Task 19 checklist.
- Review Focus 1 → Task 2 truncation tests; 2 → Task 3 Δt=0 and rollover tests; 3 → Task 8 pause test; 4 → Tasks 4/5 fallback tests and Task 10 `newRider`; 5 → Task 10 zero-sample test, Task 11 zero-sample FIT, Task 19 discard-after-partial-flush test.
- Type consistency checked: `LapRow`, `Sample`, `LiveInput`, `SessionRecord`, `Slot`, `PairedDevice` names match across Tasks 7–17.
