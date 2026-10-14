import type { SessionRecord } from './db';
/** Phase 2 hook: the portal API. No network calls in phase 1. */
export const remote = { enabled: false, async pushSession(_s: SessionRecord): Promise<void> {} };
