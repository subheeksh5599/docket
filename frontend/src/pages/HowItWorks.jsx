import { REGISTRY, DIAMOND, USDC } from '../lib/chain';
import { explorerAddress } from '../lib/evidence';

// How it works — the actual architecture, not three marketing cards.
// DOCKET is an application layer over Telegraph's real infrastructure.

const FLOW = [
  ['USER', 'Asks a question + funds escrow in the DOCKET app.'],
  ['DOCKET', 'Frontend only — no backend. Writes two transactions: approve USDC, then requestVerification on the registry.'],
  ['ERC-8183 JOB', 'The registry escrows USDC into the Telegraph Diamond and calls createJob — a standard Telegraph job.'],
  ['TELEGRAPH', 'Routes the job to a real registered miner (the protocol\'s own network — DOCKET is not Telegraph).'],
  ['MINER', 'A real registered miner resolves the job and submits the response.'],
  ['SETTLEMENT', 'The protocol verifies the submission and settles the miner\'s payment from escrow.'],
  ['CALLBACK', 'The same callback that pays the miner calls back into the ReceiptRegistry with the answer commitment.'],
  ['RECEIPT REGISTRY', 'A DOCKET smart contract on Base Sepolia. It verifies the caller is the Diamond, then writes the receipt.'],
  ['IMMUTABLE RECEIPT', 'One write. Locked forever. No update function exists in the bytecode.'],
];

const STEPS = [
  { n: '01', title: 'You ask', d: 'A factual question, an intent, and 1 USDC escrow (testnet).' },
  { n: '02', title: 'A real job', d: 'The registry issues an ERC-8183 createJob on the Telegraph Diamond.' },
  { n: '03', title: 'A real miner', d: 'Telegraph routes the job to a registered miner, who resolves it.' },
  { n: '04', title: 'One callback', d: 'The payment callback writes the answer commitment to the registry.' },
  { n: '05', title: 'Locked', d: 'The receipt is immutable — provable from any RPC, forever.' },
];

export default function HowItWorks() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(40px, 6vw, 64px) 24px 0' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', color: 'var(--ink)' }}>How it works</h1>
      <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)', maxWidth: 640, lineHeight: 1.7 }}>
        DOCKET is not pretending to be Telegraph. It is an application layer around Telegraph's real
        infrastructure — the receipt is minted by the protocol's own payment callback.
      </p>

      {/* architecture flow */}
      <div className="panel" style={{ marginTop: 26, padding: '26px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
          {FLOW.map(([node, desc], i) => (
            <div key={node}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  background: i === 8 ? 'var(--signal)' : 'var(--ink)',
                  color: i === 8 ? 'var(--dark)' : 'var(--bg)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                  padding: '8px 14px', borderRadius: 'var(--radius)', whiteSpace: 'nowrap',
                }}>
                  {node}
                </div>
                <span style={{ flex: 1, color: 'var(--faint)', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.5 }}>
                  {desc}
                </span>
              </div>
              {i < FLOW.length - 1 && (
                <div style={{ padding: '4px 0 4px 18px' }}>
                  <span style={{ color: 'var(--line-strong)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>│</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* one-line steps */}
      <div style={{ marginTop: 40 }}>
        <div className="term-feed-head"><span>The lifecycle</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {STEPS.map((s) => (
            <div key={s.n} className="side-card" style={{ padding: '16px 14px' }}>
              <div className="tnum" style={{ fontSize: 12, color: 'var(--signal)', fontFamily: 'var(--font-mono)' }}>{s.n}</div>
              <div className="label" style={{ color: 'var(--ink)', fontSize: 11, marginTop: 6, letterSpacing: '0.12em' }}>{s.title}</div>
              <div className="label" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 6, lineHeight: 1.6, textTransform: 'none', letterSpacing: '0.02em' }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* anchors */}
      <div className="panel" style={{ marginTop: 40, padding: '8px 22px 14px' }}>
        <div className="label" style={{ padding: '12px 0 4px', fontSize: 9, letterSpacing: '0.22em' }}>ON-CHAIN ANCHORS</div>
        {[
          ['Receipt Registry', REGISTRY],
          ['Telegraph Diamond', DIAMOND],
          ['USDC (escrow)', USDC],
        ].map(([k, addr]) => (
          <div key={k} className="stat-row">
            <span className="stat-k" style={{ width: 170, flexShrink: 0 }}>{k}</span>
            <a className="link tnum" style={{ fontSize: 12 }} href={addr && explorerAddress(addr)} target="_blank" rel="noreferrer">
              {addr || '— set VITE_REGISTRY_ADDRESS'} · view on explorer ↗
            </a>
          </div>
        ))}
        <div className="label" style={{ fontSize: 9, color: 'var(--faint)', padding: '8px 0 4px', lineHeight: 1.6 }}>
          diamond + usdc are protocol constants, verified on-chain. registry source is verified on Blockscout.
        </div>
      </div>
    </div>
  );
}
