/** @type {import('tailwindcss').Config} */
// Vendor palette from docs/reference/vendor-ui-spec.md. Guarded by src/ui/theme.test.ts.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Vendor tablet layout (sw600dp) starts at 600 px.
      screens: { tab: '600px' },
      fontFamily: { sans: ['Roboto', 'system-ui', 'sans-serif'] },
      colors: {
        gg: {
          bg: '#093c64', // navy: dark pages, strips, 2 px strokes
          strip: '#00bbff', // cyan: tiles, value strips, buttons
          on: '#0eef2c', // green: "on" / connected
          lap: '#ffb872', // orange: LAP button
          paper: '#ffffff',
          zonebg: '#d3d1c9', // NOW row / zones background
          pink: '#ff8787',
          text: '#ffffff',
          // Phone screenshots (docs/reference/vendor-screenshots), which override the res-derived spec.
          bar: '#1f1f1f', // dark Android action bar
          btn: '#d6d6d6', // Android default grey button
          pref: '#212121', // dark preference-list page
          cat: '#17c8aa', // preference category header (teal)
          summary: '#9e9e9e', // preference summary text
          dlg: '#0a0a0a', // dark dialog body
        },
        // Lap-row fills for zones 1..7: emerald, green, light green, yellow, dark yellow, orange, red (salmon).
        zone: { z1: '#7adac6', z2: '#0eef2c', z3: '#abebcb', z4: '#ffff00', z5: '#e6e600', z6: '#ffb872', z7: '#ff8787' },
      },
    },
  },
  plugins: [],
};
