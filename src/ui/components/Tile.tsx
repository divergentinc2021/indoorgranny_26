// Vendor metric tile: small white caption over a flat cyan strip. No card, border, radius or shadow.
// 'main' = Power/HR/Cadence, 'small' = tablet bottom info row, 'bare' = the elapsed strip (caption read by screen readers
// only), 'compact' = phone bottom row (bold two-line captions; a one-line caption lets its strip grow taller).
// Phone: bold white values on cyan (28 px main/bare, 20 px compact; captions 17 / 16 px). Tablet (>= 600 px): value 45 px (39 px small) black
// on cyan, caption 25 px, AVG/MAX line visible.
export default function Tile({ label, value, sub, size = 'main', strip = 'bg-gg-strip text-white' }: { label: string; value: string | number; sub?: string; size?: 'main' | 'small' | 'bare' | 'compact'; strip?: string }) {
  const cap = { bare: 'sr-only', small: 'text-[14px]', compact: 'text-[16px] font-bold whitespace-pre-line', main: 'text-[17px] font-bold tab:text-[25px] tab:font-normal' }[size];
  const val = {
    small: 'text-[14px] tab:text-[39px]',
    compact: 'flex-1 flex items-center justify-center text-[20px] font-bold',
    main: 'py-[6px] text-[28px] font-bold tab:py-0 tab:text-[45px] tab:font-normal',
    bare: 'py-[6px] text-[28px] font-bold tab:py-0 tab:text-[45px] tab:font-normal',
  }[size];
  return (
    <div className={`bg-gg-bg p-[5px] tab:p-1 flex flex-col ${size === 'bare' ? 'px-[10px]' : ''}`}>
      <div className={`text-white text-center leading-tight ${cap}`}>{label}</div>
      <div className={`${strip} tab:text-black ${val} text-center tabular-nums leading-tight`}>{value}</div>
      {sub && <div className="hidden tab:block bg-gg-strip text-black text-[20px] text-center tabular-nums">{sub}</div>}
    </div>
  );
}
