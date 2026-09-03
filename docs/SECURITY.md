# DOCKET — Security

## Threat model

DOCKET is a thin application over a protocol. Its security posture is: **the chain is the authority; the frontend is a window.** There is no DOCKET backend, no DOCKET database, and no DOCKET-held key.

## Trusted components

| Component | Why trusted |
|---|---|
| Base Sepolia chain (84532) | Consensus + state; receipts are chain state |
| Telegraph Diamond (`0x5a23…7ff8`) | The protocol's job/settlement rail; source-verified |
| ReceiptRegistry (`0xb5Ed…Bf48`) | Source-verified on Blockscout, matches this repo; immutable bytecode (no upgrade path) |

## Untrusted components

| Component | Why untrusted |
|---|---|
| Frontend (Vercel static) | Read-only window over the chain; can be replaced by any client. It never holds keys or writes without the user's wallet signature. |
| Miners | Anonymous network participants. DOCKET records what they returned — it does not certify it. |
| Users' wallets | Sign their own requests; DOCKET never moves funds on their behalf beyond the explicit approve + request. |

## Admin powers (owner of ReceiptRegistry)

- `nameIntent(bytes32, string)` — label intents (cosmetic).
- `withdraw(to, amount)` — collect **stray** USDC sent to the registry only. Cannot touch Diamond escrow, receipts, or job funds.
- **Cannot**: rewrite/delete/unlock receipts, cancel others' jobs, or move escrowed funds.

## Callback protection

- `subnetMessage` is `onlyDiamond` — only the Telegraph Diamond address may mint a receipt (I2).
- The receipt binds `intentId` + `questionHash` committed at request time to the `answerHash` delivered by the callback — the ask cannot be swapped after the fact.
- Receipts mint once (I1) and are immutable (I3/I4).

## Reentrancy

- The callback performs no external calls after state writes; receipts are one-shot. Slither reports the write-then-emit pattern as benign/informational only (verified, 2026-09-03).

## Escrow safety

- User funds escrow **on the Diamond** (protocol rail), never in the registry's balance (beyond the instant of the deposit call).
- Unresolved jobs: `cancelStuckJob` (job owner only) refunds escrow to the registry's Diamond escrow; the owner withdraws strays. No user funds are ever stuck permanently.

## Known limitations (documented honestly)

- Full answer TEXT is not stored on-chain; the receipt commits to its hash. The payload lives in the resolving transaction's calldata and can be re-hashed to confirm the commitment (the verifier's `--answer`/`--payload` mode; LIVE PASS on receipt #28).
- The protocol swallows callback reverts (documented upstream) — receipt delivery is best-effort; the job + answer remain readable from the resolving tx regardless.
- Testnet only: Base Sepolia USDC/ETH have no value. Nothing here is production finance.
- Questions + receipts are public on-chain data.

## Audits run

- Slither (2026-09-03): informational findings only after fixes; unused-return on `approve` fixed.
- `forge coverage`: ReceiptRegistry at 100% lines / 95.8% statements / 100% functions.
- Stateful invariants fuzz (128+ runs): no violations (see INVARIANTS.md).
