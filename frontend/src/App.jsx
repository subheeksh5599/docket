import { useState, useEffect } from 'react';
import { useWallet } from './hooks/useWallet';
import { REGISTRY } from './lib/chain';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';

// Hash router. Routes:
//   #/                  -> landing (marketing — the first page)
//   #/dashboard[/:tab]  -> the app (sidebar shell)
//   #/r/:id             -> receipt permalink (deep link)
export function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'dashboard') return { route: 'dashboard', tab: parts[1] || 'record' };
  if (parts[0] === 'r' && parts[1]) return { route: 'receipt', jobId: parts[1] };
  if (parts[0] === 'receipt' && parts[1]) return { route: 'receipt', jobId: parts[1] }; // legacy alias
  if (parts[0] === 'receipts') return { route: 'dashboard', tab: 'receipts' };
  if (parts[0] === 'verify') return { route: 'dashboard', tab: 'verify' };
  if (parts[0] === 'how') return { route: 'dashboard', tab: 'how' };
  return { route: 'landing' };
}

const NAV = [
  ['', 'Landing'],
  ['dashboard', 'Dashboard'],
];

export default function App() {
  const wallet = useWallet();
  const [route, setRoute] = useState(() => parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (r) => { window.location.hash = r; };
  const onLanding = route.route === 'landing';
  const active = onLanding ? 'landing' : 'dashboard';

  const isReceipt = route.route === 'receipt';
  const isDashboard = route.route === 'dashboard';

  return (
    <div className="min-h-screen bg-bg text-ink" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ---- HEADER (shared — stays as-is) ---- */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '0 24px', height: 56,
          borderBottom: '1px solid var(--line)',
          background: 'color-mix(in oklch, var(--bg) 85%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <button onClick={() => go('')} className="pixel" style={{ fontSize: 20, letterSpacing: '0.02em', color: 'var(--ink)', background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
            <span className="kol">DOC</span>KET
          </button>
          <span className="label" style={{ fontSize: 9, color: 'var(--signal)', border: '1px solid color-mix(in oklch, var(--signal) 45%, transparent)', borderRadius: 2, padding: '2px 6px' }}>
            TELEGRAPH TESTNET
          </span>
        </div>

        <nav style={{ display: 'flex', gap: 4, margin: '0 auto' }}>
          {NAV.map(([href, label]) => (
            <button
              key={href || 'home'} onClick={() => go(href)}
              className="label"
              style={{
                fontSize: 11, background: 'none', border: 0, cursor: 'pointer', padding: '6px 12px', borderRadius: 'var(--radius)',
                color: active === (href === '' ? 'landing' : href) ? 'var(--ink)' : 'var(--faint)',
                fontWeight: active === (href === '' ? 'landing' : href) ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          {wallet.account ? (
            <button onClick={wallet.disconnect} className="act" style={{ fontSize: 10, padding: '5px 10px' }}>
              {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
            </button>
          ) : (
            <button className="act act-solid" style={{ fontSize: 10, padding: '5px 10px' }} onClick={() => wallet.connect()} disabled={wallet.status === 'connecting'}>
              {wallet.status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* ---- BODY ---- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {onLanding && <LandingPage wallet={wallet} go={go} />}
        {isDashboard && <Dashboard wallet={wallet} tab={route.tab} go={go} />}
        {isReceipt && <Dashboard wallet={wallet} tab="receipt" receiptId={route.jobId} go={go} />}
      </div>

      {/* ---- FOOTER (shared) ---- */}
      <footer style={{ borderTop: '1px solid var(--line)', marginTop: 48 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 32px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'space-between' }}>
            <div style={{ maxWidth: 280 }}>
              <div className="pixel" style={{ fontSize: 16, letterSpacing: '0.02em', color: 'var(--ink)' }}><span className="kol">DOC</span>KET</div>
              <div className="label" style={{ marginTop: 8, fontSize: 9, lineHeight: 1.7 }}>
                Protocol-originated receipts for Telegraph inference.
              </div>
            </div>
            <FooterCol title="Product" links={[['Dashboard', 'dashboard'], ['Receipts', 'dashboard/receipts'], ['Verify', 'dashboard/verify'], ['How it works', 'dashboard/how']]} go={go} />
            <FooterCol title="Network" links={[['Telegraph', 'https://telegraphprotocol.com'], ['Base Sepolia', 'https://sepolia.basescan.org'], ['ERC-8183', 'https://eips.ethereum.org/EIPS/eip-8183']]} go={go} external />
            <div>
              <div className="label" style={{ color: 'var(--faint)', marginBottom: 8 }}>STATUS</div>
              <div className="label" style={{ fontSize: 10 }}><span style={{ color: 'var(--gain)' }}>●</span> Operational</div>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 6 }}>registry live on base sepolia</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 24, paddingTop: 16, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
            <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>
              DOCKET records network responses. It does not establish truth.
            </span>
            <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>
              BASE SEPOLIA · TELEGRAPH · ERC-8183
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links, go, external }) {
  return (
    <div>
      <div className="label" style={{ color: 'var(--faint)', marginBottom: 8 }}>{title.toUpperCase()}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {links.map(([label, href]) => (
          <button
            key={label} onClick={() => (external ? window.open(href, '_blank', 'noopener') : go(href))}
            className="label" style={{ fontSize: 10, background: 'none', border: 0, cursor: 'pointer', padding: 0, textAlign: 'left', color: 'var(--muted)' }}
          >
            {label} {external ? '↗' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
