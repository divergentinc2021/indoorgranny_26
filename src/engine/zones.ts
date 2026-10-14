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
