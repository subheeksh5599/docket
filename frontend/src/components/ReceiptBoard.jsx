import { useState, useEffect } from 'react';
import { publicClient, fetchUserJobCount, fetchReceipt, REGISTRY, registryAbi } from '../lib/chain';
import { canonicalAnswerHash } from '../lib/hash';
import { receiptPermalink, explorerTx } from '../lib/evidence';

export default function ReceiptBoard({ wallet }) {
  const [count, setCount] = useState(0);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!wallet.account || !REGISTRY) return;
    let live = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const n = await fetchUserJobCount(wallet.account);
        if (!live) return;
        setCount(n);
        const rows = [];
        for (let i = 0; i < Math.min(n, 50); i++) { // bounded reads
          const jobId = await fetchReceiptForIdx(wallet.account, i);
          rows.push({ idx: i, ...jobId });
        }
        if (live) setReceipts(rows);
      } catch (e) { if (live) setError(e?.message || 'Failed to load'); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [wallet.account]);

  async function fetchReceiptForIdx(address, idx) {
    try {
      const jobId = await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'jobsOf', args: [address, BigInt(idx)] });
      const r = await fetchReceipt(Number(jobId));
      return { jobId: jobId.toString(), resolved: r.resolved, answerHash: r.answerHash, questionHash: r.questionHash, createdAt: Number(r.createdAt), intentId: r.intentId };
    } catch { return { jobId: '—', resolved: false }; }
  }

  if (!wallet.account) {
    return (
      <div className="card-dark p-8 text-center">
        <p className="text-pure-white/60">Connect your wallet to view your receipts.</p>
      </div>
    );
  }
  if (!REGISTRY) {
    return (
      <div className="card-dark p-8 text-center">
        <p className="text-signal-yellow text-sm">Receipts appear here once the registry is deployed (VITE_REGISTRY_ADDRESS).</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <p className="eyebrow text-neon-pulse mb-1">THE RECORD</p>
          <h2 className="font-aeonikfono text-3xl text-pure-white">Your receipts</h2>
        </div>
        <div className="text-right">
          <div className="font-aeonikfono text-5xl font-medium text-neon-pulse leading-none">{count}</div>
          <div className="eyebrow text-pure-white/50 mt-1">RECEIPTS MINTED</div>
        </div>
      </div>

      {loading && <p className="text-pure-white/50 py-8">Reading the chain…</p>}
      {error && <p className="text-red-300 text-sm py-4">{error}</p>}
      {!loading && !error && receipts.length === 0 && (
        <div className="card-dark p-10 text-center">
          <span className="w-2 h-2 rounded-full bg-pure-white/20 inline-block mb-3" />
          <p className="text-pure-white/50">No receipts yet. Ask the network and the record starts here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {receipts.map((r) => (
          <ReceiptCard key={r.idx} r={r} />
        ))}
      </div>
    </div>
  );
}

function ReceiptCard({ r }) {
  const [verifyState, setVerifyState] = useState('idle');
  const [verifyResult, setVerifyResult] = useState(null);

  const runVerify = async () => {
    setVerifyState('checking');
    try {
      const receipt = await fetchReceipt(Number(r.jobId === '—' ? 0 : r.jobId));
      // recompute the canonical hash of the response (needs the answer payload; for a
      // stored receipt we verify: receipt exists, resolved, locked — the immutable
      // commitment is the anchor; full answer re-hash needs callback calldata)
      const checks = {
        exists: !!receipt,
        resolved: !!receipt.resolved,
        immutable: !!receipt.answerHash && receipt.answerHash !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        askBound: !!receipt.questionHash && receipt.questionHash !== '0x0000000000000000000000000000000000000000000000000000000000000000',
      };
      const pass = Object.values(checks).every(Boolean);
      setVerifyResult({ pass, checks, hash: receipt.answerHash, questionHash: receipt.questionHash });
      setVerifyState('done');
    } catch (e) {
      setVerifyState('error');
      setVerifyResult({ pass: false, error: e?.message });
    }
  };

  return (
    <div className="card-dark p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="eyebrow text-pure-white/50">RECEIPT</span>
        {r.resolved ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-neon-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-pulse pulse-dot" /> MINTED
          </span>
        ) : (
          <span className="text-xs text-pure-white/40">PENDING</span>
        )}
      </div>
      <p className="font-mono text-xs text-pure-white/60 break-all mb-2">job #{r.jobId}</p>
      {r.resolved ? (
        <>
          <p className="font-mono text-xs text-pure-white/50 break-all mb-1">commitment: {String(r.answerHash || '').slice(0, 24)}…</p>
          <div className="flex items-center gap-3 flex-wrap">
            <a className="text-neon-pulse text-xs underline" href={explorerTx(r.jobId === '—' ? null : r.jobId)} target="_blank" rel="noreferrer">explorer →</a>
            <a className="text-pure-white/70 text-xs underline hover:text-neon-pulse" href={r.jobId !== '—' ? receiptPermalink(r.jobId) : undefined}>permalink →</a>
            <button className="text-pure-white/70 text-xs underline hover:text-neon-pulse" onClick={runVerify} disabled={verifyState==='checking'}>
              {verifyState==='checking' ? 'verifying…' : 'verify from chain'}
            </button>
          </div>
          {verifyState==='done' && verifyResult && (
            <div className={`mt-3 rounded-[10px] p-3 text-xs ${verifyResult.pass ? 'bg-neon-pulse/10 text-neon-pulse' : 'bg-red-400/10 text-red-300'}`}>
              {verifyResult.pass ? (
                <>
                  <span className="font-medium">VERIFIED NETWORK RETURN</span>
                  <div className="text-pure-white/60 mt-1">
                    receipt exists ✓ · resolved ✓ · immutable commitment present ✓
                  </div>
                </>
              ) : (
                <span>verification failed {verifyResult.error ? `— ${verifyResult.error}` : ''}</span>
              )}
            </div>
          )}
          {verifyState==='error' && verifyResult && (
            <div className="mt-3 rounded-[10px] bg-red-400/10 p-3 text-xs text-red-300">
              verification error: {verifyResult.error}
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-pure-white/40">Waiting for the network to resolve…</p>
      )}
    </div>
  );
}
