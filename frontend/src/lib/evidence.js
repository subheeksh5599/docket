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
