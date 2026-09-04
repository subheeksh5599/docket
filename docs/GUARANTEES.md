# DOCKET — Guarantees

Every guarantee DOCKET makes, the mechanism that enforces it, and the test or
live artifact that proves it. Nothing here is aspirational — each row's proof
column points at a real test in this repo or a real on-chain artifact.

## Core guarantees

| Guarantee | Mechanism | Proof |
|---|---|---|
| **The ask cannot change after submission** | `questionHash` is committed to contract storage *before* `createJob` reaches the network; no setter exists | `test_questionHash_matchesLiveReceiptVector` + live receipt #24 questionHash `0x5f8aa309…` re-derived from the ask |
| **An unauthorized caller cannot mint a receipt** | `subnetMessage` callback requires `msg.sender == Diamond` (`onlyDiamond`) | `test_callback_onlyDiamond_reverts`; live guard-rail revert `0xbb4902ed` on the registry |
| **A receipt cannot change once minted** | no update function, no delete function exist in the bytecode | `test_receipt_immutableAfterResolve`; invariant `receiptHashNeverChanges`; Slither mutation-surface scan = NONE |
| **The answer cannot be swapped** | the receipt locks `keccak256(abi.encode(OnChainData))`; any different payload hashes differently | `test_doubleResolve_receiptImmutable`; live re-hash PASS on receipt #28 (`0x23d1c6ef…`); tamper demo rejects a 1-char change |
| **A callback cannot mint twice** | mint only on the terminal path; the receipt row is final | `test_doubleResolution…`; live DocketGate `ActionAlreadyExecuted` revert (`0x6d41cd6c`) |
| **User funds are never custodied by DOCKET** | escrow lives on the Telegraph Diamond (the protocol's own rail); registry pulls USDC into it at job creation | live `cancelStuckJob` tx `0xaeb14662` — escrow refunded on cancel |
| **The frontend cannot rewrite history** | the chain is authoritative; every read is a live `eth_call`; zero DOCKET backend exists | `docket prove 24` → 3/3 RPC consensus, exit 0; "delete the frontend" property holds by construction |
| **An owner cannot touch receipts** | owner capabilities are limited to naming intents + withdrawing stray tokens | `test_ownerOnlyFunctions…`; capability matrix below |
| **Verification needs no DOCKET infrastructure** | CLI + MCP + cast read public RPCs directly; no API key, no server, no database | clean-env run from `/tmp` with only `DOCKET_REGISTRY` set → RECEIPT VERIFIED |

## Capability matrix (owner surface)

| Action | Owner only? | Changes receipts? |
|---|---|---|
| Name / label an intent | Yes | No |
| Withdraw stray (non-escrow) tokens | Yes | No |
| Cancel a *stuck unresolved* job (refund escrow) | Yes | No |
| Edit a receipt | — | No function exists |
| Delete a receipt | — | No function exists |
| Rewrite a question commitment | — | No function exists |
| Withdraw escrowed job funds | No | No — escrow lives on the Diamond |

## Protocol guarantees (Telegraph integration)

| Guarantee | Mechanism | Proof |
|---|---|---|
| The protocol integration is pinned | Diamond + USDC + jobBasePrice verified live; source-verified registry matches repo source (solc 0.8.28) | `scripts/verify_telegraph_integration.py` — 11 live checks, bytecode fingerprints match frozen |
| The callback really is the protocol's | registry is the `callback` address on live job #24 (`getJob(24)` word 3 = registry) | `docs/TELEGRAPH_DEPLOYMENT.md` |
| Receipt proves the network was paid | the minting callback is the same callback that pays the resolver (escrow 1e6 → miner 9.8e5 + fee 2e4) | live job #24 Diamond state + resolver tx `0x405057ec…` |

## What DOCKET does NOT guarantee

- **It never declares the answer true.** The receipt records what the network
  returned; the network can be wrong, and the record preserves that honestly.
  Verification proves *record integrity*, never *answer correctness*.
- **Immediate finality.** Base Sepolia can reorg. A receipt is *included*
  at its block; treat deep confirmations as final. The verifier reads `latest`
  and the bundle records the block — see `docs/RECEIPT_SPEC.md` reorg notes.
- **Freshness.** A receipt is immutable but not perpetually relevant — a price
  receipt from yesterday is stale. Consumers enforce their own `max_age`
  (the MCP `assess_docket_receipt` tool takes `max_age_seconds`).

## Formal invariants (stateful, 128 runs each in CI)

| Invariant | Statement |
|---|---|
| `receiptsAreNeverCorrupted` | every receipt row, once minted, is unchanged |
| `receiptHashNeverChanges` | question/answer commitments never mutate |
| `noFundsLeak` | every minted USDC is conserved across the lifecycle |
| `jobCountMatchesJobsCreated` | job/receipt accounting stays consistent |

Run: `FOUNDRY_INVARIANT_RUNS=128 forge test --match-path test/Invariant.t.sol`
