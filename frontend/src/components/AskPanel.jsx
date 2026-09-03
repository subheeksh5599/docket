import { useState } from 'react';
import { REGISTRY, requestVerification } from '../lib/chain';
import { classifyError, errorLabel } from '../lib/errors';

const INTENTS = [
  'CRYPTO_PRICE', 'WALLET_BALANCE_CHECK', 'GAS_PRICE', 'ONCHAIN_TX_LOOKUP',
  'WEATHER_CHECK', 'WEATHER_FORECAST', 'STORM_ALERT', 'CVE_LOOKUP',
  'URL_SCAN', 'FACT_CHECK', 'NEWS_SEARCH', 'CHAT_COMPLETION',
];

const inputCls =
  'w-full bg-paper-2 text-ink border border-line rounded-[3px] p-3.5 text-sm font-mono ' +
  'placeholder:text-faint focus:outline-none focus:border-ink transition-colors resize-none';
const labelCls = 'eyebrow block mb-2 text-faint';

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

  return (
    <div className="card-dark p-8">
      <p className="eyebrow text-faint mb-2">NEW RECORD</p>
      <h2 className="font-display text-2xl font-bold text-ink mb-6">Ask the network</h2>

      <div className="space-y-5">
        <div>
          <label htmlFor="ask-question" className={labelCls}>QUESTION</label>
          <textarea
            id="ask-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Is this token's contract safe? What is the verified price of X?"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="ask-intent" className={labelCls}>INTENT</label>
            <select id="ask-intent" value={intent} onChange={(e) => setIntent(e.target.value)} className={inputCls + ' cursor-pointer'}>
              {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ask-budget" className={labelCls}>BUDGET (μUSDC)</label>
            <input id="ask-budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputCls} />
            <p className="text-xs text-faint mt-1">Job price on testnet = 1,000,000 (1 USDC). Escrowed on the Diamond.</p>
          </div>
        </div>
        <button className="btn-pill-primary w-full md:w-auto" onClick={submit}
          disabled={phase==='approving'||phase==='submitting'||!question.trim()}>
          {phase==='approving' ? 'Approving USDC…' : phase==='submitting' ? 'Creating job…' : 'Put it on the record'}
        </button>
      </div>

      {phase==='done' && result && (
        <div className="mt-6 card-white p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-signal pulse-dot" />
            <span className="eyebrow text-gain">JOB SUBMITTED — AWAITING MINER RESPONSE</span>
          </div>
          <p className="text-ink font-semibold">{result.question}</p>
          <p className="text-sm text-muted mt-1">Intent: {result.intent}</p>
          <div className="mt-4 space-y-1 font-mono text-xs text-muted break-all">
            <p>approve: {result.approveHash}</p>
            <p>createJob: {result.txHash}</p>
          </div>
          <p className="mt-3 text-xs text-faint">The receipt is minted when the protocol resolves the job through the callback. Track it in the Receipts view.</p>
        </div>
      )}

      {phase==='error' && error && (
        <div className="mt-6 card-dark border border-loss/30 p-5 text-sm">
          <p className="text-loss font-medium">{error.message}</p>
          {error.retry && <p className="text-muted mt-1">Retry: {error.retry}</p>}
          {error.code && error.code !== 'UNKNOWN_PROTOCOL_ERROR' && (
            <p className="text-faint mt-2 font-mono text-xs">{error.code}</p>
          )}
        </div>
      )}

      {!wallet.account && (
        <p className="mt-6 text-sm text-muted">Connect your wallet to put a question on the record.</p>
      )}
    </div>
  );
}
