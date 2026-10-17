import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error -- tailwind.config.js is plain JS with no type declarations
import config from '../../tailwind.config.js';

// Vendor palette (docs/reference/vendor-ui-spec.md). A change here is a visual-parity regression.
const colors = config.theme.extend.colors as { gg: Record<string, string>; zone: Record<string, string>; zonefill: Record<string, string>; hr: Record<string, string> };

describe('vendor palette tokens', () => {
  it('exposes the vendor UI colours', () => {
    expect(colors.gg.bg).toBe('#093c64');
    expect(colors.gg.strip).toBe('#00bbff');
    expect(colors.gg.on).toBe('#0eef2c');
    expect(colors.gg.lap).toBe('#ffb872');
    expect(colors.gg.zonebg).toBe('#d3d1c9');
    expect(colors.gg.paper).toBe('#ffffff');
  });

  it('exposes the phone-screenshot colours', () => {
    expect(colors.gg.bar).toBe('#1f1f1f');
    expect(colors.gg.btn).toBe('#d6d6d6');
    expect(colors.gg.pref).toBe('#212121');
    expect(colors.gg.cat).toBe('#17c8aa');
    expect(colors.gg.summary).toBe('#9e9e9e');
    expect(colors.gg.dlg).toBe('#0a0a0a');
  });

  it('maps zones 1..7 to the vendor lap-row fills', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => colors.zone[`z${n}`])).toEqual(
      ['#7adac6', '#0eef2c', '#abebcb', '#ffff00', '#e6e600', '#ffb872', '#ff8787'],
    );
  });

  it('maps zones 1..7 to the darker class-bar fill tones', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => colors.zonefill[`z${n}`])).toEqual(
      ['#4f8e81', '#099b1d', '#6f9984', '#a6a600', '#969600', '#a6784a', '#a65858'],
    );
  });

  it('maps the %HR max bands z1..z5 to the vendor strip colours', () => {
    expect([1, 2, 3, 4, 5].map((n) => colors.hr[`z${n}`])).toEqual(['#00bbff', '#0eef2c', '#e6e600', '#ffb872', '#ff8787']);
    expect(colors.hr.z1).toBe(colors.gg.strip);
  });

  it('resets the button background after the Tailwind base (Chrome < 88 drops its :where() reset)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8');
    expect(css.indexOf('@tailwind base')).toBeGreaterThanOrEqual(0);
    expect(css).toMatch(/button\s*\{\s*background:\s*transparent;?\s*\}/);
    expect(css.search(/button\s*\{/)).toBeGreaterThan(css.indexOf('@tailwind base'));
  });

  it('uses the system sans stack, not web fonts', () => {
    expect(config.theme.extend.fontFamily.sans[0]).toBe('Roboto');
  });
});
