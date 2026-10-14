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
      {!BleAdapter.available() && <p className="mb-3 text-sm font-bold">Web Bluetooth is not available here. Use Chrome on Android (6.0 or newer).</p>}
      <ul>
        {SLOTS.map(({ slot, label, value }) => {
          const d = devices[slot];
          // Values are keyed by kind and arbitrated across slots, so only show one for a slot that is paired and connected.
          const live = !!d && states[slot] === 'connected';
          const asking = confirming === slot && !!d;
          const on = states[slot] === 'connected';
          const act = (cls: string) => `rounded-[15px] border-2 border-gg-bg px-3 py-1 text-[12px] ${cls}`;
          return (
            <li key={slot} className="flex items-start m-[10px]">
              {/* Vendor card: 60 px square button (cyan, green when connected) + white round_border info panel. */}
              <button className={`flex-shrink-0 w-[60px] h-[60px] border-2 border-gg-bg rounded-[15px] text-[12px] ${on ? 'bg-gg-on text-black' : 'bg-gg-strip text-white'}`} onClick={() => (d ? setConfirming(slot) : void pair(slot))} aria-label={`Pair ${label}`}>{d ? 'Pair again' : 'Pair'}</button>
              <div className="flex-1 ml-[10px] min-w-0 bg-white text-black border-2 border-gg-bg rounded-[15px] p-[5px] text-[12px]">
                <div className="flex items-center justify-between"><span className="font-bold text-[14px] text-gg-bg">{label}</span><span className={on ? 'bg-gg-on px-1' : ''}>{states[slot]}</span></div>
                <div className="flex items-center justify-between mt-1">
                  <span>{d ? d.name : <span>not paired</span>}</span>
                  <span className="font-mono text-[18px] tabular-nums">{live ? value(v) : value({})}</span>
                </div>
                {messages[slot] && <p className="mt-1 font-bold">{messages[slot]}</p>}
                {asking ? (
                  <div className="mt-2 flex items-center flex-wrap" role="group" aria-label={`Confirm pair again ${label}`}>
                    <span className="mr-2">This disconnects {d.name} first. Continue?</span>
                    <button className={`${act('bg-gg-strip text-white')} mr-2`} onClick={() => { setConfirming(null); void pair(slot); }}>Yes</button>
                    <button className={act('bg-white text-gg-bg')} onClick={() => setConfirming(null)}>Cancel</button>
                  </div>
                ) : (
                  d ? <div className="mt-2"><button className={act('bg-white text-gg-bg')} onClick={() => void forget(slot)} aria-label={`Forget ${label}`}>Forget</button></div> : null
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <button className="mt-4 w-full bg-gg-strip text-white text-[20px] border-2 border-gg-bg rounded-[15px] py-2" onClick={() => void reconnectAll()}>Reconnect all</button>
    </Shell>
  );
}
