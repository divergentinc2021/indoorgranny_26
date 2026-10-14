import { getDb, Rider } from './db';
export type { Rider };
export function newRider(p: Partial<Rider> & { name: string; email: string }): Rider {
  const ftpW = p.ftpW ?? 250;
  return { id: p.id ?? `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, name: p.name, email: p.email, weightKg: p.weightKg ?? 70, ftpW, cpW: p.cpW ?? ftpW, wprimeKj: p.wprimeKj ?? 20, hrMax: p.hrMax ?? 180, powerZones: p.powerZones, createdAt: p.createdAt ?? Date.now() };
}
export async function listRiders() { return (await (await getDb()).getAll('riders')).sort((a, b) => a.name.localeCompare(b.name)); }
export async function putRider(r: Rider) { await (await getDb()).put('riders', r); }
export async function deleteRider(id: string) { await (await getDb()).delete('riders', id); }
