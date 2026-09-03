import { useEffect, useRef, useState } from 'react';
import { REGISTRY, DIAMOND, USDC, fetchReceipt } from '../lib/chain';
import { explorerAddress } from '../lib/evidence';
import InteractiveDither from '../components/InteractiveDither';
import DitherArt from '../components/DitherArt';

// Landing — the first page. Same visual grammar as the reference: an
// interactive WebGL dither hero, typewriter headline, hover-swap sponsor
// words, dithered evidence cells. No walls of text, no generic claims.

// A real, live receipt on the canonical registry — read fresh for the
// "it works" proof band below (public artifact, same class as the protocol
// constants; the values shown are whatever the chain returns, never hardcoded).
const LIVE_RECEIPT_ID = 28;

const EVIDENCE = [
  {
    n: '01', k: 'ASK', t: 'One question. One real job.',
    shape: 'arrows',
    d: 'Type a factual question, pick an intent, escrow 1 USDC (testnet). DOCKET writes two transactions — approve, then requestVerification — and a real ERC-8183 job is created on the Telegraph Diamond.',
  },
  {
    n: '02', k: 'ANSWERED', t: 'Resolved on-chain, not by us.',
    shape: 'signal',
    d: 'The job is routed through Telegraph and resolved by the network — the resolver gets paid from escrow in the same transaction. DOCKET never touches the answer or the escrow. DOCKET is not Telegraph; it sits on top of it.',
  },
  {
    n: '03', k: 'LOCKED', t: 'The receipt cannot lie.',
    shape: 'loop',
    d: 'The same callback that pays the resolver writes the answer commitment to the ReceiptRegistry on Base Sepolia. One write, then locked — no update function exists. Anyone can re-verify from any RPC, forever.',
  },
];

const DEFAULT = {
  heading: 'Put a question on the record.',
  eyebrow: '// built on',
  body: 'DOCKET turns a factual question into a permanent, independently checkable receipt — resolved through the protocol\u2019s own payment callback and locked on-chain forever. Not a screenshot. Not a claim. A receipt.',
};

const FLOW = [
  ['USER', 'Asks a question + funds escrow in the DOCKET app.'],
  ['DOCKET', 'Frontend only — no backend. Writes two transactions: approve USDC, then requestVerification on the registry.'],
  ['ERC-8183 JOB', 'The registry escrows USDC into the Telegraph Diamond and calls createJob — a standard Telegraph job.'],
  ['TELEGRAPH', 'Routes the job and coordinates resolution (the protocol\'s own network — DOCKET is not Telegraph).'],
  ['MINER / RESOLVER', 'A network participant resolves the job and submits the response.'],
  ['SETTLEMENT', 'The protocol verifies the submission and settles the resolver\'s payment from escrow.'],
  ['CALLBACK', 'The same callback that pays the resolver calls back into the ReceiptRegistry with the answer commitment.'],
  ['RECEIPT REGISTRY', 'A DOCKET smart contract on Base Sepolia. It verifies the caller is the Diamond, then writes the receipt.'],
  ['IMMUTABLE RECEIPT', 'One write. Locked forever. No update function exists in the bytecode.'],
];

const STEPS = [
  { n: '01', title: 'You ask', d: 'A factual question, an intent, and 1 USDC escrow (testnet).' },
  { n: '02', title: 'A real job', d: 'The registry issues an ERC-8183 createJob on the Telegraph Diamond.' },
  { n: '03', title: 'A network resolver', d: 'Telegraph routes the job; a network participant resolves it on-chain.' },
  { n: '04', title: 'One callback', d: 'The payment callback writes the answer commitment to the registry.' },
  { n: '05', title: 'Locked', d: 'The receipt is immutable — provable from any RPC, forever.' },
];

const SPONSOR_COPY = {
  telegraph: {
    heading: 'Resolved and paid on-chain.',
    eyebrow: '// why Telegraph',
    body: 'Telegraph is the network doing the work: your job routes through it, a network resolver answers through ERC-8183, and the resolver is paid from escrow. DOCKET is an application layer on top — it never pretends to be the network.',
  },
  base: {
    heading: 'Locked on Base Sepolia.',
    eyebrow: '// why a chain at all',
    body: 'A receipt on a ledger can\u2019t quietly edit itself. The record lives on Base Sepolia (84532) — public, immutable, re-verifiable from any RPC without DOCKET in the loop.',
  },
  erc: {
    heading: 'A standard job. A standard receipt.',
    eyebrow: '// why ERC-8183',
    body: 'ERC-8183 is Telegraph\u2019s job standard. DOCKET issues a real createJob, and the protocol\u2019s own payment callback writes the receipt — so the receipt is minted by the exact mechanism that pays resolvers for work.',
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
  const [hovered, setHovered] = useState(null);
  const [liveReceipt, setLiveReceipt] = useState(null);
  const active = hovered ? SPONSOR_COPY[hovered] : DEFAULT;
  const swapKey = hovered ?? 'default';
  const evidenceRef = useRef(null);

  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    fetchReceipt(LIVE_RECEIPT_ID)
      .then((r) => { if (live) setLiveReceipt(r); })
      .catch(() => { /* the proof band hides when the chain read fails */ });
    return () => { live = false; };
  }, []);

  const scrollToEvidence = () => {
    evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

        <button onClick={scrollToEvidence} className="label" style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', zIndex: 10, fontSize: 9, background: 'none', border: 0, cursor: 'pointer', color: 'var(--faint)' }}>
          ↓ scroll to the mechanics
        </button>
      </section>

      {/* ---- EVIDENCE: dithered how-the-record-works ---- */}
      <section ref={evidenceRef} className="mx-auto max-w-6xl px-6" style={{ padding: 'clamp(56px, 10vw, 120px) 24px', scrollMarginTop: 70 }}>
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

      {/* ---- LIVE PROOF — a real receipt, read live from the chain ---- */}
      {liveReceipt && (
        <div style={{ marginTop: 64 }}>
          <div className="term-feed-head">
            <span>It works — a live receipt <span className="flick" style={{ color: 'var(--signal)' }}>●</span></span>
            <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>READ FROM BASE SEPOLIA</span>
          </div>
          <a href="#/r/28" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="panel" style={{ padding: '18px 22px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20, transition: 'border-color .15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="tnum" style={{ fontSize: 18, color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>#{liveReceipt.jobId?.toString?.() ?? LIVE_RECEIPT_ID}</span>
                <span className="label" style={{ color: liveReceipt.resolved ? 'var(--gain)' : 'var(--signal)', fontSize: 9, border: `1px solid color-mix(in oklch, ${liveReceipt.resolved ? 'var(--gain)' : 'var(--signal)'} 40%, transparent)`, borderRadius: 2, padding: '3px 7px' }}>
                  {liveReceipt.resolved ? '✓ RESOLVED' : '… PENDING'}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.14em' }}>INTENT {liveReceipt.intentId?.slice?.(0, 10)}… · ANSWER COMMITMENT</div>
                <div className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 4, wordBreak: 'break-all' }}>
                  {liveReceipt.answerHash?.slice?.(0, 10)}…{liveReceipt.answerHash?.slice?.(-8)}
                </div>
              </div>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>
                resolved on-chain by the network → callback → locked · view the full provenance →
              </div>
            </div>
          </a>
        </div>
      )}
      </section>

      {/* ---- HOW IT WORKS (anchor for #/how) ---- */}
      <section id="how" className="mx-auto max-w-6xl px-6" style={{ padding: 'clamp(48px, 8vw, 96px) 24px clamp(56px, 10vw, 120px)', borderTop: '1px solid var(--line)' }}>
        <div className="label" style={{ marginBottom: 10 }}>{'// how it works'}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(28px, 5vw, 52px)', letterSpacing: '-0.02em', maxWidth: '22ch', lineHeight: 1.05, color: 'var(--ink)' }}>
          DOCKET is an application layer around Telegraph — not Telegraph itself.
        </h2>

        {/* architecture flow */}
        <div className="panel" style={{ marginTop: 36, padding: '26px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
            {FLOW.map(([node, desc], i) => (
              <div key={node}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    background: i === FLOW.length - 1 ? 'var(--signal)' : 'var(--ink)',
                    color: i === FLOW.length - 1 ? 'var(--dark)' : 'var(--bg)',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                    padding: '8px 14px', borderRadius: 'var(--radius)', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {node}
                  </div>
                  <span style={{ flex: 1, color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.5 }}>
                    {desc}
                  </span>
                </div>
                {i < FLOW.length - 1 && (
                  <div style={{ padding: '4px 0 4px 18px' }}>
                    <span style={{ color: 'var(--line-strong)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>│</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* lifecycle steps */}
        <div style={{ marginTop: 36 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {STEPS.map((s) => (
              <div key={s.n} className="side-card" style={{ padding: '16px 14px' }}>
                <div className="tnum" style={{ fontSize: 12, color: 'var(--signal)', fontFamily: 'var(--font-mono)' }}>{s.n}</div>
                <div className="label" style={{ color: 'var(--ink)', fontSize: 11, marginTop: 6, letterSpacing: '0.12em' }}>{s.title}</div>
                <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 6, lineHeight: 1.6, textTransform: 'none', letterSpacing: '0.02em' }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* on-chain anchors */}
        <div className="panel" style={{ marginTop: 36, padding: '8px 22px 14px' }}>
          <div className="label" style={{ padding: '12px 0 4px', fontSize: 9, letterSpacing: '0.22em' }}>ON-CHAIN ANCHORS</div>
          {[['Receipt Registry', REGISTRY], ['Telegraph Diamond', DIAMOND], ['USDC (escrow)', USDC]].map(([k, addr]) => (
            <div key={k} className="stat-row">
              <span className="stat-k" style={{ width: 170, flexShrink: 0 }}>{k}</span>
              <a className="link tnum" style={{ fontSize: 12 }} href={addr && explorerAddress(addr)} target="_blank" rel="noreferrer">
                {addr ? `${addr.slice(0, 8)}…${addr.slice(-6)} · view on explorer ↗` : '— set VITE_REGISTRY_ADDRESS'}
              </a>
            </div>
          ))}
          <div className="label" style={{ fontSize: 9, color: 'var(--faint)', padding: '8px 0 4px', lineHeight: 1.6 }}>
            diamond + usdc are protocol constants, verified on-chain. registry source is verified on Blockscout.
          </div>
        </div>

        {/* closing CTA */}
        <div style={{ marginTop: 56, borderTop: '1px solid var(--line)', paddingTop: 56, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(26px, 4vw, 44px)', letterSpacing: '-0.02em', color: 'var(--ink)', maxWidth: '22ch', margin: '0 auto', lineHeight: 1.1 }}>
            Ask the network. Keep the receipt.
          </h2>
          <p style={{ marginTop: 14, fontSize: 14, color: 'var(--muted)', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
            One question, one real Telegraph job, one immutable on-chain record — verifiable by anyone, from the chain, without trusting DOCKET.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <button onClick={() => go('dashboard')} className="act act-solid" style={{ fontSize: 13, padding: '12px 26px', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              Enter the dashboard <span aria-hidden>→</span>
            </button>
            <button onClick={() => go('dashboard/receipts')} className="act" style={{ fontSize: 13, padding: '12px 26px' }}>
              View the receipts
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
