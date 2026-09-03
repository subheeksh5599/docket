import { useState, useEffect } from 'react';
import { useWallet } from './hooks/useWallet';
import { REGISTRY, DIAMOND, USDC, fetchReceipt, publicClient } from './lib/chain';
import AskPanel from './components/AskPanel';
import ReceiptFeed from './components/ReceiptFeed';
import ReceiptView from './components/ReceiptView';
import TrustPage from './components/TrustPage';
import SideStats from './components/SideStats';

// Tiny hash router — no dependency. Routes:
//   #/                 -> dashboard (left rail / ask+feed / right stats)
//   #/receipts         -> receipt feed (main column)
//   #/receipt/:jobId   -> single immutable receipt (permalink target)
//   #/trust            -> "why trust this" page
export function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'receipt' && parts[1]) return { route: 'receipt', jobId: parts[1] };
  if (parts[0] === 'receipts') return { route: 'receipts' };
  if (parts[0] === 'trust') return { route: 'trust' };
  return { route: 'ask' };
}

const NAV = [
  ['', 'Dashboard'],
  ['receipts', 'The record'],
  ['trust', 'Why trust this'],
];

export default function App() {
  const wallet = useWallet();
  const [route, setRoute] = useState(() => parseHash());
  const [liveCount, setLiveCount] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // live receipt-count read for the left rail
  useEffect(() => {
    if (!REGISTRY) return;
    let live = true;
    (async () => {
      try {
        const n = await publicClient.readContract({ address: REGISTRY, abi: [], functionName: 'jobCount' });
        if (live) setLiveCount(Number(n));
      } catch { /* rail shows — when offline */ }
    })();
    return () => { live = false; };
  }, [wallet.account]);

  const go = (r) => { window.location.hash = r; };
  const activeRoute = route.route === 'receipt' ? 'receipts' : route.route;

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* ambient dither field behind everything */}
      <div aria-hidden className="app-dither" />

      {/* ---- HEADER ---- */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
          padding: '10px 24px',
          borderBottom: '1px solid var(--line)',
          background: 'color-mix(in oklch, var(--bg) 82%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button onClick={() => go('')} className="pixel" style={{ fontSize: 22, letterSpacing: '0.03em', color: 'var(--ink)', marginRight: 8, background: 'none', border: 0, cursor: 'pointer' }}>
          <span className="kol">DOC</span>KET
        </button>
        <nav style={{ display: 'flex', gap: 20 }}>
          {NAV.map(([href, label]) => (
            <button key={href || 'home'} onClick={() => go(href)} className="link label" style={{ fontSize: 11, background: 'none', border: 0, cursor: 'pointer', color: activeRoute === (href || 'ask' === '' ? 'ask' : href) ? 'var(--ink)' : 'inherit' }}>
              {label}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="label" style={{ color: 'var(--loss)', fontSize: 10 }}>
            ● base sepolia 84532
          </span>
          {wallet.account ? (
            <button onClick={wallet.disconnect} style={btnGhost}>
              {wallet.account.slice(0,6)}…{wallet.account.slice(-4)}
            </button>
          ) : (
            <button style={btnPrimary} onClick={() => wallet.connect()} disabled={wallet.status==='connecting'}>
              {wallet.status==='connecting' ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </header>

      {/* ---- BODY ---- */}
      {route.route === 'receipt' ? (
        <main className="mx-auto max-w-7xl px-6" style={{ padding: 'clamp(32px, 5vw, 56px) 24px' }}>
          <ReceiptView jobId={route.jobId} />
        </main>
      ) : route.route === 'trust' ? (
        <TrustPage />
      ) : (
        <main className="mx-auto max-w-7xl px-6" style={{ padding: 'clamp(32px, 5vw, 56px) 24px' }}>
          <div className="term-grid">
            {/* ---- LEFT RAIL ---- */}
            <aside className="term-left">
              <div className="term-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="label" style={{ color: 'var(--ink)' }}>{'// docket terminal'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {NAV.map(([href, label]) => (
                    <button key={href || 'home'} onClick={() => go(href)} className={`filter-pill ${activeRoute === (href === '' ? 'ask' : href) ? 'filter-on' : ''}`} style={{ textAlign: 'left' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="label" style={{ color: 'var(--faint)', fontSize: 9, lineHeight: 1.6, marginTop: 8 }}>
                  Real Telegraph miner answers are written on-chain by the protocol's own callback, then locked. Every receipt here is a live Base Sepolia read.
                </div>
              </div>
            </aside>

            {/* ---- MAIN ---- */}
            <div>
              <div className="term-feed-head">
                <span>
                  {route.route === 'ask' ? 'ask the network' : 'the record'}{' '}
                  <span className="flick" style={{ color: 'var(--signal)' }}>●</span>
                </span>
                <span className="tnum" style={{ color: 'var(--faint)', fontSize: 11 }}>
                  {liveCount !== null ? `${liveCount} jobs on-chain` : ''}
                </span>
              </div>

              {route.route === 'ask' ? <AskPanel wallet={wallet} /> : <ReceiptFeed wallet={wallet} />}
            </div>

            {/* ---- RIGHT RAIL ---- */}
            <aside className="term-right">
              <SideStats wallet={wallet} />
            </aside>
          </div>
        </main>
      )}

      {/* ---- FOOTER ---- */}
      <footer style={{ borderTop: '1px solid var(--line)', marginTop: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>
            DOCKET records what the network returned. It never declares truth.
          </span>
          <span className="label" style={{ color: 'var(--faint)', fontSize: 9 }}>
            base sepolia · telegraph erc-8183
          </span>
        </div>
      </footer>
    </div>
  );
}

const btnBase = {
  fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
  border: '1px solid var(--line-strong)', borderRadius: 'var(--radius)', padding: '6px 12px',
  background: 'transparent', color: 'var(--muted)', cursor: 'pointer',
  transition: 'color .2s, border-color .2s, background .2s',
};
const btnGhost = { ...btnBase };
const btnPrimary = { ...btnBase, background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)' };
