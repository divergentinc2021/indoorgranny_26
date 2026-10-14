const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const p = (n: number) => String(n).padStart(2, '0');
export const fmtDuration = (s: number) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; };
// Zero-padded clock (00:00:00) as the vendor Training screen shows it.
export const fmtClock = (s: number) => { s = Math.max(0, Math.floor(s)); return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; };
export const fmtDistance = (m: number, u: 'metric' | 'imperial') => (u === 'metric' ? `${(m / 1000).toFixed(2)} km` : `${(m / 1609.344).toFixed(2)} mi`);
export const fmtSpeed = (ms: number, u: 'metric' | 'imperial') => (u === 'metric' ? `${(ms * 3.6).toFixed(1)} km/h` : `${(ms * 2.236936).toFixed(1)} mph`);
export const fmtDate = (ms: number) => { const d = new Date(ms); return `${p(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
