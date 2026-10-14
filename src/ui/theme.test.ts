// @ts-expect-error -- tailwind.config.js is plain JS with no type declarations
import config from '../../tailwind.config.js';

// Vendor palette (docs/reference/vendor-ui-spec.md). A change here is a visual-parity regression.
const colors = config.theme.extend.colors as { gg: Record<string, string>; zone: Record<string, string> };

describe('vendor palette tokens', () => {
  it('exposes the vendor UI colours', () => {
    expect(colors.gg.bg).toBe('#093c64');
    expect(colors.gg.strip).toBe('#00bbff');
    expect(colors.gg.on).toBe('#0eef2c');
    expect(colors.gg.lap).toBe('#ffb872');
    expect(colors.gg.zonebg).toBe('#d3d1c9');
    expect(colors.gg.paper).toBe('#ffffff');
  });

  it('maps zones 1..7 to the vendor lap-row fills', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => colors.zone[`z${n}`])).toEqual(
      ['#7adac6', '#0eef2c', '#abebcb', '#ffff00', '#e6e600', '#ffb872', '#ff8787'],
    );
  });

  it('uses the system sans stack, not web fonts', () => {
    expect(config.theme.extend.fontFamily.sans[0]).toBe('Roboto');
  });
});
