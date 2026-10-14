// Palette hex values read from the Tailwind config, for code that cannot use a class (SVG fills, chart options),
// so CSS and SVG cannot drift apart. tailwind.config.js is plain JS with no type declarations.
// @ts-expect-error -- see above
import config from '../../tailwind.config.js';

const gg = config.theme.extend.colors.gg as Record<string, string>;
export const THEME = { strip: gg.strip, on: gg.on, paper: gg.paper } as const;
