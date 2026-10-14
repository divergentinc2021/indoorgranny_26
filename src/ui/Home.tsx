import { Link } from 'react-router-dom';
import { useSettings } from '../app/settings-store';
import { useRiders } from '../app/rider-store';
import TermsDialog from './TermsDialog';
const TILES: [string, string][] = [['TRAINING', '/training'], ['ACTIVITY LOGS', '/logs'], ['SETTINGS', '/settings'], ['STRUCTURED WORKOUTS', '/workouts'], ['SENSORS', '/sensors']];
export default function Home() {
  const accepted = useSettings((s) => s.licenseAccepted);
  const set = useSettings((s) => s.set);
  const rider = useRiders((s) => s.current());
  return (
    <div className="min-h-full p-4 flex flex-col gap-4">
      {!accepted && <TermsDialog onAccept={() => set({ licenseAccepted: true })} />}
      <header className="flex items-baseline justify-between"><h1 className="text-2xl">Granny Gear</h1><Link to="/rider" className="text-gg-accent text-sm">{rider ? rider.name : 'Choose rider'}</Link></header>
      <nav className="grid grid-cols-1 gap-3">
        {TILES.map(([label, to]) => <Link key={to} to={to} className="block rounded bg-gg-panel border border-gg-line px-4 py-5 text-lg font-heading font-semibold tracking-wide">{label}</Link>)}
      </nav>
      <footer className="mt-auto text-xs text-gg-muted">indoorgranny_26 · phase 1</footer>
    </div>
  );
}
