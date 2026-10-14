import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
export default function Shell({ title, children, back = true }: { title: string; children: ReactNode; back?: boolean }) {
  const loc = useLocation();
  return (
    <div className="min-h-full flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gg-line bg-gg-panel">
        {back && loc.pathname !== '/' && <Link to="/" className="text-gg-accent font-semibold" aria-label="Home">‹</Link>}
        <h1 className="text-lg">{title}</h1>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
