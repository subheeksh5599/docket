// DOCKET — receipt evidence helpers: machine-readable JSON, share permalink,
// explorer links, and verification summary. No mocks: everything derives from
// the on-chain receipt object or the tx hashes the wallet/user supplies.

export const EXPLORER = 'https://sepolia.basescan.org';

export function receiptToEvidence(receipt) {
  // receipt: { jobId, intentId, questionHash, answerHash, createdAt, resolved }
  return {
    schema: 'docket/receipt/v1',
    jobId: String(receipt.jobId ?? ''),
    intentId: String(receipt.intentId ?? ''),
    questionHash: String(receipt.questionHash ?? ''),
    answerHash: String(receipt.answerHash ?? ''),
    createdAt: receipt.createdAt ? Number(receipt.createdAt) : null,
    resolved: Boolean(receipt.resolved),
    registry: String(receipt.registry ?? ''),
    chainId: 84532,
    network: 'base-sepolia',
    explorer: {
      receipt: receipt.jobId ? `${EXPLORER}/tx/${receipt.jobId}` : null,
      registry: receipt.registry ? `${EXPLORER}/address/${receipt.registry}` : null,
    },
    verified: {
      // filled by the verify step; not a claim until checks run
      checks: receipt._checks || null,
      pass: receipt._pass ?? null,
    },
  };
}

export function evidenceToJson(evidence) {
  return JSON.stringify(evidence, null, 2);
}

export function downloadEvidence(evidence, jobId) {
  const blob = new Blob([evidenceToJson(evidence) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `docket-receipt-${jobId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Evidence bundle: .json (machine) + .txt (human) + .sha256 (artifact hash).
// The .sha256 lets a holder prove the artifact wasn't altered after export.
export function evidenceToTxt(evidence) {
  const L = [];
  L.push('DOCKET RECEIPT — docket.receipt.v1');
  L.push('='.repeat(44));
  L.push(`jobId:          ${evidence.jobId}`);
  L.push(`intentId:       ${evidence.intentId}`);
  L.push(`questionHash:   ${evidence.questionHash}`);
  L.push(`answerHash:     ${evidence.answerHash}`);
  L.push(`createdAt:      ${evidence.createdAt ? new Date(evidence.createdAt * 1000).toISOString() : '—'} (${evidence.createdAt})`);
  L.push(`resolved:       ${evidence.resolved}`);
  L.push(`registry:       ${evidence.registry}`);
  L.push(`chain:          Base Sepolia (${evidence.chainId})`);
  L.push('');
  L.push('Verify without DOCKET:');
  L.push(`  cast call ${evidence.registry} \\`);
  L.push(`    "getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)" ${evidence.jobId} \\`);
  L.push(`    --rpc-url https://sepolia.base.org`);
  if (evidence.verified?.pass) {
    L.push('');
    L.push('Verification: PASS (checked against chain)');
  }
  return L.join('\n') + '\n';
}

export function downloadEvidenceBundle(evidence, jobId) {
  const json = evidenceToJson(evidence) + '\n';
  const txt = evidenceToTxt(evidence);
  // compute sha256 of the canonical JSON (Web Crypto — no deps)
  const enc = new TextEncoder();
  crypto.subtle.digest('SHA-256', enc.encode(json)).then((buf) => {
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const sha = `sha256:${hex}  docket-receipt-${jobId}.json\n`;
    saveBlob(new Blob([json], { type: 'application/json' }), `docket-receipt-${jobId}.json`);
    saveBlob(new Blob([txt], { type: 'text/plain' }), `docket-receipt-${jobId}.txt`);
    saveBlob(new Blob([sha], { type: 'text/plain' }), `docket-receipt-${jobId}.sha256`);
  });
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function receiptPermalink(jobId) {
  return `${window.location.origin}${window.location.pathname}#/receipt/${jobId}`;
}

export function explorerTx(hash) {
  if (!hash || hash === '0x0') return null;
  return `${EXPLORER}/tx/${hash}`;
}

export function explorerAddress(address) {
  if (!address) return null;
  return `${EXPLORER}/address/${address}`;
}

// Shared "what did the verify actually check" text — used by UI + export.
export function verifyChecksSummary(checks) {
  if (!checks) return null;
  const rows = [
    checks.exists && 'receipt exists on-chain',
    checks.resolved && 'protocol marked the job resolved',
    checks.immutable && 'answer commitment present (non-zero)',
    checks.askBound && 'question commitment present (non-zero)',
  ].filter(Boolean);
  return rows;
}
