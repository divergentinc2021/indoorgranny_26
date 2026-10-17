// Class plans: parsed from Seconds Pro `.seconds` exports. Pure; the portal copies this file verbatim, so the id rule is a contract.
// Zone mapping: name keyword first (first match in listed order wins), Seconds colour second, default zone 2.
//   keyword (case-insensitive)                      zone      Seconds colour -> zone
//   sprint, neuro, leg speed, wind up                7        0->1 5->2 4->3 3->4 6->5 2->6 1->7
//   anaerobic 6 | vo2 5 | threshold 4 | tempo 3 | endurance 2 | easy, recover, cool, warm 1
export type Zone = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface ClassInterval { name: string; displayName: string; durationS: number; zone: Zone }
export interface ClassPlan { id: string; title: string; dates: string[]; source: 'seconds' | 'bundled' | 'portal'; intervals: ClassInterval[]; totalS: number }

const KEYWORDS: [RegExp, Zone][] = [[/sprint|neuro|leg speed|wind[\s-]?up/i, 7], [/anaerobic/i, 6], [/vo2/i, 5], [/threshold/i, 4], [/tempo/i, 3], [/endurance/i, 2], [/easy|recover|cool|warm/i, 1]];
const COLOURS: Record<number, Zone> = { 0: 1, 5: 2, 4: 3, 3: 4, 6: 5, 2: 6, 1: 7 };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export const zoneFor = (name: string, color: number | undefined): Zone => {
  for (const [re, z] of KEYWORDS) if (re.test(name)) return z;
  return (color !== undefined && COLOURS[color]) || 2;
};

export const displayNameOf = (name: string): string => name
  .replace(/^(?:\S+\s+)*?\d+\/\d+\s+/, '').replace(/\s*\d{1,2}:\d{2}\s*$/, '').replace(/(^|\s)\d+\+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const p2 = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// "19-20 October 2026", "21 - 22 October 2026", "3 November 2026" -> ISO days, ascending (a range yields its two end days).
export const datesFromTitle = (title: string): string[] => {
  const out = new Set<string>();
  const re = /(?<!\d)(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+([a-z]+)\s+(\d{4})(?!\d)/gi;
  for (const m of title.matchAll(re)) {
    const mo = MONTHS.indexOf(m[3].toLowerCase());
    if (mo < 0) continue;
    for (const d of [m[1], m[2]]) {
      if (d === undefined) continue;
      const day = Number(d), dt = new Date(Number(m[4]), mo, day);
      if (dt.getMonth() === mo && dt.getDate() === day) out.add(isoDay(dt));
    }
  }
  return [...out].sort();
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const planOf = (item: Record<string, unknown>, source: ClassPlan['source']): ClassPlan | null => {
  if (!Array.isArray(item.intervals)) return null;
  const title = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Untitled class';
  const intervals: ClassInterval[] = [];
  for (const r of item.intervals) {
    if (!isObj(r) || r.indefinite === true || typeof r.duration !== 'number' || !Number.isFinite(r.duration) || r.duration <= 0) continue;
    const name = typeof r.name === 'string' ? r.name : '';
    intervals.push({ name, displayName: displayNameOf(name), durationS: r.duration, zone: zoneFor(name, typeof r.color === 'number' ? r.color : undefined) });
  }
  if (!intervals.length) return null;
  const ident = typeof item.identifier === 'string' && item.identifier ? item.identifier : 'local';
  return { id: `${ident}:${slug(title)}`, title, dates: datesFromTitle(title), source, intervals, totalS: intervals.reduce((s, i) => s + i.durationS, 0) };
};

export const parseSecondsFile = (json: unknown, source: ClassPlan['source'] = 'seconds'): ClassPlan[] => {
  const items: Record<string, unknown>[] = [];
  if (isObj(json)) {
    if (Array.isArray(json.packs)) for (const p of json.packs) { if (isObj(p) && Array.isArray(p.items)) for (const it of p.items) if (isObj(it)) items.push(it); }
    else items.push(json);
  }
  const plans = items.map((it) => planOf(it, source)).filter((p): p is ClassPlan => p !== null);
  if (!plans.length) throw new Error('Not a Seconds file');
  return plans;
};
