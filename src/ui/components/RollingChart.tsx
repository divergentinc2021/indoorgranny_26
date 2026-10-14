import { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale);
// Charts sit on the navy page: white labels, faint white grid.
Chart.defaults.color = '#ffffff';
Chart.defaults.borderColor = 'rgba(255,255,255,0.2)';
export interface Series { label: string; data: number[]; min: number; max: number; color: string }
export default function RollingChart({ series, window = 800, height = 120 }: { series: Series[]; window?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null); const chart = useRef<Chart | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    // jsdom has no 2D canvas context; skip chart creation there (and on any browser without canvas).
    if (!canvas || !canvas.getContext('2d')) return;
    chart.current = new Chart(canvas, { type: 'line', data: { labels: [], datasets: [] }, options: { animation: false, responsive: true, maintainAspectRatio: false, elements: { point: { radius: 0 }, line: { borderWidth: 1.5 } }, scales: { x: { display: false } }, plugins: { legend: { display: false } } } });
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => {
    const c = chart.current; if (!c) return;
    const n = Math.max(...series.map((s) => s.data.length), 0);
    c.data.labels = Array.from({ length: Math.min(n, window) }, (_, i) => i);
    c.data.datasets = series.map((s, i) => ({ label: s.label, data: s.data.slice(-window), borderColor: s.color, yAxisID: `y${i}` }));
    c.options.scales = { x: { display: false }, ...Object.fromEntries(series.map((s, i) => [`y${i}`, { type: 'linear' as const, min: s.min, max: s.max, display: i === 0, position: 'left' as const }])) };
    c.update('none');
  }, [series, window]);
  return <div style={{ height }}><canvas ref={ref} /></div>;
}
