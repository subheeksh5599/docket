import { useEffect, useRef } from 'react';

// Halftone dither art engine — an abstract shape rendered as a field of dots
// whose size tracks the shape's coverage, with subtle living motion.
// Shapes:
//   signal - scattered noise condensing into a dense luminous disc
//   arrows - three chevrons of dots streaming forward
//   loop   - a ring with a comet head
//   field  - a plain drifting dot field
// Dots inherit `color` from the wrapper.

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
const sstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function DitherArt({ shape, className, invert = false, gap = 5 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cellPx = gap * dpr;
    const color = getComputedStyle(canvas).color || '#111';

    // coverage(cx, cy, t): cx,cy aspect-corrected & centered around 0.5
    const coverage = (cx, cy, nx, t) => {
      const dx = cx - 0.5, dy = cy - 0.5;
      if (shape === 'signal') {
        const distSig = Math.hypot(cx - 0.72, cy - 0.5);
        const pulse = 0.24 + 0.015 * Math.sin(t * 1.2);
        const disc = (1 - sstep(0.06, pulse, distSig)) * (0.85 + 0.15 * vnoise(cx * 44, cy * 44 + t));
        const noiseZone = 1 - sstep(0.16, 0.6, cx);
        const flow = vnoise(cx * 16 - t * 2.2, cy * 16);
        const grain = sstep(0.58, 0.84, flow) * noiseZone * 0.75;
        const mid = sstep(0.12, 0.0, Math.abs(cy - 0.5));
        const win = sstep(0.16, 0.34, cx) * (1 - sstep(0.58, 0.74, cx));
        const guide = mid * win * (0.35 + 0.65 * vnoise(cx * 46 - t * 4.5, cy * 46)) * 0.4;
        return Math.max(disc, grain, guide);
      }
      if (shape === 'arrows') {
        const xf = (cx * 3.0 - t * 0.6) % 1.0;
        const seg = xf < 0 ? xf + 1 : xf;
        const chevron = sstep(0.5, 0.0, Math.abs(dy) * 2.0 + Math.abs(seg - 0.5) - 0.28);
        const grad = 0.35 + 0.65 * seg;
        return chevron * grad * (0.7 + 0.3 * vnoise(cx * 40 + t * 3, cy * 40));
      }
      if (shape === 'loop') {
        const rr = Math.hypot(dx, dy);
        const ring = sstep(0.05, 0.0, Math.abs(rr - 0.26));
        const ang = Math.atan2(dy, dx);
        const head = sstep(1.4, 0.0, Math.abs(((ang - t * 1.1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI));
        return ring * (0.4 + 0.6 * head) * (0.75 + 0.25 * vnoise(cx * 40, cy * 40 + t));
      }
      // field: calm ambient drift
      const f = vnoise(cx * 3.2 + t * 0.25, cy * 3.2 - t * 0.18);
      return sstep(0.5, 0.95, f) * 0.7;
    };

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };

    const draw = (t) => {
      resize();
      const w = canvas.width, h = canvas.height;
      const aspect = w / h;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (let gy = cellPx * 0.5; gy < h; gy += cellPx) {
        for (let gx = cellPx * 0.5; gx < w; gx += cellPx) {
          const nx = gx / w, ny = gy / h;
          const cx = (nx - 0.5) * aspect + 0.5;
          const c = coverage(cx, ny, nx, t);
          if (c <= 0.04) continue;
          const jitter = (hash(gx, gy) - 0.5) * cellPx * 0.35;
          const r = Math.min(cellPx * 0.52, cellPx * 0.16 + c * cellPx * 0.42);
          ctx.globalAlpha = Math.min(1, 0.35 + c);
          ctx.beginPath();
          ctx.arc(gx + jitter, gy + jitter, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    const start = performance.now();
    const frame = (now) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    draw(0);
    raf = requestAnimationFrame(frame);

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [shape, invert, gap]);

  return (
    <div className={className} aria-hidden="true" style={{ color: invert ? 'var(--dark-ink)' : 'var(--ink)' }}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
