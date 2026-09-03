import { useState, useEffect } from 'react';
import { useWallet } from './hooks/useWallet';
import { REGISTRY } from './lib/chain';
import AskPanel from './components/AskPanel';
import ReceiptBoard from './components/ReceiptBoard';
import ReceiptView from './components/ReceiptView';
import TrustPage from './components/TrustPage';

// Tiny hash router — no dependency. Routes:
//   #/                 -> ask (hero + panel)
//   #/receipts         -> receipt board
//   #/receipt/:jobId   -> single immutable receipt (permalink target)
//   #/trust            -> "why trust this" page
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts[0] === 'receipt' && parts[1]) return { route: 'receipt', jobId: parts[1] };
  if (parts[0] === 'receipts') return { route: 'receipts' };
  if (parts[0] === 'trust') return { route: 'trust' };
  return { route: 'ask' };
}

export default function App() {
  const wallet = useWallet();
  const [route, setRoute] = useState(() => parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (r) => { window.location.hash = r; };

  const linkCls = (active) =>
    `text-[12px] uppercase tracking-[0.14em] font-mono transition-colors duration-150 ${
      active ? 'text-ink font-semibold' : 'text-faint hover:text-ink'
    }`;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header className="border-b border-line bg-paper/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-8 h-16 flex items-center justify-between">
          <button className="flex items-center gap-3" onClick={() => go('')}>
            <span className="w-2 h-2 rounded-full bg-signal pulse-dot" />
            <span className="font-mono font-semibold text-[15px] tracking-[0.12em] text-ink">DOCKET</span>
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => go('')} className={linkCls(route.route==='ask')}>Ask</button>
            <button onClick={() => go('receipts')} className={linkCls(route.route==='receipts' || route.route==='receipt')}>Receipts</button>
            <button onClick={() => go('trust')} className={linkCls(route.route==='trust')}>Why trust this</button>
          </nav>
          <div>
            {wallet.account ? (
              <button className="btn-pill-ghost !py-2 !px-5 text-xs" onClick={wallet.disconnect}>
                {wallet.account.slice(0,6)}…{wallet.account.slice(-4)}
              </button>
            ) : (
              <button className="btn-pill-primary !py-2 !px-5 text-xs" onClick={wallet.connect} disabled={wallet.status==='connecting'}>
                {wallet.status==='connecting' ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      {route.route === 'receipt' ? (
        <main className="max-w-[1200px] mx-auto px-8 py-16 pb-24">
          <ReceiptView jobId={route.jobId} />
        </main>
      ) : route.route === 'trust' ? (
        <TrustPage />
      ) : (
        <>
          {/* Hero (home + receipts share it) */}
          <section className="max-w-[1200px] mx-auto px-8 pt-20 pb-14">
            <p className="eyebrow mb-4 text-faint">PUT A QUESTION ON THE RECORD</p>
            <h1 className="font-display font-bold text-5xl md:text-6xl leading-[1.05] text-ink max-w-3xl">
              Ask the network.<br />Mint the receipt.
            </h1>
            <p className="mt-6 text-muted text-[15px] max-w-2xl leading-relaxed">
              DOCKET sends your question to Telegraph's top-ranked miners through a real
              on-chain job. The verified answer — the miner, the hash, the block — is written
              on-chain, forever. No screenshots. No files. The protocol itself mints the record.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => go('')} className="btn-pill-primary">Ask a question</button>
              <button onClick={() => go('receipts')} className="btn-pill-ghost">View receipts</button>
            </div>
            {!REGISTRY && (
              <div className="mt-6 inline-flex items-center gap-2 card-dark px-5 py-3 text-sm text-loss">
                ⚠ Registry not yet deployed — the ask flow activates once VITE_REGISTRY_ADDRESS is set.
              </div>
            )}
          </section>

          <main className="max-w-[1200px] mx-auto px-8 pb-24">
            {route.route === 'ask' ? <AskPanel wallet={wallet} /> : <ReceiptBoard wallet={wallet} />}
          </main>
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-signal pulse-dot" />
            <span className="eyebrow text-faint">DOCKET — RECORDS WHAT THE NETWORK RETURNED. NEVER DECLARES TRUTH.</span>
          </div>
          <span className="eyebrow text-faint">BASE SEPOLIA · TELEGRAPH ERC-8183</span>
        </div>
      </footer>
    </div>
  );
}
