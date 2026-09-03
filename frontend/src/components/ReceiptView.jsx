import { useState, useEffect, useCallback } from 'react';
import { fetchReceipt, REGISTRY } from '../lib/chain';
import {
  receiptToEvidence, downloadEvidenceBundle, receiptPermalink, explorerAddress,
  verifyChecksSummary,
} from '../lib/evidence';

const SHORT = (s) => (s ? String(s).slice(0, 6) + '…' + String(s).slice(-4) : '—');
const label = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--faint)' };

export default function ReceiptView({ jobId }) {
  const [state, setState] = useState('loading'); // loading | found | pending | missing | error
  const [receipt, setReceipt] = useState(null);
  const [checks, setChecks] = useState(null);
  const [pass, setPass] = useState(false);

  const load = useCallback(async () => {
    if (!jobId || !REGISTRY) { setState('missing'); return; }
    setState('loading');
    try {
      const r = await fetchReceipt(Number(jobId));
      const checksObj = {
        exists: !!r,
        resolved: !!r.resolved,
        immutable: !!r.answerHash && r.answerHash !== '0x' + '0'.repeat(64),
        askBound: !!r.questionHash && r.questionHash !== '0x' + '0'.repeat(64),
      };
      const ok = Object.values(checksObj).every(Boolean);
      const enriched = { ...r, registry: REGISTRY, _checks: checksObj, _pass: ok };
      setReceipt(enriched);
      setChecks(checksObj);
      setPass(ok);
      setState(r.resolved ? 'found' : 'pending');
    } catch (e) {
      const msg = e?.shortMessage || e?.message || '';
      setState(/no such|not found|revert/i.test(msg) ? 'missing' : 'error');
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  if (state === 'loading') {
    return (
      <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span className="label" style={{ color: 'var(--faint)' }}>verifying receipt #{jobId} from the chain…</span>
      </div>
    );
  }
  if (state === 'missing') {
    return (
      <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span className="label" style={{ color: 'var(--loss)' }}>no receipt exists for job #{jobId} on this registry</span>
        <div className="label" style={{ color: 'var(--faint)', marginTop: 6, fontSize: 9 }}>
          receipts are minted by the protocol callback after a miner resolves the job.
        </div>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span className="label" style={{ color: 'var(--loss)' }}>could not read the chain for job #{jobId}</span>
        <div style={{ marginTop: 14 }}><button className="act act-solid" onClick={load}>Retry</button></div>
      </div>
    );
  }

  const evidence = receiptToEvidence(receipt);
  const summary = verifyChecksSummary(checks);

  return (
    <div>
      {/* header row */}
      <div className="term-feed-head" style={{ marginBottom: 20 }}>
        <span>
          receipt #{receipt.jobId?.toString?.() ?? jobId}{' '}
          {pass ? <span style={{ color: 'var(--gain)' }}>✓ verified</span> : <span style={{ color: 'var(--loss)' }}>{state === 'pending' ? '… pending resolution' : 'not verified'}</span>}
        </span>
        <span className="tnum" style={{ color: 'var(--faint)', fontSize: 11 }}>
          {receipt.createdAt ? new Date(Number(receipt.createdAt) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : ''}
        </span>
      </div>

      {/* the receipt as a stat table */}
      <div className="panel" style={{ padding: '6px 18px' }}>
        <div className="label" style={{ padding: '12px 0 4px' }}>{'// the receipt'}</div>
        <Row k="registry" v={SHORT(REGISTRY)} href={explorerAddress(REGISTRY)} />
        <Row k="job id" v={String(receipt.jobId ?? jobId)} />
        <Row k="intent" v={receipt.intentId} mono short />
        <Row k="question hash" v={receipt.questionHash} mono short />
        <Row k="answer commitment" v={receipt.answerHash} mono short />
        <Row k="resolved" v={String(Boolean(receipt.resolved))} />
      </div>

      {pass && summary && (
        <div className="panel" style={{ marginTop: 14, padding: '12px 16px', borderColor: 'color-mix(in oklch, var(--gain) 40%, var(--line))' }}>
          <div className="label" style={{ color: 'var(--gain)', marginBottom: 6 }}>// verified on-chain</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {summary.map((s) => (
              <span key={s} className="label" style={{ color: 'var(--muted)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'none' }}>✓ {s}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="act act-solid" onClick={() => downloadEvidenceBundle(evidence, receipt.jobId?.toString?.() ?? jobId)}>
          Export evidence bundle
        </button>
        <button className="act" onClick={() => { navigator.clipboard?.writeText(receiptPermalink(receipt.jobId?.toString?.() ?? jobId)); }}>
          Copy permalink
        </button>
      </div>
    </div>
  );
}

function Row({ k, v, href, short }) {
  return (
    <div className="stat-row" style={{ gap: 16 }}>
      <span className="stat-k" style={{ flexShrink: 0, width: 150 }}>{k}</span>
      {href ? (
        <a className="link tnum" style={{ fontSize: 12, wordBreak: 'break-all' }} href={href} target="_blank" rel="noreferrer">{v} ↗</a>
      ) : (
        <span className="stat-v" style={{ wordBreak: 'break-all' }}>{v}</span>
      )}
    </div>
  );
}
