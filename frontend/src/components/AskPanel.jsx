import { useState } from 'react';
import { REGISTRY, requestVerification } from '../lib/chain';
import { classifyError, errorLabel } from '../lib/errors';

const INTENTS = [
  'CRYPTO_PRICE', 'WALLET_BALANCE_CHECK', 'GAS_PRICE', 'ONCHAIN_TX_LOOKUP',
  'WEATHER_CHECK', 'WEATHER_FORECAST', 'STORM_ALERT', 'CVE_LOOKUP',
  'URL_SCAN', 'FACT_CHECK', 'NEWS_SEARCH', 'CHAT_COMPLETION',
];

export default function AskPanel({ wallet }) {
  const [question, setQuestion] = useState('');
  const [intent, setIntent] = useState('CRYPTO_PRICE');
  const [budget, setBudget] = useState('1000000'); // 1 USDC (6 decimals) — job price
  const [phase, setPhase] = useState('idle'); // idle | approving | submitting | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!wallet.account) { wallet.connect(); return; }
    if (!REGISTRY) { setError('Registry not deployed yet — ask flow activates once VITE_REGISTRY_ADDRESS is set.'); setPhase('error'); return; }
    if (!question.trim()) return;
    try {
      setPhase('approving'); setError(null);
      const { approveHash, txHash } = await requestVerification({
        question: question.trim(), budgetUsdc: budget || '1000000', account: wallet.account,
      });
      setPhase('done');
      setResult({ question: question.trim(), intent, approveHash, txHash });
    } catch (e) {
      setPhase('error');
      const code = classifyError(e);
      const label = errorLabel(code);
      setError({ code, message: label.message, retry: label.retry });
    }
  };

  const label = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--faint)' };
  const input = {
    width: '100%', background: 'var(--bg-2)', color: 'var(--ink)',
    border: '1px solid var(--line)', borderRadius: 'var(--radius)',
    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-mono)',
    outline: 'none', transition: 'border-color .18s', boxSizing: 'border-box',
  };

  return (
    <div className="panel scan" style={{ padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <div className="label" style={{ color: 'var(--ink)' }}>{'// ask the network'}</div>
          <div className="label" style={{ color: 'var(--faint)', fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
            One real question. One ERC-8183 job on the Telegraph Diamond. The callback that pays the miner writes your receipt — locked.
          </div>
        </div>
        <button className="act act-solid" onClick={submit}
          disabled={phase==='approving'||phase==='submitting'||!question.trim()}>
          {phase==='approving' ? 'Approving USDC…' : phase==='submitting' ? 'Creating job…' : 'Put it on the record'}
        </button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label htmlFor="ask-question" style={{ ...label, display: 'block', marginBottom: 6 }}>QUESTION</label>
          <textarea
            id="ask-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Is this token's contract safe? What is the verified price of X?"
            style={{ ...input, resize: 'vertical', minHeight: 52 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label htmlFor="ask-intent" style={{ ...label, display: 'block', marginBottom: 6 }}>INTENT</label>
            <select id="ask-intent" value={intent} onChange={(e) => setIntent(e.target.value)} style={{ ...input, cursor: 'pointer' }}>
              {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="ask-budget" style={{ ...label, display: 'block', marginBottom: 6 }}>BUDGET (μUSDC)</label>
            <input id="ask-budget" value={budget} onChange={(e) => setBudget(e.target.value)} style={input} />
          </div>
        </div>
        <div className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>
          job price on testnet = 1,000,000 (1 USDC) · escrowed on the diamond, never by docket
        </div>
      </div>

      {phase==='done' && result && (
        <div className="panel" style={{ marginTop: 12, padding: '12px 14px', borderColor: 'var(--gain)' }}>
          <span className="label" style={{ color: 'var(--gain)', wordBreak: 'break-word' }}>
            ✓ job submitted — awaiting miner response
          </span>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="link label" style={{ fontSize: 11 }}>{result.question}</span>
            <span className="link label" style={{ fontSize: 11 }}>intent · {result.intent}</span>
            <span className="link label" style={{ fontSize: 11 }}>createJob ↗ {String(result.txHash).slice(0, 10)}…</span>
          </div>
          <div className="label" style={{ color: 'var(--faint)', fontSize: 9, marginTop: 6 }}>
            the receipt is minted when the protocol resolves the job — track it in the record.
          </div>
        </div>
      )}

      {phase==='error' && error && (
        <div className="panel" style={{ marginTop: 12, padding: '12px 14px', borderColor: 'var(--loss)' }}>
          <span className="label" style={{ color: 'var(--loss)', wordBreak: 'break-word' }}>⚠ {error.message}</span>
          {error.retry && <div className="label" style={{ color: 'var(--faint)', marginTop: 4 }}>retry: {error.retry}</div>}
          {error.code && error.code !== 'UNKNOWN_PROTOCOL_ERROR' && (
            <div className="label" style={{ color: 'var(--faint)', marginTop: 4, fontSize: 9 }}>{error.code}</div>
          )}
        </div>
      )}

      {!wallet.account && (
        <div className="label" style={{ color: 'var(--faint)', marginTop: 12 }}>
          connect your wallet to put a question on the record.
        </div>
      )}
    </div>
  );
}
