import { useEffect, useState } from 'react';
import { REGISTRY, DIAMOND, publicClient, diamondAbi } from '../lib/chain';
import { explorerAddress } from '../lib/evidence';
import RecordPanel from './RecordPanel';
import ReceiptsPage from './ReceiptsPage';
import ReceiptDetail from './ReceiptDetail';
import VerifyPage from './VerifyPage';

// Dashboard — the app shell. Persistent left sidebar for Record / Receipts /
// Verify; the main column renders the active tab. Header + footer live in App.

const TABS = [
  ['record', 'Record'],
  ['receipts', 'Receipts'],
  ['verify', 'Verify'],
];

export default function Dashboard({ wallet, tab, receiptId, go }) {
  const isReceiptMode = !!receiptId;
  const activeTab = isReceiptMode ? null : (tab || 'record');
  const [pulse, setPulse] = useState(null);

  // live network reads for the sidebar's status block
  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    (async () => {
      const out = {};
      try {
        out.escrow = Number(await publicClient.readContract({ address: DIAMOND, abi: diamondAbi, functionName: 'escrowBalance', args: [REGISTRY] }));
      } catch { /* optional */ }
      try {
        out.base = Number(await publicClient.readContract({ address: DIAMOND, abi: diamondAbi, functionName: 'getJobBasePrice' }));
      } catch { /* optional */ }
      if (live) setPulse(out);
    })();
    return () => { live = false; };
  }, []);

  return (
    <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: 'clamp(20px, 3vw, 36px) 24px 0', flex: 1 }}>
      <div className="term-grid">
        {/* ---- SIDEBAR ---- */}
        <aside className="term-left">
          <div className="term-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* brand + live status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
              <span className="flick" style={{ color: 'var(--signal)', fontSize: 11 }}>●</span>
              <span className="label" style={{ fontSize: 10, color: 'var(--ink)', letterSpacing: '0.2em' }}>DOCKET TERMINAL</span>
            </div>

            {/* nav */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TABS.map(([key, label]) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => go(`dashboard/${key}`)}
                    className="label"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 11, letterSpacing: '0.12em', textAlign: 'left',
                      background: isActive ? 'var(--ink)' : 'transparent',
                      color: isActive ? 'var(--bg)' : 'var(--muted)',
                      border: '1px solid ' + (isActive ? 'var(--ink)' : 'var(--line)'),
                      borderRadius: 'var(--radius)', padding: '9px 12px', cursor: 'pointer',
                      transition: 'color .15s, border-color .15s, background .15s',
                    }}
                  >
                    <span style={{ color: isActive ? 'var(--signal)' : 'var(--faint)', fontSize: 12, width: 14, flexShrink: 0 }}>
                      {key === 'record' ? '⌗' : key === 'receipts' ? '▤' : '✓'}
                    </span>
                    {label}
                  </button>
                );
              })}
            </nav>

            {/* network status card — real reads */}
            <div className="side-card" style={{ padding: '12px 14px', marginTop: 4 }}>
              <div className="label" style={{ marginBottom: 8, fontSize: 9 }}>{'// network'}</div>
              <div className="stat-row" style={{ padding: '3px 0' }}>
                <span className="stat-k" style={{ fontSize: 9 }}>chain</span>
                <span className="stat-v" style={{ fontSize: 11 }}>base sepolia</span>
              </div>
              <div className="stat-row" style={{ padding: '3px 0' }}>
                <span className="stat-k" style={{ fontSize: 9 }}>registry escrow</span>
                <span className="stat-v" style={{ fontSize: 11, color: pulse ? 'var(--gain)' : 'var(--faint)' }}>
                  {pulse?.escrow != null ? `$${(pulse.escrow / 1e6).toFixed(2)}` : '…'}
                </span>
              </div>
              <div className="stat-row" style={{ padding: '3px 0' }}>
                <span className="stat-k" style={{ fontSize: 9 }}>job price</span>
                <span className="stat-v" style={{ fontSize: 11 }}>{pulse?.base != null ? `$${(pulse.base / 1e6).toFixed(2)}` : '…'}</span>
              </div>
              {REGISTRY && (
                <a href={explorerAddress(REGISTRY)} target="_blank" rel="noreferrer" className="label" style={{ display: 'block', marginTop: 8, fontSize: 9, color: 'var(--faint)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  registry {REGISTRY.slice(0, 6)}…{REGISTRY.slice(-4)} ↗
                </a>
              )}
            </div>

            <div className="label" style={{ color: 'var(--faint)', fontSize: 8, lineHeight: 1.7, letterSpacing: '0.04em' }}>
              live reads from Base Sepolia. nothing here is simulated.
            </div>
          </div>
        </aside>

        {/* ---- MAIN ---- */}
        <div style={{ minWidth: 0 }}>
          {isReceiptMode && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => go('dashboard/receipts')} className="label" style={{ fontSize: 10, background: 'none', border: 0, cursor: 'pointer', padding: 0, color: 'var(--faint)', letterSpacing: '0.12em' }}>
                ← Receipts
              </button>
            </div>
          )}
          {isReceiptMode
            ? <ReceiptDetail jobId={receiptId} go={go} />
            : activeTab === 'verify'
              ? <VerifyPage />
              : activeTab === 'receipts'
                ? <ReceiptsPage wallet={wallet} go={go} />
                : <RecordPanel wallet={wallet} go={go} />}
        </div>
      </div>
    </div>
  );
}
