import { useState, useEffect, useCallback } from 'react';
import { REGISTRY, fetchReceipt } from '../lib/chain';
import { canonicalAnswerHash } from '../lib/hash';
import { receiptToEvidence, downloadEvidenceBundle, receiptPermalink, explorerAddress, explorerTx } from '../lib/evidence';

// Receipt detail — the record as infrastructure: provenance + integrity, with
// the honest NETWORK RESPONSE framing. DOCKET never says "truth": it shows the
// commitment and lets anyone re-verify from the chain.

const short = (s) => (s ? String(s).slice(0, 6) + '…' + String(s).slice(-4) : '—');
const label = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--faint)' };

export default function ReceiptDetail({ jobId }) {
  const [state, setState] = useState('loading'); // loading | found | pending | missing | error
  const [receipt, setReceipt] = useState(null);
  const [checks, setChecks] = useState(null);
  const [pass, setPass] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [pasteResult, setPasteResult] = useState(null);

  const load = useCallback(async () => {
    if (!jobId || !REGISTRY) { setState('missing'); return; }
    setState('loading');
    try {
      const r = await fetchReceipt(Number(jobId));
      const checksObj = {
        exists: true,
        resolved: !!r.resolved,
        immutable: !!r.answerHash && r.answerHash !== '0x' + '0'.repeat(64),
        askBound: !!r.questionHash && r.questionHash !== '0x' + '0'.repeat(64),
      };
      const ok = Object.values(checksObj).every(Boolean);
      const enriched = { ...r, registry: REGISTRY, _checks: checksObj, _pass: ok };
      setReceipt(enriched); setChecks(checksObj); setPass(ok);
      setState(r.resolved ? 'found' : 'pending');
    } catch (e) {
      const msg = e?.shortMessage || e?.message || '';
      setState(/no such|not found|revert/i.test(msg) ? 'missing' : 'error');
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  // independent re-hash check: user pastes the network response they hold
  const runPasteCheck = () => {
    if (!paste.trim()) return;
    try {
      const resp = JSON.parse(paste);
      const h = canonicalAnswerHash(resp);
      const match = h === receipt.answerHash;
      setPasteResult({ match, hash: h });
    } catch {
      // not JSON — try as raw string commitment (e.g. the answer text)
      try {
        const h = canonicalAnswerHash({ strings: [paste.trim()] });
        setPasteResult({ match: h === receipt.answerHash, hash: h, raw: true });
      } catch { setPasteResult({ match: false, error: 'could not hash that input' }); }
    }
  };

  if (state === 'loading') return <Center>verifying receipt #{jobId} from the chain…</Center>;
  if (state === 'missing') return <Center tone="loss">no receipt exists for job #{jobId} on this registry</Center>;
  if (state === 'error') {
    return (
      <Center tone="loss">
        could not read the chain for job #{jobId}
        <div style={{ marginTop: 14 }}><button className="act act-solid" onClick={load}>Retry</button></div>
      </Center>
    );
  }

  const ts = receipt.createdAt ? new Date(Number(receipt.createdAt) * 1000) : null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px, 5vw, 56px) 24px 0' }}>
      {/* ---- HEADER ---- */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 36, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Receipt #{receipt.jobId?.toString?.() ?? jobId}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {pass ? (
            <span className="label" style={{ color: 'var(--gain)', fontSize: 10, border: '1px solid color-mix(in oklch, var(--gain) 40%, transparent)', borderRadius: 2, padding: '4px 8px' }}>
              ✓ RESOLVED · IMMUTABLE
            </span>
          ) : (
            <span className="label" style={{ color: 'var(--signal)', fontSize: 10, border: '1px solid color-mix(in oklch, var(--signal) 40%, transparent)', borderRadius: 2, padding: '4px 8px' }}>
              … PENDING
            </span>
          )}
        </div>
      </div>

      {/* ---- NETWORK RESPONSE (honest framing) ---- */}
      <div className="panel" style={{ marginTop: 22, padding: '20px 22px', borderColor: pass ? 'color-mix(in oklch, var(--gain) 30%, var(--line))' : undefined }}>
        <div className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.22em', marginBottom: 12 }}>NETWORK RESPONSE</div>
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.7, fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
          {receipt.answerHash}
        </div>
        <div className="label" style={{ marginTop: 12, fontSize: 9, color: 'var(--faint)', lineHeight: 1.6, textTransform: 'none', letterSpacing: '0.02em' }}>
          DOCKET records the commitment returned by Telegraph. It does not independently determine whether the response is true — the anchor is the hash; the response it commits to is re-verifiable below.
        </div>
      </div>

      {/* ---- PROVENANCE ---- */}
      <div className="panel" style={{ marginTop: 14, padding: '8px 22px 12px' }}>
        <div className="label" style={{ padding: '12px 0 4px', fontSize: 9, letterSpacing: '0.22em' }}>PROVENANCE</div>
        <Row k="Question (commitment)" v={short(receipt.questionHash)} mono />
        <Row k="Intent" v={short(receipt.intentId)} mono />
        <Row k="Job" v={`#${receipt.jobId?.toString?.() ?? jobId}`} href={explorerTx(receipt.jobId?.toString?.())} linkLabel="view on explorer" />
        <Row k="Registry" v={short(REGISTRY)} href={explorerAddress(REGISTRY)} linkLabel="view on explorer" />
        <Row k="Chain" v="Base Sepolia (84532)" />
        <Row k="Block / Timestamp" v={ts ? `${ts.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · ${ts.toISOString().slice(11, 19)} UTC` : '—'} mono />
      </div>

      {/* ---- CRYPTOGRAPHIC INTEGRITY ---- */}
      <div className="panel" style={{ marginTop: 14, padding: '8px 22px 16px', borderColor: 'color-mix(in oklch, var(--signal) 35%, var(--line))' }}>
        <div className="label" style={{ padding: '12px 0 4px', fontSize: 9, letterSpacing: '0.22em' }}>INTEGRITY — ANSWER COMMITMENT</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
          <span className="label" style={{ fontSize: 10 }}>keccak256(abi.encode(response))</span>
          <span className="tnum" style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>=</span>
          <span className="tnum" style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{receipt.answerHash}</span>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 4 }}>
          <button className="act" onClick={() => setVerifyOpen((o) => !o)}>
            {verifyOpen ? 'Hide' : 'Verify independently'}
          </button>
          <span className="label" style={{ marginLeft: 12, fontSize: 9, color: 'var(--faint)' }}>
            verification does not require trusting the DOCKET website.
          </span>

          {verifyOpen && (
            <div style={{ marginTop: 14 }}>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginBottom: 6 }}>
                paste the network response you hold (JSON) — DOCKET re-hashes it and compares to the on-chain commitment:
              </div>
              <textarea
                value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
                placeholder='{"status":"resolved","answer":"…","summary":"…","confidence":0.9,"miner":"0x…"}'
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical' }}
              />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="act act-solid" onClick={runPasteCheck}>Check commitment</button>
                {pasteResult && (
                  <span className="label" style={{ color: pasteResult.match ? 'var(--gain)' : 'var(--loss)', fontSize: 10 }}>
                    {pasteResult.match ? '✓ MATCHES the on-chain commitment' : pasteResult.error || '✕ does NOT match the on-chain commitment'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <button className="act act-solid" onClick={() => downloadEvidenceBundle(receiptToEvidence(receipt), receipt.jobId?.toString?.() ?? jobId)}>
          Export evidence bundle
        </button>
        <button className="act" onClick={() => { navigator.clipboard?.writeText(receiptPermalink(receipt.jobId?.toString?.() ?? jobId)); }}>
          Copy permalink
        </button>
      </div>
    </div>
  );
}

function Row({ k, v, mono, href, linkLabel }) {
  return (
    <div className="stat-row" style={{ gap: 16 }}>
      <span className="stat-k" style={{ flexShrink: 0, width: 170 }}>{k}</span>
      {href ? (
        <a className="link tnum" style={{ fontSize: 12.5, wordBreak: 'break-all' }} href={href} target="_blank" rel="noreferrer">{v} · {linkLabel || '↗'}</a>
      ) : (
        <span className="stat-v" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{v}</span>
      )}
    </div>
  );
}

function Center({ children, tone }) {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(40px, 6vw, 80px) 24px', textAlign: 'center' }}>
      <div className="panel" style={{ padding: '40px 24px' }}>
        <span className="label" style={{ color: tone === 'loss' ? 'var(--loss)' : 'var(--faint)', fontSize: 11 }}>{children}</span>
      </div>
    </div>
  );
}
