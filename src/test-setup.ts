import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Node >= 22 ships an experimental global webstorage (`localStorage`/`sessionStorage` getters on
// globalThis) that shadows jsdom's and is unusable without --localstorage-file: it is undefined at
// use and warns on access. Install an in-memory Storage before any store module can import, so
// zustand `persist` always has a working backend regardless of Node version.
function memoryStorage(): Storage {
  const mem = new Map<string, string>();
  return {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    key: (i) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k) => { mem.delete(k); },
    setItem: (k, v) => { mem.set(k, String(v)); },
  };
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true, writable: true });
}
