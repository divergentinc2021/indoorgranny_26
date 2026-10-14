import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
// Vendor pages: white (home/logs/sensors/settings), navy (ride), black (workouts). The title is a flat strip, no app bar.
export type Tone = 'white' | 'navy' | 'black';
const PAGE: Record<Tone, string> = { white: 'bg-white text-gg-bg', navy: 'bg-gg-bg text-white', black: 'bg-black text-white' };
export default function Shell({ title, children, back = true, tone = 'white' }: { title: string; children: ReactNode; back?: boolean; tone?: Tone }) {
  const loc = useLocation();
  return (
    <div className={`min-h-full flex flex-col ${PAGE[tone]}`}>
      <header className={`relative px-4 py-3 text-white ${tone === 'black' ? 'bg-gg-strip' : 'bg-gg-bg'}`}>
        {back && loc.pathname !== '/' && <Link to="/" className="absolute left-0 top-0 bottom-0 flex items-center px-4 text-[25px] text-white" aria-label="Home">‹</Link>}
        <h1 className="text-center text-[20px]">{title}</h1>
      </header>
      <main className="flex-1 p-[10px]">{children}</main>
    </div>
  );
}
