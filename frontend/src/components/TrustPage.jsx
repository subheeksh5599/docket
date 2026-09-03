import { REGISTRY, DIAMOND, USDC } from '../lib/chain';
import { explorerAddress } from '../lib/evidence';

const SHORT = (s) => (s ? String(s).slice(0, 6) + '…' + String(s).slice(-4) : '—');
const label = { fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--faint)' };

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-7xl px-6" style={{ padding: 'clamp(32px, 5vw, 56px) 24px' }}>
      <div className="term-feed-head" style={{ marginBottom: 20 }}>
        <span>why trust this</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
        <div className="side-card">
          <div className="label" style={{ color: 'var(--ink)', marginBottom: 10 }}>{'// no database'}</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            DOCKET has no backend. Nothing to hack, censor, or quietly edit. Your question is committed to the ReceiptRegistry on Base Sepolia before any miner sees it; the protocol's callback writes the answer commitment in a single transaction, then the receipt is <span style={{ color: 'var(--ink)' }}>locked</span> — the contract has no update function.
          </p>
        </div>

        <div className="side-card">
          <div className="label" style={{ color: 'var(--ink)', marginBottom: 10 }}>{'// an anchor, not an opinion'}</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            The record stores keccak256 commitments of the question and the network's returned answer payload. DOCKET records what the network returned — it never declares what is true. Anyone can re-hash the original payload with the same public rule and confirm the receipt matches, forever.
          </p>
        </div>

        <div className="side-card">
          <div className="label" style={{ color: 'var(--ink)', marginBottom: 10 }}>{'// real miners, real payment'}</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            Every request escrows real testnet USDC into the Telegraph Diamond — the protocol's own escrow; DOCKET never holds funds — and issues an ERC-8183 createJob. The callback that mints your receipt is the same callback that settles the miner.
          </p>
        </div>

        <div className="side-card">
          <div className="label" style={{ color: 'var(--ink)', marginBottom: 10 }}>{'// verifiable without docket'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            <span>· source verified on Blockscout (matches repo)</span>
            <span>· read getReceipt(jobId) from any RPC</span>
            <span>· check getJob(jobId) on the Diamond</span>
            <span>· re-hash the payload — the rule is public</span>
          </div>
        </div>

        <div className="side-card">
          <div className="label" style={{ color: 'var(--loss)', marginBottom: 10 }}>{'// what docket does not claim'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            <span>· answers are not certified true — miners can be wrong, the record preserves that honestly</span>
            <span>· not a wallet, bank, or custodian — escrow is the protocol's payment rail</span>
            <span>· not a court or oracle — it records outcomes</span>
            <span>· questions and receipts are public on-chain data</span>
          </div>
        </div>
      </div>

      {/* anchors */}
      <div className="panel" style={{ padding: '6px 18px' }}>
        <div className="label" style={{ padding: '12px 0 4px' }}>{'// verify the anchors yourself'}</div>
        <Anchor k="receipt registry (verified source)" v={REGISTRY || '— set VITE_REGISTRY_ADDRESS'} href={REGISTRY && explorerAddress(REGISTRY)} />
        <Anchor k="telegraph diamond" v={DIAMOND} href={explorerAddress(DIAMOND)} />
        <Anchor k="usdc (escrow token)" v={USDC} href={explorerAddress(USDC)} />
        <div className="label" style={{ color: 'var(--faint)', fontSize: 9, padding: '6px 0 12px', lineHeight: 1.6 }}>
          registry address injected at build time (VITE_REGISTRY_ADDRESS). diamond + usdc are public protocol constants verified on-chain 2026-09-02 — see docs/TELEGRAPH_DEPLOYMENT.md.
        </div>
      </div>
    </main>
  );
}

function Anchor({ k, v, href }) {
  return (
    <div className="stat-row" style={{ gap: 16 }}>
      <span className="stat-k" style={{ flexShrink: 0, width: 180 }}>{k}</span>
      {href ? (
        <a className="link tnum" style={{ fontSize: 12, wordBreak: 'break-all' }} href={href} target="_blank" rel="noreferrer">{v} ↗</a>
      ) : (
        <span className="stat-v">{v}</span>
      )}
    </div>
  );
}
