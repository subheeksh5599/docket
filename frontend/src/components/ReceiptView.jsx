import { useState, useEffect, useCallback } from 'react';
import { fetchReceipt, REGISTRY } from '../lib/chain';
import { canonicalQuestionHash } from '../lib/hash';
import {
  receiptToEvidence, downloadEvidenceBundle, receiptPermalink, explorerAddress,
  verifyChecksSummary,
} from '../lib/evidence';

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
    return <div className="card-dark p-10 text-center text-muted">Verifying receipt #{jobId} from the chain…</div>;
  }
  if (state === 'missing') {
    return (
      <div className="card-dark p-10 text-center">
        <p className="text-loss">No receipt exists for job #{jobId} on this registry.</p>
        <p className="text-faint text-sm mt-2">Receipts are minted by the protocol callback after a miner resolves the job.</p>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="card-dark p-10 text-center">
        <p className="text-loss">Could not read the chain for job #{jobId}.</p>
        <button className="btn-pill-primary mt-4" onClick={load}>Retry</button>
      </div>
    );
  }

  const evidence = receiptToEvidence(receipt);
  const summary = verifyChecksSummary(checks);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="eyebrow text-faint mb-1">ON THE RECORD</p>
          <h2 className="font-display text-3xl font-bold text-ink">Receipt #{receipt.jobId?.toString?.() ?? jobId}</h2>
        </div>
        {pass ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-gain font-mono uppercase tracking-[0.08em]">
            <span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" /> Verified on-chain
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-loss font-mono uppercase tracking-[0.08em]">
            <span className="w-1.5 h-1.5 rounded-full bg-loss pulse-dot" /> {state === 'pending' ? 'Pending resolution' : 'Not verified'}
          </span>
        )}
      </div>

      <div className="card-white p-6 space-y-3 font-mono text-xs break-all">
        <Row k="registry" v={REGISTRY} href={explorerAddress(REGISTRY)} />
        <Row k="question hash" v={receipt.questionHash} mono />
        <Row k="answer commitment" v={receipt.answerHash} mono />
        <Row k="intent" v={receipt.intentId} mono />
        <Row k="created" v={receipt.createdAt ? new Date(Number(receipt.createdAt) * 1000).toISOString() : '—'} />
        <Row k="resolved" v={String(Boolean(receipt.resolved))} />
      </div>

      {pass && summary && (
        <div className="card-dark border border-gain/40 p-5">
          <p className="eyebrow text-gain mb-2">INDEPENDENT VERIFICATION</p>
          <ul className="text-sm text-muted space-y-1 font-mono">
            {summary.map((s) => <li key={s}>✓ {s}</li>)}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="btn-pill-primary" onClick={() => downloadEvidenceBundle(evidence, receipt.jobId?.toString?.() ?? jobId)}>
          Export evidence bundle
        </button>
        <button
          className="btn-pill-secondary"
          onClick={() => { navigator.clipboard?.writeText(receiptPermalink(receipt.jobId?.toString?.() ?? jobId)); }}
        >
          Copy permalink
        </button>
      </div>
    </div>
  );
}

function Row({ k, v, href, mono }) {
  return (
    <div className="flex flex-col md:flex-row md:gap-4">
      <span className="text-faint md:w-40 shrink-0 uppercase tracking-wider text-[10px] md:pt-0.5">{k}</span>
      {href ? (
        <a className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" href={href} target="_blank" rel="noreferrer">{v}</a>
      ) : (
        <span className="text-ink/90">{v}</span>
      )}
    </div>
  );
}
