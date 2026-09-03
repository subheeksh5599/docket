import { useEffect, useState } from 'react';
import { REGISTRY, fetchRecentReceipts } from '../lib/chain';
import { receiptPermalink } from '../lib/evidence';

// Landing — the first page. Same marketing grammar as the reference: pixel
// wordmark, one concrete headline, one CTA into the product, then the
// evidence section. No walls of text, no generic "infrastructure" claims.

const EVIDENCE = [
  {
    n: '01',
    k: 'ASK',
    t: 'One question. One real job.',
    d: 'Type a factual question, pick an intent, escrow 1 USDC (testnet). DOCKET writes two transactions — approve, then requestVerification — and a real ERC-8183 job is created on the Telegraph Diamond.',
  },
  {
    n: '02',
    k: 'ANSWERED',
    t: 'A real miner, not us.',
    d: 'Telegraph routes the job to a registered miner. The miner resolves it and the protocol settles the payment — DOCKET never touches the answer, the miner, or the escrow. DOCKET is not Telegraph; it sits on top of it.',
  },
  {
    n: '03',
    k: 'LOCKED',
    t: 'The receipt cannot lie.',
    d: 'The same callback that pays the miner writes the answer commitment to the ReceiptRegistry on Base Sepolia. One write, then locked — no update function exists. Anyone can re-verify from any RPC, forever.',
  },
];

export default function LandingPage({ wallet, go }) {
  const [recent, setRecent] = useState(null);

  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    fetchRecentReceipts(5).then((r) => { if (live) setRecent(r); });
    return () => { live = false; };
  }, []);

  const openDashboard = () => go('dashboard');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* ---- HERO ---- */}
      <section style={{ borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(72px, 14vh, 140px) 24px clamp(48px, 8vh, 80px)' }}>
          <div className="pixel" style={{ fontSize: 18, letterSpacing: '0.06em', color: 'var(--ink)' }}>
            <span className="kol">DOC</span>KET
            <span className="flick" style={{ color: 'var(--ink)' }}>_</span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(44px, 8vw, 104px)', lineHeight: 0.96, letterSpacing: '-0.03em', color: 'var(--ink)', maxWidth: '14ch', marginTop: 18 }}>
            Put a question on the record.
          </h1>

          <p style={{ maxWidth: '56ch', marginTop: 24, fontSize: 16, color: 'var(--muted)', lineHeight: 1.7 }}>
            DOCKET turns a factual question into a permanent, independently checkable receipt —
            produced by a real Telegraph miner through the protocol's own payment callback, locked
            on-chain forever. Not a screenshot. Not a claim. A receipt.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 32 }}>
            <button onClick={openDashboard} className="act act-solid" style={{ fontSize: 13, padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              Enter the dashboard <span aria-hidden>→</span>
            </button>
            <button onClick={() => go('dashboard/receipts')} className="act" style={{ fontSize: 13, padding: '12px 24px' }}>
              Explore receipts
            </button>
          </div>

          <div className="label" style={{ marginTop: 36, fontSize: 9, color: 'var(--faint)', letterSpacing: '0.3em' }}>
            BASE SEPOLIA · TELEGRAPH · ERC-8183
          </div>
        </div>
      </section>

      {/* ---- EVIDENCE: how the ledger works ---- */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(56px, 10vw, 120px) 24px' }}>
        <div className="label" style={{ marginBottom: 10 }}>{'// how the record works'}</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(28px, 5vw, 52px)', letterSpacing: '-0.02em', maxWidth: '20ch', lineHeight: 1.05 }}>
          The receipt is minted by the network — not by DOCKET.
        </h2>

        <div style={{ marginTop: 48, display: 'grid', gap: 1, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', background: 'var(--line)', border: '1px solid var(--line)' }}>
          {EVIDENCE.map((e) => (
            <div key={e.n} style={{ background: 'var(--bg)', padding: '30px 28px 34px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--signal)' }}>{e.n}</span>
                <span className="label" style={{ fontSize: 10, color: 'var(--faint)' }}>{e.k}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)', marginTop: 12 }}>{e.t}</h3>
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>{e.d}</p>
            </div>
          ))}
        </div>

        {/* live recent-records strip — real receipts, proof it works */}
        <div style={{ marginTop: 48 }}>
          <div className="term-feed-head">
            <span>Recent records <span className="flick" style={{ color: 'var(--signal)' }}>●</span></span>
            <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>LIVE — READ FROM THE CHAIN</span>
          </div>
          {!recent ? (
            <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
              <span className="label" style={{ color: 'var(--faint)' }}>reading…</span>
            </div>
          ) : recent.length === 0 ? (
            <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>
              <span className="label" style={{ color: 'var(--faint)' }}>no receipts in the recent window</span>
            </div>
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
