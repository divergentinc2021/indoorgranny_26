import { getDb, Rider } from './db';
export type { Rider };
export function newRider(p: Partial<Rider> & { name: string; email: string }): Rider {
  const ftpW = p.ftpW ?? 250;
  return { id: p.id ?? `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, name: p.name, email: p.email, weightKg: p.weightKg ?? 70, ftpW, cpW: p.cpW, ...(p.cpW !== undefined && p.cpExplicit ? { cpExplicit: true } : {}), wprimeKj: p.wprimeKj ?? 20, hrMax: p.hrMax ?? 180, powerZones: p.powerZones, createdAt: p.createdAt ?? Date.now() };
}
export async function listRiders() { return (await (await getDb()).getAll('riders')).sort((a, b) => a.name.localeCompare(b.name)); }
export async function putRider(r: Rider) { await (await getDb()).put('riders', r); }
export async function deleteRider(id: string) { await (await getDb()).delete('riders', id); }
/**
 * Older builds stored CP equal to FTP for riders who never typed one, which then shadowed later FTP edits (W'bal kept using the old value).
 * A CP the rider typed is flagged cpExplicit and is never touched. Pure and idempotent; unchanged riders come back as the same object.
 */
export function migrateRiders(riders: Rider[]): Rider[] {
  return riders.map((r) => (r.cpW !== undefined && !r.cpExplicit && r.cpW === r.ftpW ? { ...r, cpW: undefined } : r));
}
