import { useMemo, useState } from 'react';
import { REGISTRY, publicClient, registryAbi, fetchUserJobCount, fetchReceipt } from '../lib/chain';
import { receiptPermalink, explorerTx } from '../lib/evidence';

const SHORT = (s) => (s ? String(s).slice(0, 6) + '…' + String(s).slice(-4) : '—');

// The record — a terminal feed of receipts, mirroring the dashboard shell:
// avatar dot, method label, tx short-hash link, UTC timestamp, commitment.
// Live Base Sepolia reads only; no wallet required for a connected address.

export default function ReceiptFeed({ wallet }) {
  const [txns, setTxns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const refresh = async () => {
    if (!wallet.account || !REGISTRY) return;
    setLoading(true); setErr(null);
    try {
      const n = await fetchUserJobCount(wallet.account);
      const rows = [];
      for (let i = 0; i < Math.min(n, 50); i++) {
        try {
          const jobId = await fetchJobIdAt(wallet.account, i);
          const r = await fetchReceipt(Number(jobId));
          rows.push({
            jobId: jobId.toString(),
            method: r.resolved ? 'mint' : 'pending',
            from: wallet.account,
            to: REGISTRY,
            hash: jobId.toString(),
            timestamp: r.createdAt ? Number(r.createdAt) * 1000 : null,
            answerHash: r.answerHash,
            questionHash: r.questionHash,
            intentId: r.intentId,
            resolved: r.resolved,
          });
        } catch { /* skip unreadable idx */ }
      }
      setTxns(rows);
    } catch (e) { setErr(e?.message || 'Failed to load the record'); }
    finally { setLoading(false); }
  };

  // load on mount + when account changes
  const [lastAcct, setLastAcct] = useState(null);
  if (wallet.account && wallet.account !== lastAcct) {
    setLastAcct(wallet.account);
    setTimeout(() => void refresh(), 0);
  }

  if (!wallet.account) {
    return (
      <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span className="label" style={{ color: 'var(--faint)' }}>connect your wallet to read the record</span>
      </div>
    );
  }
  if (!REGISTRY) {
    return (
      <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <span className="label" style={{ color: 'var(--loss)' }}>registry not set — VITE_REGISTRY_ADDRESS</span>
      </div>
    );
  }

  return (
    <div>
      {err && (
        <div className="panel" style={{ padding: '12px 16px', borderColor: 'var(--loss)', marginBottom: 14 }}>
          <span className="label" style={{ color: 'var(--loss)' }}>⚠ {err}</span>
        </div>
      )}

      {!loading && txns && txns.length === 0 && (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <span className="label" style={{ color: 'var(--faint)' }}>no receipts yet — ask the network and the record starts here</span>
        </div>
      )}
      {loading && !txns && (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <span className="label" style={{ color: 'var(--faint)' }}>reading the chain…</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(txns ?? []).map((t) => (
          <ReceiptRow key={t.jobId} t={t} />
        ))}
      </div>
    </div>
  );
}

async function fetchJobIdAt(address, idx) {
  return publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'jobsOf', args: [address, BigInt(idx)] });
}

function ReceiptRow({ t }) {
  const initial = t.resolved ? '✓' : '…';
  return (
    <article className="tweet">
      <div className="tw-avatar" style={{ color: t.resolved ? 'var(--gain)' : 'var(--faint)', fontSize: 13 }}>{initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className="tw-name" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t.resolved ? 'minted' : 'pending'}
          </span>
          <span className="tw-src tnum" style={{ fontSize: 11 }}>
            <a href={explorerTx(t.jobId)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>job #{t.jobId}↗</a>
          </span>
          <span className="label" style={{ marginLeft: 'auto', fontSize: 10 }}>
            {t.timestamp ? new Date(t.timestamp).toISOString().replace('T', ' ').slice(5, 19) + ' UTC' : '—'}
          </span>
        </div>
        <p style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, wordBreak: 'break-word' }}>
          intent <a className="link" href={receiptPermalink(t.jobId)} target="_blank" rel="noreferrer">{SHORT(t.intentId)}</a> · question <span className="tnum">{SHORT(t.questionHash)}</span>
          {t.resolved ? <span className="tnum" style={{ color: 'var(--gain)' }}> · commitment {SHORT(t.answerHash)}</span> : null}
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
          <a className="link label" style={{ fontSize: 10 }} href={receiptPermalink(t.jobId)}>permalink ↗</a>
          <a className="link label" style={{ fontSize: 10 }} href={explorerTx(t.jobId)} target="_blank" rel="noreferrer">explorer ↗</a>
        </div>
      </div>
    </article>
  );
}
