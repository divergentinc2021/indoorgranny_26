import type { Settings } from './settings-store';
// Class-boundary cue. The AudioContext is created/resumed from prepareAudio() inside a user gesture (browsers refuse audio otherwise); classAlert never throws.
let ctx: AudioContext | null = null;
export function prepareAudio(): void {
  try {
    const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* audio unavailable */ }
}
export function classAlert(mode: Settings['classAlerts']): void {
  if (mode === 'off') return;
  if (mode === 'vibrate' || mode === 'both') { try { navigator.vibrate?.(200); } catch { /* unsupported */ } }
  if (mode === 'beep' || mode === 'both') {
    try {
      if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.2;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.15);
    } catch { /* audio unavailable */ }
  }
}
