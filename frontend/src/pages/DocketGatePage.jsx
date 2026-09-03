import { useState } from 'react';

const REGISTRY = '0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48';
const REGISTRY_URL = `https://sepolia.basescan.org/address/${REGISTRY}`;
// LIVE consumer demo — a real deployed gate that verified receipt #28 on-chain.
const GATE = '0xEaA18eE192D59d4D20Ff40907465a3cF9eD6a4ce';
const GATE_URL = `https://sepolia.basescan.org/address/${GATE}`;
const GATE_TX = '0xebcaeba17b0e73a46da93375b859aa09f328b894066006a5f01e8c5da0c269ad';
const GATE_TX_URL = `https://sepolia.basescan.org/tx/${GATE_TX}`;

const FLOW = [
  ['1', 'A Telegraph job resolves', 'the network returns a response; the escrow pays the resolver through the Diamond'],
  ['2', 'DOCKET mints the receipt', 'ReceiptRegistry locks questionHash + answerHash + intent + resolver + timestamp — immutable'],
  ['3', 'A contract checks the receipt', 'DocketGate reads the registry: exists? locked? resolved? right intent? answer accepted?'],
  ['4', 'Only then the action unlocks', 'every check must pass — one wrong hash, wrong intent, or missing receipt and the action reverts'],
];

const SOLIDITY_SNIPPET = `// A consumer contract can REQUIRE a DOCKET receipt before acting.
// DocketGate.sol — real semantics, quoted from this repo's contract.

function executeGated(uint256 jobId, bytes32 acceptedAnswer) external {
    if (actionExecuted) revert ActionAlreadyExecuted();

    Receipt memory r = registry.getReceipt(jobId);  // reverts if no receipt

    if (!registry.locked(jobId))  revert ReceiptNotLocked(jobId);
    if (!r.resolved)              revert ReceiptNotResolved(jobId);
    if (r.intentId != requiredIntent) revert WrongIntent(jobId);
    if (r.answerHash != acceptedAnswer) revert AnswerNotAccepted(r.answerHash);

    actionExecuted = true;        // single-use gate
    emit ActionGated(jobId, r.intentId, r.answerHash, msg.sender);
}`;

const CHECKS = [
  'receipt exists on the registry',
  'receipt is locked (immutable)',
  'receipt is resolved (network answered)',
  'intent matches what this gate requires',
  'answer commitment matches what the gate accepts',
];

export default function DocketGatePage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="page-inner">
      <h2 className="h2" style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        Act on a receipt
        <span className="label" style={{ color: 'var(--gain)' }}>COMPOSABLE EVIDENCE</span>
      </h2>
      <p className="sub" style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
        Telegraph answer → DOCKET receipt → a smart contract checks the receipt → only then the action unlocks.
        DOCKET is not a receipt viewer — it is a <b style={{ color: 'var(--ink)' }}>machine-consumable evidence primitive</b>.
      </p>

      {/* flow */}
      <div className="term-feed-head" style={{ marginTop: 26 }}>
        <span>HOW A CONTRACT CONSUMES A RECEIPT</span>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {FLOW.map(([n, t, d]) => (
          <div key={n} className="panel" style={{ padding: '12px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--signal)', minWidth: 18 }}>{n}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.6 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

      {/* the checks a receipt must pass */}
      <div className="term-feed-head" style={{ marginTop: 26 }}>
        <span>WHAT THE GATE CHECKS — EVERY ONE IS AN ON-CHAIN READ</span>
      </div>
      <div className="panel" style={{ marginTop: 12, padding: '16px 20px' }}>
        {CHECKS.map((c) => (
          <div key={c} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid color-mix(in oklch, var(--line) 60%, transparent)' }}>
            <span style={{ color: 'var(--gain)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>✓</span>
            <span style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{c}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
          <span style={{ color: 'var(--signal)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>→</span>
          <span style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>action executes (single-use — can never fire twice)</span>
        </div>
      </div>

      {/* LIVE — this actually ran on Base Sepolia */}
      <div className="panel" style={{ marginTop: 16, padding: '14px 20px', borderColor: 'color-mix(in oklch, var(--gain) 55%, var(--line))' }}>
        <div className="label" style={{ color: 'var(--gain)', fontSize: 9, letterSpacing: '0.18em', marginBottom: 8 }}>
          ● LIVE — A DEPLOYED GATE ALREADY ACTED ON A REAL RECEIPT
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            ['gate', GATE.slice(0, 6) + '…' + GATE.slice(-4), GATE_URL],
            ['checked receipt', '#28 (CRYPTO_PRICE, resolved + locked)', null],
            ['action tx', GATE_TX.slice(0, 6) + '…' + GATE_TX.slice(-4), GATE_TX_URL],
          ].map(([k, v, href]) => (
            <div key={k}>
              <div className="label" style={{ fontSize: 8, color: 'var(--faint)' }}>{k.toUpperCase()}</div>
              <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--ink)', marginTop: 3 }}>
                {href ? <a href={href} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>{v} ↗</a> : v}
              </div>
            </div>
          ))}
        </div>
        <div className="label" style={{ fontSize: 9, color: 'var(--faint)', lineHeight: 1.7, textTransform: 'none', letterSpacing: '0.02em', marginTop: 8 }}>
          `executeGated(28, 0x23d1c6ef…)` ran on-chain — the gate read receipt #28 from the registry, every check passed, and the
          action fired (event `ActionGated`). A second call reverted with `ActionAlreadyExecuted`: a receipt unlocks an action exactly once.
        </div>
      </div>

      {/* the contract — real code */}
      <div className="term-feed-head" style={{ marginTop: 26 }}>
        <span>THE GATE — REAL SOLIDITY FROM THIS REPO</span>
        <button className="act" style={{ fontSize: 10 }} onClick={() => setOpen(!open)}>{open ? 'hide code' : 'show code'}</button>
      </div>
      {open && (
        <pre style={{
          margin: '12px 0 0', padding: '14px 16px', background: 'var(--surface-2)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'auto',
          fontSize: 11.5, lineHeight: 1.65, fontFamily: 'var(--font-mono)', color: 'var(--ink)', whiteSpace: 'pre',
        }}>
{SOLIDITY_SNIPPET}
        </pre>
      )}
      {!open && (
        <p className="label" style={{ marginTop: 10, color: 'var(--faint)', fontSize: 9 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setOpen(true); }} style={{ color: 'var(--signal)' }}>show the Solidity</a> — or read the full source: <a href="https://github.com/subheeksh5599/docket/blob/main/src/DocketGate.sol" style={{ color: 'var(--signal)' }} target="_blank" rel="noreferrer">DocketGate.sol</a>
        </p>
      )}

      {/* why it matters */}
      <div className="panel" style={{ marginTop: 26, padding: '16px 20px', borderColor: 'color-mix(in oklch, var(--signal) 45%, var(--line))' }}>
        <div className="label" style={{ color: 'var(--signal)', fontSize: 9, letterSpacing: '0.18em', marginBottom: 8 }}>WHY THIS MATTERS</div>
        <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.8, margin: 0 }}>
          A receipt is not just something a human reads — <b>another contract can require it</b>.
          Autonomous agents and protocols can refuse to act unless the Telegraph network's
          response for a given job is on the record: locked, resolved, correct intent,
          matching commitment. The gate never declares what is true; it acts on the fact
          that the network returned a response and DOCKET recorded it immutably.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <a className="act" href="#/dashboard/receipts" style={{ textDecoration: 'none', display: 'inline-block' }}>← Receipts</a>
        <a className="act-solid" href={GATE_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Live gate on BaseScan ↗
        </a>
        <a className="act" href={REGISTRY_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ReceiptRegistry ↗
        </a>
      </div>
    </div>
  );
}
