# DOCKET — Incident Runbook

How to respond when something breaks. Order: detect → diagnose → contain → recover → document.

## RPC broken (403 / 429 / down)
- DOCKET frontend auto-fails over across: sepolia.base.org → publicnode → drpc.
- CLI verifier tries each in order, prints which failed.
- Verify chain id after failover (`eth_chainId` == 0x14a34). Never write through an
  unverified provider.
- Resume: confirm a block-height sanity check against two providers before writes.

## Telegraph jobs stuck (no resolve after minutes)
The protocol deliberately does NOT resolve failed jobs — they stay Funded (state 0).
- Check the Diamond job state: `getJob(jobId)` → state.
- State 0 + age > a few minutes = failed, not pending. Escrow is recoverable.
- Recovery: user calls `cancelJob` → budget returns to escrow → withdraw.
- NEVER resubmit blindly (double charge). Confirm the original job is cancelled first.

## Callback failed / receipt not minted but job resolved
The real protocol swallows callback reverts (documented). The job settles, the miner is
paid, and the receipt may not be written.
- Read the resolving transaction's calldata; the answer + callback invocation are there.
- DOCKET read side reconstructs the commitment from calldata for display.
- Documented limitation — receipt immutability is preserved; delivery is best-effort.

## Contract issue (bug found post-deploy)
- ReceiptRegistry is IMMUTABLE (no upgrade path). Existing receipts are safe forever.
- Freeze new submissions via the frontend flag if a bug is confirmed.
- Deploy a new registry for new jobs; keep the old address documented.
- Publish a notice. Historical receipts remain queryable on the old contract.

## Owner key compromise
- Owner only labels intents + withdraws STRAY USDC — it CANNOT rewrite or steal receipts
  or escrowed funds (receipts are locked; escrow lives on the Diamond).
- If the owner key leaks: the worst case is cosmetic intent relabeling + stray withdrawal.
  Rotate by deploying a fresh registry with a new owner for new jobs.
- Publish the compromise notice. History is preserved on-chain regardless.

## Wrong network / mainnet accident
- Production build asserts chain 84532 before any write (config validation).
- If a write ever lands elsewhere, it is on the user's own wallet + the wrong chain's
  Diamond — DOCKET holds no keys and cannot move funds. Document and verify chain id.

## Health / observability (self-serve)
No backend exists to monitor — the chain IS the source of truth. Point any watcher at:
- `eth_chainId` + latest block on the RPC failover list (base-sepolia public endpoints).
- `getJobBasePrice()` on the Diamond returns non-zero → protocol facet alive.
- `eth_getCode(REGISTRY)` non-empty → registry deployed; `getReceipt(jobId)` reads.
- A cron can page on: job #N stuck in state 0 past its expected TTL, or the registry
  address returning no code (chain reset). All reads are public RPC calls — no keys.
- Frontend surfaces failures with the error taxonomy (docs/THREAT_MODEL.md) and a retry;
  wallet rejections show "nothing was charged" — no silent states.

## Stuck-job recovery (user-facing)
- AskPanel submits; if the job stays PENDING past the intent TTL the user can cancel from
  the receipts view (cancelStuckJob → escrow refunds to the Diamond escrow under the
  registry; owner withdraws strays only). UI shows the honest state: PENDING pulse while
  the network resolves, MINTED when the callback lands, no fake success between.

## Everything else
- Structured logs + request ids in the backend (if added). Frontend JS error tracking.
- After any incident: append to this file with date, cause, fix, prevention.
