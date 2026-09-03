import { useEffect, useRef } from 'react';

// Interactive dither — a slow domain-warped WebGL field quantized with an 8x8
// Bayer ordered dither so the surface reads as living 1-bit grain. The pointer
// carries a lens that sharpens the grain and lifts the field. Pure texture,
// no narrative. Palette: bone-white paper + near-black ink + faint lime mids.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uMouseOn;

float hash(vec2 p){ p = fract(p*vec2(123.34, 345.45)); p += dot(p, p+34.345); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ s += a*vnoise(p); p *= 2.02; a *= 0.5; }
  return s;
}
float bayer2(vec2 a){ a = floor(a); return fract(a.x*0.5 + a.y*a.y*0.75); }
float bayer4(vec2 a){ return bayer2(0.5*a)*0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5*a)*0.25 + bayer2(a); }

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 p  = uv;
  p.x *= uRes.x / uRes.y;

  float t = uTime * 0.05;

  vec2 q = vec2(fbm(p*1.6 + vec2(0.0, t)), fbm(p*1.6 + vec2(5.2, -t)));
  vec2 r = vec2(fbm(p*1.6 + 3.0*q + vec2(1.7, 9.2)), fbm(p*1.6 + 3.0*q + vec2(8.3, 2.8)));
  float field = fbm(p*1.6 + 2.4*r + t*0.5);

  vec2 c = vec2(0.72, 0.46); c.x *= uRes.x/uRes.y;
  float glow = smoothstep(0.7, 0.0, length(p - c) - 0.1*sin(uTime*0.15));
  field = mix(field, field + 0.4, glow*0.55);
  field *= smoothstep(1.15, 0.25, length(p - c));

  vec2 m = uMouse; m.x *= uRes.x/uRes.y;
  float md = length(p - m);
  float lens = uMouseOn * smoothstep(0.4, 0.0, md);
  field += lens * 0.35;
  float cell = mix(1.0, 0.5, lens);

  field = clamp(field*1.45 - 0.4, 0.0, 1.0);

  float thr = bayer8(frag / cell);
  float levels = 4.0;
  float q2 = floor(field*levels + thr) / levels;

  vec3 paper = vec3(0.965, 0.965, 0.972);
  vec3 ink   = vec3(0.135, 0.145, 0.165);
  vec3 col   = mix(paper, ink, q2);
  col = mix(col, vec3(0.62, 0.80, 0.28), q2 * (1.0 - q2) * 0.16);
  col -= lens * 0.05;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[dither] shader error:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function InteractiveDither({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) { console.error('[dither] no webgl'); return; }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[dither] link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uMouseOn = gl.getUniformLocation(prog, 'uMouseOn');

    const mouse = { x: 0.5, y: 0.5, on: 0 };
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2);

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const inside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
      mouse.x = nx;
      mouse.y = 1 - ny;
      mouse.on = inside ? 1 : 0;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('resize', resize);
    resize();

    const start = performance.now();
    let raf = 0;
    let smoothOn = 0;
    const frame = (now) => {
      resize();
      smoothOn += (mouse.on - smoothOn) * 0.08;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uMouseOn, smoothOn);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    gl.uniform1f(uTime, 0);
    gl.uniform2f(uMouse, 0.5, 0.5);
    gl.uniform1f(uMouseOn, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <div className={className} aria-hidden="true" style={{ overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      {/* fine scanline veil to complete the forensic read */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent 0 2px, oklch(0 0 0 / 0.16) 2px 3px)',
          mixBlendMode: 'multiply', opacity: 0.35, pointerEvents: 'none',
        }}
      />
    </div>
  );
}
