import { useEffect } from 'react';
import { REGISTRY } from '../lib/chain';
import RecordPanel from './RecordPanel';
import ReceiptsPage from './ReceiptsPage';
import ReceiptDetail from './ReceiptDetail';
import VerifyPage from './VerifyPage';
import HowItWorks from './HowItWorks';

// Dashboard — the app shell. Persistent left sidebar (DoleAI-style term-left
// rail) for Record / Receipts / Verify / How it works; the main column renders
// the active tab. Header + footer live in App.

const TABS = [
  ['record', 'Record'],
  ['receipts', 'Receipts'],
  ['verify', 'Verify'],
  ['how', 'How it works'],
];

export default function Dashboard({ wallet, tab, receiptId, go }) {
  const activeTab = receiptId ? 'receipt' : tab || 'record';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(20px, 3vw, 36px) 24px 0', flex: 1 }}>
      <div className="term-grid">
        {/* ---- SIDEBAR ---- */}
        <aside className="term-left">
          <div className="term-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="label" style={{ color: 'var(--ink)' }}>{'// docket'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => go(`dashboard/${key}`)}
                  className={`filter-pill ${activeTab === key ? 'filter-on' : ''}`}
                  style={{ textAlign: 'left' }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="label" style={{ color: 'var(--faint)', fontSize: 9, lineHeight: 1.6, marginTop: 8 }}>
              Real Telegraph jobs, read live from Base Sepolia. Nothing here is simulated.
            </div>
          </div>
        </aside>

        {/* ---- MAIN ---- */}
        <div style={{ minWidth: 0 }}>
          {activeTab === 'record' && <RecordPanel wallet={wallet} go={go} />}
          {activeTab === 'receipts' && <ReceiptsPage wallet={wallet} go={go} />}
          {activeTab === 'verify' && <VerifyPage />}
          {activeTab === 'how' && <HowItWorks />}
          {activeTab === 'receipt' && receiptId && <ReceiptDetail jobId={receiptId} go={go} />}
        </div>
      </div>
    </div>
  );
}
