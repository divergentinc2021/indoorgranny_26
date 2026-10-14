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
