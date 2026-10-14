import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Guard: a source file saved as Latin-1/cp1252 breaks UTF-8 decoding and shows U+FFFD in the built app.
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css|json)$/.test(n) ? [p] : [];
});

describe('source encoding', () => {
  it('every .ts/.tsx/.css/.json under src is valid UTF-8', () => {
    const dec = new TextDecoder('utf-8', { fatal: true });
    const bad = walk('src').filter((f) => { try { dec.decode(readFileSync(f)); return false; } catch { return true; } });
    expect(bad).toEqual([]);
  });
});
