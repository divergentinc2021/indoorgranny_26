import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
// Pages: white (logs/sensors), navy (ride), black (workouts), pref (settings list), cyan (rider login).
export type Tone = 'white' | 'navy' | 'black' | 'pref' | 'cyan';
const PAGE: Record<Tone, string> = { white: 'bg-white text-gg-bg', navy: 'bg-gg-bg text-white', black: 'bg-black text-white', pref: 'bg-gg-pref text-white', cyan: 'bg-gg-strip text-white' };
interface Props {
  title: string; children: ReactNode; back?: boolean; tone?: Tone;
  /** Phone only: lock the page to the viewport height so a child can scroll (Training). */
  fill?: boolean;
  /** No padding around the content; the screen lays itself out. */
  bare?: boolean;
  /** Phone only: content for the right end of the default bar (e.g. the sensors menu button). */
  action?: ReactNode;
  /** Phone only: replace the default bar content; `false` shows no bar on phone. */
  bar?: ReactNode | false;
}
// Phone (< 600 px): the vendor's dark Android action bar, 56 px, bold left-aligned title. From 600 px: the Task 20 navy strip.
export default function Shell({ title, children, back = true, tone = 'white', fill = false, bare = false, action, bar }: Props) {
  const loc = useLocation();
  const strip = tone === 'black' ? 'tab:bg-gg-strip' : 'tab:bg-gg-bg';
  const root = fill ? 'h-full min-h-full overflow-hidden tab:h-auto tab:overflow-visible' : 'min-h-full';
  const main = fill ? 'flex-1 min-h-0 flex flex-col p-0 tab:block tab:p-[10px]' : bare ? 'flex-1 flex flex-col' : 'flex-1 p-[10px]';
  const header = (cls: string, custom?: ReactNode) => (
    <header className={`relative text-white ${cls}`}>
      {custom ?? (
        <>
          {back && loc.pathname !== '/' && <Link to="/" className="mr-3 text-[28px] leading-none text-white tab:mr-0 tab:absolute tab:left-0 tab:top-0 tab:bottom-0 tab:flex tab:items-center tab:px-4 tab:text-[25px]" aria-label="Home">‹</Link>}
          <h1 className="sr-only tab:not-sr-only tab:text-center tab:text-[20px]">{title}</h1>
          <div aria-hidden="true" className="flex-1 min-w-0 truncate text-[20px] font-bold tab:hidden">Granny Gear</div>
          {action && <div className="ml-auto tab:absolute tab:right-0 tab:top-0 tab:bottom-0 tab:flex tab:items-center">{action}</div>}
        </>
      )}
    </header>
  );
  const dark = 'flex items-center h-[56px] bg-gg-bar';
  return (
    <div className={`flex flex-col ${root} ${PAGE[tone]}`}>
      {bar === undefined
        ? header(`${dark} px-4 tab:block tab:h-auto tab:py-3 ${strip}`)
        : (
          <>
            {bar !== false && header(`${dark} px-2 tab:hidden`, bar)}
            {header(`hidden tab:block tab:py-3 ${strip}`)}
          </>
        )}
      <main className={main}>{children}</main>
    </div>
  );
}
