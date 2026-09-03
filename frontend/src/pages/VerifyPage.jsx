import { useState } from 'react';
import { REGISTRY, fetchReceipt } from '../lib/chain';
import { canonicalAnswerHash } from '../lib/hash';

// Verify — a minimal independent verifier. Paste a receipt id (+ optionally the
// network response you hold). DOCKET checks against the chain and reports what
// it actually verified. No trust in DOCKET required — reads are direct RPC.

export default function VerifyPage() {
  const [id, setId] = useState('');
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState('idle'); // idle | checking | done | error
  const [result, setResult] = useState(null);

  const run = async () => {
    const jobId = Number(id.trim());
    if (!jobId || jobId <= 0) { setResult({ pass: false, error: 'enter a numeric receipt id' }); setState('error'); return; }
    if (!REGISTRY) { setResult({ pass: false, error: 'registry env not set' }); setState('error'); return; }
    setState('checking'); setResult(null);
    try {
      const r = await fetchReceipt(jobId);
      const checks = {
        exists: !!r,
        locked: !!r.answerHash && r.answerHash !== '0x' + '0'.repeat(64),
        resolved: !!r.resolved,
      };
      let hashMatch = null;
      if (answer.trim() && checks.exists) {
        try {
          const resp = JSON.parse(answer);
          hashMatch = canonicalAnswerHash(resp) === r.answerHash;
        } catch {
          try { hashMatch = canonicalAnswerHash({ strings: [answer.trim()] }) === r.answerHash; }
          catch { hashMatch = false; }
        }
        checks.answerMatches = hashMatch;
      }
      const pass = Object.values(checks).every(Boolean) && (hashMatch === null || hashMatch === true);
      setResult({ pass, checks, hashMatch, answerHash: r.answerHash, jobId });
      setState('done');
    } catch (e) {
      const msg = e?.shortMessage || e?.message || '';
      if (/no such|not found|no receipt|revert|does not exist/i.test(msg)) {
        setResult({ pass: false, error: `no receipt #${jobId} exists on this registry`, jobId });
      } else {
        setResult({ pass: false, error: msg });
      }
      setState('error');
    }
  };

  const checksList = result?.checks
    ? [
        ['Receipt exists on-chain', result.checks.exists],
        ['Receipt is locked (immutable)', result.checks.locked],
        ['Telegraph job resolved', result.checks.resolved],
        ...(result.checks.answerMatches !== undefined ? [['Answer commitment matches', result.checks.answerMatches]] : []),
      ]
    : [];

  return (
    <div style={{ padding: 'clamp(8px, 1vw, 12px) 0 24px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Verify a DOCKET receipt</h1>
      <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Paste a receipt id. The check runs directly against the Base Sepolia registry — no DOCKET server involved.
      </p>

      <div className="panel" style={{ marginTop: 22, padding: '20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label className="label" htmlFor="verify-id" style={{ marginBottom: 6, display: 'block' }}>RECEIPT ID</label>
            <input id="verify-id" value={id} onChange={(e) => setId(e.target.value)} placeholder="24" inputMode="numeric" aria-label="Receipt ID"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </div>
          <div style={{ flex: '2 1 260px' }}>
            <label className="label" htmlFor="verify-answer" style={{ marginBottom: 6, display: 'block' }}>ANSWER (OPTIONAL — re-hash check)</label>
            <input id="verify-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="paste the network response JSON you hold…" aria-label="Answer response for re-hash check"
              style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
          </div>
          <button className="act act-solid" onClick={run} disabled={state === 'checking' || !id.trim()}>
            {state === 'checking' ? 'Checking…' : 'Verify'}
          </button>
        </div>

        {/* result */}
        {state === 'done' && result && (
          <div className="panel" style={{ marginTop: 18, padding: '18px', borderColor: result.pass ? 'var(--gain)' : 'var(--loss)', background: result.pass ? 'color-mix(in oklch, var(--gain) 5%, transparent)' : undefined }}>
            <div className="label" style={{ color: result.pass ? 'var(--gain)' : 'var(--loss)', fontSize: 13, letterSpacing: '0.2em' }}>
              {result.pass ? '✓ VALID RECEIPT' : '✕ INVALID RECEIPT'}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checksList.map(([k, ok]) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: ok ? 'var(--gain)' : 'var(--loss)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{ok ? '✓' : '✕'}</span>
                  <span className="label" style={{ fontSize: 10, color: ok ? 'var(--muted)' : 'var(--loss)' }}>{k}</span>
                </div>
              ))}
            </div>
            {result.hashMatch === false && (
              <div style={{ marginTop: 8 }}><span className="label" style={{ color: 'var(--loss)', fontSize: 10 }}>the pasted response does NOT commit to this receipt's on-chain answer hash.</span></div>
            )}
          </div>
        )}
        {state === 'error' && result && (
          <div className="panel" style={{ marginTop: 18, padding: '16px', borderColor: 'var(--loss)' }}>
            <span className="label" style={{ color: 'var(--loss)' }}>✕ {result.error}</span>
          </div>
        )}

        {/* machine-readable result — for agents */}
        {state === 'done' && result && (
          <div style={{ marginTop: 14 }}>
            <div className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.2em', marginBottom: 6 }}>MACHINE-READABLE RESULT (FOR AGENTS)</div>
            <pre style={{
              margin: 0, padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink)',
              overflow: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
{JSON.stringify({
  receipt: result.jobId,
  resolved: result.checks?.resolved ?? false,
  locked: result.checks?.locked ?? false,
  answerHash: result.answerHash,
  verified: result.pass,
}, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>
          checks run: getReceipt(jobId) on {REGISTRY ? `registry ${REGISTRY.slice(0, 6)}…${REGISTRY.slice(-4)}` : '(registry env unset)'} — direct RPC, no DOCKET backend.
        </span>
      </div>
    </div>
  );
}
