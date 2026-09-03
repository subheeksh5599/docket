import { useEffect, useRef, useState } from 'react';
import { REGISTRY, fetchRecentReceipts } from '../lib/chain';
import { receiptPermalink } from '../lib/evidence';
import InteractiveDither from '../components/InteractiveDither';
import DitherArt from '../components/DitherArt';

// Landing — the first page. Same visual grammar as the reference: an
// interactive WebGL dither hero, typewriter headline, hover-swap sponsor
// words, dithered evidence cells. No walls of text, no generic claims.

const EVIDENCE = [
  {
    n: '01', k: 'ASK', t: 'One question. One real job.',
    shape: 'arrows',
    d: 'Type a factual question, pick an intent, escrow 1 USDC (testnet). DOCKET writes two transactions — approve, then requestVerification — and a real ERC-8183 job is created on the Telegraph Diamond.',
  },
  {
    n: '02', k: 'ANSWERED', t: 'A real miner, not us.',
    shape: 'signal',
    d: 'Telegraph routes the job to a registered miner. The miner resolves it and the protocol settles the payment — DOCKET never touches the answer, the miner, or the escrow. DOCKET is not Telegraph; it sits on top of it.',
  },
  {
    n: '03', k: 'LOCKED', t: 'The receipt cannot lie.',
    shape: 'loop',
    d: 'The same callback that pays the miner writes the answer commitment to the ReceiptRegistry on Base Sepolia. One write, then locked — no update function exists. Anyone can re-verify from any RPC, forever.',
  },
];

const DEFAULT = {
  heading: 'Put a question on the record.',
  eyebrow: '// built on',
  body: 'DOCKET turns a factual question into a permanent, independently checkable receipt — produced by a real Telegraph miner through the protocol\u2019s own payment callback, locked on-chain forever. Not a screenshot. Not a claim. A receipt.',
};

const SPONSOR_COPY = {
  telegraph: {
    heading: 'Answered by a real miner.',
    eyebrow: '// why Telegraph',
    body: 'Telegraph is the network doing the work: a registered miner resolves your job through ERC-8183 and gets paid from escrow. DOCKET is an application layer on top — it never pretends to be the network.',
  },
  base: {
    heading: 'Locked on Base Sepolia.',
    eyebrow: '// why a chain at all',
    body: 'A receipt on a ledger can\u2019t quietly edit itself. The record lives on Base Sepolia (84532) — public, immutable, re-verifiable from any RPC without DOCKET in the loop.',
  },
  erc: {
    heading: 'A standard job. A standard receipt.',
    eyebrow: '// why ERC-8183',
    body: 'ERC-8183 is Telegraph\u2019s job standard. DOCKET issues a real createJob, and the protocol\u2019s own payment callback writes the receipt — so the receipt is minted by the exact mechanism that pays miners for work.',
  },
};

function Typewriter({ text, speed = 30 }) {
  const [shown, setShown] = useState(text);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; setShown(text); return; }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (<>{shown}<span className="tw-caret" aria-hidden /></>);
}

export default function LandingPage({ wallet, go }) {
  const [recent, setRecent] = useState(null);
  const [hovered, setHovered] = useState(null);
  const active = hovered ? SPONSOR_COPY[hovered] : DEFAULT;
  const swapKey = hovered ?? 'default';

  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    fetchRecentReceipts(5).then((r) => { if (live) setRecent(r); });
    return () => { live = false; };
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* ---- HERO (interactive dither) ---- */}
      <section className="relative" style={{ overflow: 'hidden', minHeight: 'min(92vh, 900px)', borderBottom: '1px solid var(--line)', position: 'relative' }}>
        <InteractiveDither className="absolute inset-0 h-full w-full" />
        {/* readability washes over the grain */}
        <div
          className="absolute inset-0"
          style={{
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, color-mix(in oklch, var(--bg) 82%, transparent) 0%, color-mix(in oklch, var(--bg) 42%, transparent) 34%, transparent 68%), linear-gradient(0deg, var(--bg), transparent 26%), linear-gradient(180deg, color-mix(in oklch, var(--bg) 45%, transparent), transparent 14%)',
          }}
        />
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-6" style={{ minHeight: 'min(92vh, 900px)' }}>
          <div className="pixel rise" style={{ animationDelay: '0ms', fontSize: 18, letterSpacing: '0.06em', color: 'var(--ink)' }}>
            <span className="kol">DOC</span>KET
            <span className="flick" style={{ color: 'var(--ink)' }}>_</span>
          </div>

          <h1 className="rise" style={{
            animationDelay: '80ms',
            fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: 'clamp(44px, 8.5vw, 112px)', lineHeight: 0.94, letterSpacing: '-0.03em',
            margin: '18px 0 0', minHeight: '1.88em', maxWidth: '14ch',
          }}>
            <Typewriter text={active.heading} />
          </h1>

          <p className="rise" style={{
            animationDelay: '180ms', maxWidth: '56ch', marginTop: 22, minHeight: '5.4em',
            color: hovered ? 'var(--ink)' : 'var(--muted)', fontSize: 15, lineHeight: 1.65,
            transition: 'color 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
          }}>
            <span key={swapKey} className="hero-swap">{active.body}</span>
          </p>

          <button onClick={() => go('dashboard')} className="rise hero-ext" style={{
            animationDelay: '250ms', marginTop: 22, width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '7px 13px 7px 11px', border: '1px solid var(--line-strong)', borderRadius: 999,
            fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 12, letterSpacing: '0.01em',
            color: 'var(--muted)', background: 'transparent', cursor: 'pointer',
          }}>
            <span aria-hidden style={{ color: 'var(--signal)', fontSize: 13 }}>◇</span>
            <span>enter the dashboard</span>
            <span aria-hidden style={{ color: 'var(--faint)' }}>↗</span>
          </button>

          <div className="rise" style={{ animationDelay: '360ms', marginTop: 30 }}>
            <div className="label" style={{ marginBottom: 14, color: hovered ? 'var(--ink)' : 'var(--faint)', transition: 'color 0.2s', fontSize: 10 }}>
              <span key={swapKey} className="hero-swap">{active.eyebrow}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
              {[
                ['telegraph', 'TELEGRAPH'],
                ['base', 'BASE SEPOLIA'],
                ['erc', 'ERC-8183'],
              ].map(([key, label]) => (
                <span
                  key={key}
                  title={label}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: '0.08em', cursor: 'pointer',
                    color: hovered === key ? 'var(--ink)' : 'var(--faint)', transition: 'color .2s',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="label" style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', zIndex: 10, fontSize: 9 }}>
          ↓ scroll to the mechanics
        </div>
      </section>

      {/* ---- EVIDENCE: dithered how-the-record-works ---- */}
      <section className="mx-auto max-w-6xl px-6" style={{ padding: 'clamp(56px, 10vw, 120px) 24px' }}>
        <div className="label" style={{ marginBottom: 10 }}>{'// how the record works'}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(28px, 5vw, 52px)', letterSpacing: '-0.02em', maxWidth: '18ch', lineHeight: 1.05, color: 'var(--ink)' }}>
          The receipt is minted by the network — not by DOCKET.
        </h2>

        <div style={{ marginTop: 48, display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', background: 'var(--line)', border: '1px solid var(--line)' }}>
          {EVIDENCE.map((e) => (
            <div key={e.n} style={{ background: 'var(--bg)', padding: '26px 26px 34px', display: 'flex', flexDirection: 'column' }}>
              <DitherArt shape={e.shape} gap={4} style={{ height: 130, width: '100%' }} className="dither-cell" />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 16 }}>
                <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--signal)' }}>{e.n}</span>
                <span className="label" style={{ fontSize: 10, color: 'var(--faint)' }}>{e.k}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)', marginTop: 10 }}>{e.t}</h3>
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{e.d}</p>
            </div>
          ))}
        </div>

        {/* live recent-records strip */}
        <div style={{ marginTop: 56 }}>
          <div className="term-feed-head">
            <span>Recent records <span className="flick" style={{ color: 'var(--signal)' }}>●</span></span>
            <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>LIVE — READ FROM THE CHAIN</span>
          </div>
          {!recent ? (
            <div className="panel" style={{ padding: '24px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--faint)' }}>reading…</span></div>
          ) : recent.length === 0 ? (
            <div className="panel" style={{ padding: '24px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--faint)' }}>no receipts in the recent window</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map((r) => (
                <a key={r.jobId} href={receiptPermalink(r.jobId)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 6px', borderBottom: '1px solid var(--line)', textDecoration: 'none' }}>
                  <span className="tnum" style={{ fontSize: 12.5, color: 'var(--ink)', width: 44, flexShrink: 0 }}>#{r.jobId}</span>
                  <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.questionHash}</span>
                  <span className="label" style={{ color: 'var(--gain)', fontSize: 9 }}>RESOLVED</span>
                  <span className="label tnum" style={{ color: 'var(--faint)', fontSize: 9, flexShrink: 0 }}>{new Date(r.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
