import { useState } from 'react';
import { useWallet } from './hooks/useWallet';
import { REGISTRY } from './lib/chain';
import AskPanel from './components/AskPanel';
import ReceiptBoard from './components/ReceiptBoard';

export default function App() {
  const wallet = useWallet();
  const [view, setView] = useState('ask'); // ask | receipts

  return (
    <div className="min-h-screen bg-obsidian-shell text-pure-white">
      {/* Nav */}
      <header className="border-b hairline">
        <div className="max-w-[1200px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-neon-pulse pulse-dot" />
            <span className="font-aeonikfono text-[15px] tracking-wide text-pure-white">DOCKET</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-[15px] text-pure-white/80">
            <button onClick={() => setView('ask')} className={`${view==='ask' ? 'text-neon-pulse' : 'hover:text-pure-white'}`}>Ask</button>
            <button onClick={() => setView('receipts')} className={`${view==='receipts' ? 'text-neon-pulse' : 'hover:text-pure-white'}`}>Receipts</button>
          </nav>
          <div>
            {wallet.account ? (
              <button className="btn-pill-ghost !py-2 !px-5 text-sm" onClick={wallet.disconnect}>
                {wallet.account.slice(0,6)}…{wallet.account.slice(-4)}
              </button>
            ) : (
              <button className="btn-pill-primary !py-2 !px-5 text-sm" onClick={wallet.connect} disabled={wallet.status==='connecting'}>
                {wallet.status==='connecting' ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-8 pt-20 pb-16">
        <p className="eyebrow text-neon-pulse mb-4">PUT A QUESTION ON THE RECORD</p>
        <h1 className="font-aeonikfono font-medium text-5xl md:text-6xl leading-[1.1] text-pure-white max-w-3xl">
          Ask the network. Mint the receipt.
        </h1>
        <p className="mt-6 text-pure-white/70 text-lg max-w-2xl leading-relaxed">
          DOCKET sends your question to Telegraph's top-ranked miners through a real
          on-chain job. The verified answer — the miner, the hash, the block — is written
          on-chain, forever. No screenshots. No files. The protocol itself mints the record.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button onClick={() => setView('ask')} className="btn-pill-primary">Ask a question</button>
          <button onClick={() => setView('receipts')} className="btn-pill-ghost">View receipts</button>
        </div>
        {!REGISTRY && (
          <div className="mt-6 inline-flex items-center gap-2 card-dark px-5 py-3 text-sm text-signal-yellow">
            ⚠ Registry not yet deployed — the ask flow activates once VITE_REGISTRY_ADDRESS is set.
          </div>
        )}
      </section>

      {/* Main content — ask panel or receipt board */}
      <main className="max-w-[1200px] mx-auto px-8 pb-24">
        {view === 'ask' ? <AskPanel wallet={wallet} /> : <ReceiptBoard wallet={wallet} />}
      </main>

      {/* Footer */}
      <footer className="border-t hairline">
        <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-pulse pulse-dot" />
            <span className="eyebrow text-pure-white/50">DOCKET — RECORDS WHAT THE NETWORK RETURNED. NEVER DECLARES TRUTH.</span>
          </div>
          <span className="eyebrow text-pure-white/30">BASE SEPOLIA · TELEGRAPH ERC-8183</span>
        </div>
      </footer>
    </div>
  );
}
