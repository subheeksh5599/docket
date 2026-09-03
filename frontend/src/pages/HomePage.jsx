import { useState, useEffect, useCallback } from 'react';
import { REGISTRY, fetchRecentReceipts, fetchMetrics, requestVerification } from '../lib/chain';
import { classifyError, errorLabel } from '../lib/errors';
import { receiptPermalink, explorerTx } from '../lib/evidence';

// Home — the product IS the pitch. Above the fold: headline + a live
// create-record panel. Below: recent network records + real protocol metrics.
// No marketing graphics, no fake counters — every number is a chain read.

const INTENTS = [
  { name: 'CRYPTO_PRICE', desc: 'Current price of a token — with the exact source the miner cites.' },
  { name: 'ONCHAIN_TX_LOOKUP', desc: 'Status, block, sender and value of a transaction hash.' },
  { name: 'WALLET_BALANCE_CHECK', desc: 'Live balance of a wallet address on Base Sepolia.' },
  { name: 'GAS_PRICE', desc: 'Current gas price the network observes.' },
  { name: 'WEATHER_CHECK', desc: 'Current weather for a city or region.' },
  { name: 'FACT_CHECK', desc: 'A factual question — answered by the network from its sources.' },
  { name: 'NEWS_SEARCH', desc: 'Recent news on a topic, with sources.' },
  { name: 'URL_SCAN', desc: 'A safety check of a URL.' },
  { name: 'CVE_LOOKUP', desc: 'Vulnerability details for a CVE id.' },
];

const STAGES = [
  { k: 'job', label: 'JOB CREATED', desc: 'ERC-8183 job on the Diamond' },
  { k: 'miner', label: 'MINER', desc: 'Routed to a real registered miner' },
  { k: 'submitted', label: 'SUBMITTED', desc: 'Network response received' },
  { k: 'settled', label: 'SETTLED', desc: 'Callback accepted, miner paid' },
  { k: 'receipt', label: 'RECEIPT MINTED', desc: 'Answer commitment locked' },
];

export default function HomePage({ wallet }) {
  const [records, setRecords] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [question, setQuestion] = useState('');
  const [intent, setIntent] = useState(INTENTS[0].name);
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // live recent records + metrics
  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    (async () => {
      const [r, m] = await Promise.all([fetchRecentReceipts(6), fetchMetrics()]);
      if (live) { setRecords(r); setMetrics(m); }
    })();
    return () => { live = false; };
  }, []);

  const pollReceipt = useCallback(async (jobId) => {
    // poll the registry up to ~6 min for the callback to mint the receipt
    const { fetchReceipt } = await import('../lib/chain');
    for (let i = 0; i < 48; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const rec = await fetchReceipt(jobId);
        if (rec.resolved) { setPhase('done'); setResult((p) => ({ ...p, resolved: true, receipt: rec })); return; }
      } catch { /* keep polling */ }
    }
  }, []);

  const submit = async () => {
    if (!wallet.account) { wallet.connect(); return; }
    if (!REGISTRY) { setError({ message: 'Registry not deployed yet — VITE_REGISTRY_ADDRESS unset.' }); return; }
    if (!question.trim()) return;
    setError(null); setPhase('approving');
    try {
      const { approveHash, txHash } = await requestVerification({
        question: question.trim(), intent, budgetUsdc: '1000000', account: wallet.account,
      });
      setPhase('miner');
      // find the job id: read the wallet's latest job id from the registry
      const { publicClient, registryAbi } = await import('../lib/chain');
      let jobId = null;
      try {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        const n = await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'jobCount', args: [wallet.account] });
        const last = await publicClient.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'jobsOf', args: [wallet.account, n - 1n] });
        jobId = Number(last);
      } catch { /* fall through — the status line still shows the tx */ }
      setResult({ question: question.trim(), intent, approveHash, txHash, jobId, resolved: false });
      setPhase('waiting');
      pollReceipt(jobId);
    } catch (e) {
      setPhase('error');
      const code = classifyError(e);
      setError({ code, message: errorLabel(code).message, retry: errorLabel(code).retry });
    }
  };

  const stageIndex = phase === 'approving' ? 0 : phase === 'miner' ? 1 : phase === 'waiting' ? 2 : phase === 'done' ? 5 : phase === 'error' ? 0 : -1;
  // (stageIndex intentionally unused — the timeline renders directly from STAGES)

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(40px, 6vw, 72px) 24px 0' }}>
      {/* ---- HERO ---- */}
      <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(40px, 6vw, 64px)', lineHeight: 1.02, letterSpacing: '-0.03em', color: 'var(--ink)', textWrap: 'balance' }}>
          Put a question on the record.
        </h1>
        <p style={{ marginTop: 18, fontSize: 16, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto' }}>
          Ask a factual question. Telegraph runs the job. DOCKET turns the network's response into a permanent, independently checkable receipt.
        </p>
      </div>

      {/* ---- LIVE CREATE-RECORD PANEL ---- */}
      <div className="panel" style={{ marginTop: 36, maxWidth: 860, marginLeft: 'auto', marginRight: 'auto', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span className="label" style={{ fontSize: 11, letterSpacing: '0.22em' }}>PUT A QUESTION ON THE RECORD</span>
          {!wallet.account && <span className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>connect wallet to submit</span>}
        </div>

        <div style={{ padding: '22px 20px' }}>
          {/* question */}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="What was the GDP of India in 2024?"
            style={{
              width: '100%', boxSizing: 'border-box', background: 'var(--bg-2)', color: 'var(--ink)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '12px 14px',
              fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 500, outline: 'none',
              resize: 'vertical', minHeight: 56, transition: 'border-color .18s',
            }}
          />

          {/* intent + budget */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div className="label" style={{ marginBottom: 6 }}>INTENT</div>
              <select
                value={intent} onChange={(e) => setIntent(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12.5, fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer' }}
              >
                {INTENTS.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
              </select>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 5, lineHeight: 1.5, textTransform: 'none', letterSpacing: '0.02em' }}>
                {INTENTS.find((i) => i.name === intent)?.desc}
              </div>
            </div>
            <div style={{ flex: '0 0 160px' }}>
              <div className="label" style={{ marginBottom: 6 }}>BUDGET</div>
              <div style={{ background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '9px 12px', fontSize: 12.5, fontFamily: 'var(--font-mono)' }}>
                $0.25 <span className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>USDC</span>
              </div>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 5 }}>job base price · μ1,000,000</div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button className="act act-solid" style={{ padding: '12px 22px', fontSize: 12 }} onClick={submit} disabled={phase === 'approving' || phase === 'waiting' || !question.trim()}>
              {phase === 'approving' ? 'Approving USDC…' : phase === 'waiting' ? 'Awaiting miner…' : 'Put it on the record →'}
            </button>
            {phase === 'idle' && !wallet.account && (
              <span className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>creates a real ERC-8183 job — testnet USDC only</span>
            )}
            {phase === 'done' && result?.resolved && (
              <a className="act" href={receiptPermalink(result.jobId)} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View receipt {result.jobId} →</a>
            )}
          </div>

          {/* error */}
          {phase === 'error' && error && (
            <div className="panel" style={{ marginTop: 14, padding: '12px 14px', borderColor: 'var(--loss)' }}>
              <span className="label" style={{ color: 'var(--loss)' }}>⚠ {error.message}</span>
              {error.retry && <div className="label" style={{ color: 'var(--faint)', marginTop: 4, fontSize: 9 }}>retry: {error.retry}</div>}
            </div>
          )}

          {/* pending timeline — shows the protocol event traveling */}
          {(phase === 'approving' || phase === 'miner' || phase === 'waiting') && result?.jobId && (
            <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.22em', marginBottom: 14 }}>
                {phase === 'waiting' ? `RECORD #${result.jobId} — TELEGRAPH JOB ACTIVE` : `RECORD — SUBMITTING`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {STAGES.map((s, i) => {
                  const isActive = phase === 'waiting' && i === 2; // awaiting the network response
                  const isPast = phase === 'waiting' ? i < 2 : phase === 'miner' ? i <= 1 : i <= 0;
                  const isDone = phase === 'done';
                  const mark = isDone ? '✓' : isPast ? '✓' : isActive ? '●' : '○';
                  const color = isDone || isPast ? 'var(--gain)' : isActive ? 'var(--signal)' : 'var(--faint)';
                  return (
                    <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
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

        {/* status footer of the panel */}
        {(phase === 'waiting' || phase === 'done') && result?.jobId && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, background: 'var(--surface-2)' }}>
            <Stat label="NETWORK" v="Telegraph" />
            <Stat label="CHAIN" v="Base Sepolia" />
            <Stat label="JOB" v={result.jobId ? `#${result.jobId}` : '—'} href={result.txHash ? explorerTx(result.txHash) : null} />
            <Stat label="TX" v={result.txHash ? `${result.txHash.slice(0, 6)}…${result.txHash.slice(-4)}` : '—'} href={result.txHash ? explorerTx(result.txHash) : null} />
            <Stat label="STATUS" v={result.resolved ? '✓ RESOLVED' : 'AWAITING MINER'} live={!result.resolved} />
          </div>
        )}
        {phase === 'done' && result?.resolved && result?.receipt && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px', background: 'color-mix(in oklch, var(--gain) 6%, transparent)' }}>
            <span className="label" style={{ color: 'var(--gain)', fontSize: 10 }}>✓ RECEIPT #{result.jobId} MINTED — answer commitment locked on-chain</span>
          </div>
        )}
      </div>

      {/* technical line */}
      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <span className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.3em' }}>
          BASE SEPOLIA · TELEGRAPH · ERC-8183
        </span>
      </div>

      {/* ---- RECENT NETWORK RECORDS ---- */}
      <section style={{ marginTop: 64 }}>
        <div className="term-feed-head">
          <span>Network activity <span className="flick" style={{ color: 'var(--signal)' }}>●</span></span>
          <span className="tnum" style={{ color: 'var(--faint)', fontSize: 11 }}>LIVE — RECENT RECORDS</span>
        </div>
        {!records ? (
          <div className="panel" style={{ padding: '28px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--faint)' }}>reading the chain…</span></div>
        ) : records.length === 0 ? (
          <div className="panel" style={{ padding: '28px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--faint)' }}>no records in the recent window</span></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {records.map((r) => (
              <a key={r.jobId} href={receiptPermalink(r.jobId)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 6px', borderBottom: '1px solid var(--line)', textDecoration: 'none', transition: 'background .15s' }}>
                <span className="tnum" style={{ fontSize: 12.5, color: 'var(--ink)', width: 44, flexShrink: 0 }}>#{r.jobId}</span>
                <span className="tnum" style={{ fontSize: 12, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{r.questionHash}</span>
                <span className="label" style={{ color: 'var(--gain)', fontSize: 9 }}>RESOLVED</span>
                <span className="label tnum" style={{ color: 'var(--faint)', fontSize: 9, flexShrink: 0 }}>{new Date(r.createdAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </a>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>Telegraph jobs are routed to real registered miners — every receipt above is a live Base Sepolia read.</span>
        </div>
      </section>

      {/* ---- METRICS ---- */}
      <section style={{ marginTop: 48 }}>
        <div className="term-feed-head"><span>Protocol metrics</span><span className="tnum" style={{ color: 'var(--faint)', fontSize: 11 }}>LIVE CHAIN READS — NO COUNTERS</span></div>
        {!metrics ? (
          <div className="panel" style={{ padding: '24px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--faint)' }}>reading…</span></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Metric k="RECORDS CREATED" v={metrics.records ?? '—'} />
            <Metric k="RECORDS RESOLVED" v={metrics.resolved ?? '—'} />
            <Metric k="ACTIVE WALLETS" v={metrics.wallets ?? '—'} />
            <Metric k="INTENTS USED" v={metrics.intents ?? '—'} />
            <Metric k="JOB VALUE (ESCROWED)" v={metrics.jobValue != null ? `$${(metrics.jobValue / 1e6).toFixed(2)}` : '—'} />
          </div>
        )}
        <div style={{ marginTop: 8 }}><span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>window: latest ~6000 blocks (≈ a few hours) · $ per job = base price 1 USDC</span></div>
      </section>
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

function Metric({ k, v }) {
  return (
    <div className="side-card" style={{ textAlign: 'center', padding: '18px 12px' }}>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 }}>{v}</div>
      <div className="label" style={{ fontSize: 8, color: 'var(--faint)', marginTop: 6, letterSpacing: '0.16em' }}>{k}</div>
    </div>
  );
}
