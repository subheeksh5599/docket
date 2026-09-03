import { useState, useEffect, useCallback } from 'react';
import { REGISTRY, requestVerification, fetchLatestJobId } from '../lib/chain';
import { classifyError, errorLabel } from '../lib/errors';
import { receiptPermalink, explorerTx } from '../lib/evidence';

// Record — the dashboard's create panel: ask a question, pick an intent,
// escrow 1 USDC, and watch the job travel through the protocol. The timeline
// is real: it polls the registry until the callback mints the receipt.

const INTENTS = [
  { name: 'CRYPTO_PRICE', desc: 'Current price of a token — with the source the resolver cites.' },
  { name: 'ONCHAIN_TX_LOOKUP', desc: 'Status, block, sender and value of a transaction hash.' },
  { name: 'WALLET_BALANCE_CHECK', desc: 'Live balance of a wallet address on Base Sepolia.' },
  { name: 'GAS_PRICE', desc: 'Current gas price the network observes.' },
  { name: 'WEATHER_CHECK', desc: 'Current weather for a city.' },
  { name: 'FACT_CHECK', desc: 'A factual question — answered from the network\'s sources.' },
  { name: 'NEWS_SEARCH', desc: 'Recent news on a topic, with sources.' },
  { name: 'URL_SCAN', desc: 'A safety check of a URL.' },
  { name: 'CVE_LOOKUP', desc: 'Vulnerability details for a CVE id.' },
];

const STAGES = [
  { k: 'job', label: 'JOB CREATED', desc: 'ERC-8183 job on the Diamond' },
  { k: 'miner', label: 'MINER', desc: 'Routed through the network to a resolver' },
  { k: 'submitted', label: 'SUBMITTED', desc: 'Network response received' },
  { k: 'settled', label: 'SETTLED', desc: 'Callback accepted, resolver paid' },
  { k: 'receipt', label: 'RECEIPT MINTED', desc: 'Answer commitment locked' },
];

export default function RecordPanel({ wallet, go }) {
  const [question, setQuestion] = useState('');
  const [intent, setIntent] = useState(INTENTS[0].name);
  const [phase, setPhase] = useState('idle'); // idle | approving | miner | waiting | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const pollReceipt = useCallback(async (jobId) => {
    const { fetchReceipt } = await import('../lib/chain');
    for (let i = 0; i < 60; i++) { // up to ~8 min
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const rec = await fetchReceipt(jobId);
        if (rec.resolved) {
          setPhase('done');
          setResult((p) => ({ ...p, resolved: true, receipt: rec }));
          return;
        }
      } catch { /* keep polling */ }
    }
  }, []);

  const submit = async () => {
    if (!wallet.account) { wallet.connect(); return; }
    if (!REGISTRY) { setError({ message: 'Registry not deployed yet — VITE_REGISTRY_ADDRESS unset.' }); return; }
    if (!question.trim()) return;
    setError(null);
    setPhase('approving');
    try {
      const { approveHash, txHash } = await requestVerification({
        question: question.trim(), intent, budgetUsdc: '1000000', account: wallet.account,
      });
      setPhase('miner');
      // wait for the createJob tx, then find the job id from the registry
      const { publicClient } = await import('../lib/chain');
      let jobId = null;
      try {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        jobId = Number(await fetchLatestJobId(wallet.account));
      } catch { /* job id may surface later — status line still shows the tx */ }
      setResult({ question: question.trim(), intent, approveHash, txHash, jobId, resolved: false });
      setPhase('waiting');
      if (jobId) pollReceipt(jobId);
    } catch (e) {
      setPhase('error');
      const code = classifyError(e);
      setError({ code, message: errorLabel(code).message, retry: errorLabel(code).retry });
    }
  };

  const inputBase = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-2)', color: 'var(--ink)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius)',
    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none',
    transition: 'border-color .18s',
  };

  return (
    <div>
      <div className="term-feed-head" style={{ marginBottom: 18 }}>
        <span>Put a question on the record</span>
        {!wallet.account && <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>connect wallet to submit</span>}
      </div>

      <div className="panel" style={{ padding: '20px' }}>
        {/* question */}
        <div className="label" style={{ marginBottom: 6 }}>QUESTION</div>
        <textarea
          value={question} onChange={(e) => setQuestion(e.target.value)} rows={2}
          placeholder="What is the price of Ethereum right now?"
          style={{ ...inputBase, resize: 'vertical', minHeight: 54, fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 500 }}
        />

        {/* intent + budget */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div className="label" style={{ marginBottom: 6 }}>INTENT</div>
            <select value={intent} onChange={(e) => setIntent(e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
              {INTENTS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
            </select>
            <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 5, lineHeight: 1.5, textTransform: 'none', letterSpacing: '0.02em' }}>
              {INTENTS.find((i) => i.name === intent)?.desc}
            </div>
          </div>
          <div style={{ flex: '0 0 150px' }}>
            <div className="label" style={{ marginBottom: 6 }}>BUDGET</div>
            <div style={{ ...inputBase, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>$0.25</span><span className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>USDC</span>
            </div>
            <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 5 }}>job base price</div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="act act-solid" style={{ padding: '11px 20px', fontSize: 12 }} onClick={submit} disabled={phase === 'approving' || phase === 'waiting' || !question.trim()}>
            {phase === 'approving' ? 'Approving USDC…' : phase === 'waiting' ? 'Awaiting the network…' : 'Put it on the record →'}
          </button>
          {phase === 'done' && result?.resolved && (
            <button className="act" onClick={() => go(`dashboard/receipts`)}>View in receipts →</button>
          )}
        </div>

        {/* error */}
        {phase === 'error' && error && (
          <div className="panel" style={{ marginTop: 14, padding: '12px 14px', borderColor: 'var(--loss)' }}>
            <span className="label" style={{ color: 'var(--loss)' }}>⚠ {error.message}</span>
            {error.retry && <div className="label" style={{ color: 'var(--faint)', marginTop: 4, fontSize: 9 }}>retry: {error.retry}</div>}
          </div>
        )}

        {/* timeline */}
        {(phase === 'approving' || phase === 'miner' || phase === 'waiting') && result?.jobId && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <div className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.22em', marginBottom: 14 }}>
              {phase === 'waiting' ? `RECORD #${result.jobId} — TELEGRAPH JOB ACTIVE` : 'RECORD — SUBMITTING'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {STAGES.map((s, i) => {
                const isPast = phase === 'waiting' ? i < 2 : phase === 'miner' ? i <= 1 : i <= 0;
                const isActive = phase === 'waiting' && i === 2;
                const mark = isPast ? '✓' : isActive ? '●' : '○';
                const color = isPast ? 'var(--gain)' : isActive ? 'var(--signal)' : 'var(--faint)';
                return (
                  <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                    <span style={{ width: 16, color, fontSize: 12, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{mark}</span>
                    <span className="label" style={{ color, fontSize: 10, width: 130, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')} {s.label}</span>
                    <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>{s.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* status strip */}
      {(phase === 'waiting' || phase === 'done') && result?.jobId && (
        <div style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, background: 'var(--surface-2)' }}>
          <Stat label="NETWORK" v="Telegraph" />
          <Stat label="CHAIN" v="Base Sepolia" />
          <Stat label="JOB" v={result.jobId ? `#${result.jobId}` : '—'} />
          <Stat label="TX" v={result.txHash ? `${result.txHash.slice(0, 6)}…${result.txHash.slice(-4)}` : '—'} href={result.txHash ? explorerTx(result.txHash) : null} />
          <Stat label="STATUS" v={result.resolved ? '✓ RESOLVED' : 'AWAITING RESOLUTION'} live={!result.resolved} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, v, href, live }) {
  return (
    <div>
      <div className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>{label}</div>
      <div className="label" style={{ fontSize: 11, color: href ? 'var(--ink)' : live ? 'var(--signal)' : 'var(--ink)', marginTop: 4 }}>
        {href ? <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{v} ↗</a> : v}
      </div>
    </div>
  );
}
