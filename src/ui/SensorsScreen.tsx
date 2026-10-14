import { useState } from 'react';
import Shell from './Shell';
import { useSensors } from '../app/sensor-store';
import { useSettings } from '../app/settings-store';
import { BleAdapter } from '../sensors/ble/adapter';
import type { Slot } from '../sensors/types';

const SLOTS: { slot: Slot; label: string; value: (v: Record<string, number | undefined>) => string }[] = [
  { slot: 'hr', label: 'Heart rate', value: (v) => v.hr !== undefined ? String(v.hr) : '—' },
  { slot: 'power', label: 'Power', value: (v) => v.power !== undefined ? `${Math.round(v.power)} W` : '—' },
  { slot: 'csc', label: 'Speed / cadence', value: (v) => `${v.speedMs !== undefined ? (v.speedMs * 3.6).toFixed(1) + ' km/h' : '—'} · ${v.cadence !== undefined ? Math.round(v.cadence) + ' rpm' : '—'}` },
  { slot: 'trainer', label: 'Trainer', value: (v) => v.power !== undefined ? `${Math.round(v.power)} W` : '—' },
];

export default function SensorsScreen() {
  const { states, messages, values, pair, forget, reconnectAll } = useSensors();
  const devices = useSettings((s) => s.devices);
  // pair() on an occupied slot disconnects the old device before the picker opens, so ask first.
  const [confirming, setConfirming] = useState<Slot | null>(null);
  const v = { ...values, speedMs: values.speed };
  return (
    <Shell title="Sensors">
      {!BleAdapter.available() && <p className="mb-3 text-sm text-yellow-400">Web Bluetooth is not available here. Use Chrome on Android (6.0 or newer).</p>}
      <ul className="space-y-3">
        {SLOTS.map(({ slot, label, value }) => {
          const d = devices[slot];
          const asking = confirming === slot && !!d;
          return (
            <li key={slot} className="rounded bg-gg-panel border border-gg-line p-3">
              <div className="flex items-center justify-between"><span className="font-heading font-semibold">{label}</span><span className={`text-xs ${states[slot] === 'connected' ? 'text-green-400' : 'text-gg-muted'}`}>{states[slot]}</span></div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm">{d ? d.name : <span className="text-gg-muted">not paired</span>}</span>
                <span className="font-mono text-lg tabular-nums">{value(v)}</span>
              </div>
              {messages[slot] && <p className="text-xs text-yellow-400 mt-1">{messages[slot]}</p>}
              {asking ? (
                <div className="mt-2 flex items-center gap-2 text-sm" role="group" aria-label={`Confirm pair again ${label}`}>
                  <span>This forgets {d.name} first. Continue?</span>
                  <button className="bg-gg-accent text-black rounded px-3 py-1 font-semibold" onClick={() => { setConfirming(null); void pair(slot); }}>Yes</button>
                  <button className="border border-gg-line rounded px-3 py-1" onClick={() => setConfirming(null)}>Cancel</button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2 text-sm">
                  {d ? <button className="border border-gg-line rounded px-3 py-1" onClick={() => void forget(slot)} aria-label={`Forget ${label}`}>Forget</button> : null}
                  <button className="bg-gg-accent text-black rounded px-3 py-1 font-semibold" onClick={() => (d ? setConfirming(slot) : void pair(slot))} aria-label={`Pair ${label}`}>{d ? 'Pair again' : 'Pair'}</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button className="mt-4 w-full border border-gg-line rounded py-2" onClick={() => void reconnectAll()}>Reconnect all</button>
    </Shell>
  );
}
