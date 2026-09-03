// DOCKET error taxonomy — every failure mode has a code, human message + retry guidance.
// No raw Solidity panics, no endless spinners, no silent failures, no fake success.

export const ERRORS = {
  WALLET_NOT_CONNECTED: { message: 'Connect your wallet to continue.', retry: 'Click Connect Wallet above.' },
  WRONG_NETWORK: { message: 'DOCKET runs on Base Sepolia (chain 84532).', retry: 'Approve the network switch in your wallet, or add Base Sepolia when prompted.' },
  INSUFFICIENT_ETH: { message: 'This wallet has no ETH for gas on Base Sepolia.', retry: 'Fund it with test ETH from a Base Sepolia faucet, then retry.' },
  INSUFFICIENT_USDC: { message: 'Not enough test USDC to fund the job.', retry: 'Get test USDC from the Circle Base Sepolia faucet, then retry.' },
  APPROVAL_REJECTED: { message: 'The USDC approval was rejected.', retry: 'Nothing was spent. Approve again when you are ready.' },
  CREATE_JOB_REJECTED: { message: 'The create-job transaction was rejected.', retry: 'Nothing was charged. You can retry.' },
  CREATE_JOB_REVERTED: { message: 'The create-job transaction reverted on-chain.', retry: 'The escrow was not debited. Check the intent/budget and retry.' },
  RPC_UNAVAILABLE: { message: 'The network node is unreachable right now.', retry: 'DOCKET auto-switches RPCs. Wait a moment and retry.' },
  RPC_RATE_LIMITED: { message: 'The network node is rate-limiting requests.', retry: 'Wait a few seconds — DOCKET retries with backoff.' },
  JOB_NOT_FOUND: { message: 'No job with that id was found on-chain.', retry: 'Double-check the job id.' },
  JOB_PENDING: { message: 'The job is still being processed by the network.', retry: 'Wait — this page updates automatically.' },
  JOB_EXPIRED: { message: 'The job was not resolved and its escrow can be recovered.', retry: 'Cancel it to refund your escrow.' },
  CALLBACK_PENDING: { message: 'The miner answered; the result is being settled on-chain.', retry: 'Wait for the callback transaction to confirm.' },
  CALLBACK_FAILED: { message: 'The callback could not be delivered.', retry: 'The receipt may still be readable from the resolving transaction.' },
  RECEIPT_NOT_FOUND: { message: 'No receipt exists for that job yet.', retry: 'If the job resolved, wait for the callback; otherwise check the job state.' },
  RECEIPT_ALREADY_MINTED: { message: 'This job already has a receipt. Receipts are immutable.', retry: 'View the existing receipt — it cannot be overwritten.' },
  INVALID_INTENT: { message: 'That intent is not supported or not registered.', retry: 'Pick an intent from the list.' },
  INVALID_PARAMS: { message: 'The request parameters are invalid for this intent.', retry: 'Check the question format for the selected intent.' },
  UNKNOWN_PROTOCOL_ERROR: { message: 'An unexpected error occurred.', retry: 'Try again; if it persists, check the explorer for the transaction.' },
};

// Map an exception to the closest taxonomy code. Returns the CODE (string).
export function classifyError(err) {
  if (!err) return 'UNKNOWN_PROTOCOL_ERROR';
  const m = (err?.shortMessage || err?.message || err?.reason || '').toString();
  const lower = m.toLowerCase();
  if (/user rejected|denied transaction|user denied|action rejected/i.test(lower)) return 'CREATE_JOB_REJECTED';
  if (/approval|allowance/i.test(lower) && /reject|denied/i.test(lower)) return 'APPROVAL_REJECTED';
  if (/insufficient funds|out of gas|gas required/i.test(lower)) return 'INSUFFICIENT_ETH';
  if (/429|rate limit/i.test(lower)) return 'RPC_RATE_LIMITED';
  if (/fetch failed|network error|timeout|timed out|socket|connection|ECONN/i.test(lower)) return 'RPC_UNAVAILABLE';
  if (/execution reverted|revert/i.test(lower)) return 'CREATE_JOB_REVERTED';
  if (/unsupported intent|invalid intent|not.*intent/i.test(lower)) return 'INVALID_INTENT';
  if (/wrong network|chain.*84532|unsupported chain/i.test(lower)) return 'WRONG_NETWORK';
  return 'UNKNOWN_PROTOCOL_ERROR';
}

export function errorLabel(code) { return ERRORS[code] || ERRORS.UNKNOWN_PROTOCOL_ERROR; }
