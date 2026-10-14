/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { heading: ['Poppins', 'sans-serif'], body: ['Inter', 'sans-serif'] },
      colors: {
        gg: { bg: '#111111', panel: '#1c1c1c', line: '#2e2e2e', text: '#f2f2f2', muted: '#9a9a9a', accent: '#f28c1b' },
        zone: { z1: '#8fd3c7', z2: '#2ecc71', z3: '#f1c40f', z4: '#e67e22', z5: '#e74c3c', z6: '#8e44ad', z7: '#2c3e50' },
      },
    },
  },
  plugins: [],
};
