import { useState, useEffect } from 'react';
import { REGISTRY, fetchMetrics } from '../lib/chain';

// Usage — live protocol metrics, every number a real chain read.
// No fake counters: this is the complete on-chain history since deployment.

export default function UsagePanel() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    fetchMetrics().then((r) => { if (live) setM(r); }).catch(() => { if (live) setErr('could not read metrics'); });
    return () => { live = false; };
  }, []);

  if (err) {
    return <div className="panel" style={{ padding: '24px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--loss)' }}>⚠ {err}</span></div>;
  }
  if (!m) {
    return <div className="panel" style={{ padding: '24px', textAlign: 'center' }}><span className="label" style={{ color: 'var(--faint)' }}>reading the chain…</span></div>;
  }

  const stats = [
    ['unique wallets', m.wallets ?? '—'],
    ['questions asked', m.records ?? '—'],
    ['receipts minted', m.resolved ?? '—'],
    ['returning users (2+ receipts)', m.returningUsers ?? '—'],
    ['intents used', m.intents ?? '—'],
    ['USDC routed (escrow)', m.jobValue != null ? `$${(m.jobValue / 1e6).toFixed(2)}` : '—'],
  ];

  return (
    <div>
      {/* big stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {stats.map(([k, v]) => (
          <div key={k} className="side-card" style={{ padding: '14px 14px' }}>
            <div className="tnum" style={{ fontSize: 24, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-mono)', lineHeight: 1.1 }}>{v}</div>
            <div className="label" style={{ fontSize: 8, color: 'var(--faint)', marginTop: 5, letterSpacing: '0.12em', lineHeight: 1.5 }}>{k.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* real-demand line */}
      <div className="panel" style={{ marginTop: 12, padding: '14px 18px', borderColor: 'color-mix(in oklch, var(--gain) 40%, var(--line))' }}>
        <span className="label" style={{ fontSize: 11, color: 'var(--gain)', letterSpacing: '0.06em' }}>
          {m.records != null && m.resolved != null
            ? `${m.records} question${m.records === 1 ? '' : 's'} sent → ${m.resolved} resolved → ${m.resolved} real Telegraph jobs, read live from Base Sepolia`
            : 'reading live on-chain usage…'}
        </span>
      </div>

      {/* by intent */}
      {m.byIntent?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="label" style={{ fontSize: 9, color: 'var(--faint)', letterSpacing: '0.2em', marginBottom: 8 }}>USAGE BY INTENT</div>
          <div className="panel" style={{ padding: '6px 16px' }}>
            {m.byIntent.map(({ intent, count }) => (
              <div key={intent} className="stat-row" style={{ padding: '7px 0' }}>
                <span className="stat-k" style={{ fontSize: 11 }}>{intent}</span>
                <span className="stat-v">{count}</span>
              </div>
            ))}
            {m.byIntent.length === 0 && <div className="label" style={{ color: 'var(--faint)', padding: '8px 0' }}>no receipts yet</div>}
          </div>
        </div>
      )}
    </div>
  );
}
