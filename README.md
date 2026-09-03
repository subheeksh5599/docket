# DOCKET

**Put a question on the record.**

DOCKET turns a single factual question into a permanent, on-chain receipt produced by the Telegraph network itself — not by us, and not by you. Ask. Pay a few cents. The network's top-ranked miner answers through the protocol. The answer, the miner, the payment and the timestamp are written on-chain and can never be edited, deleted or faked. Anyone can verify the record in ten seconds.

```
You ask  ──►  your Receipt contract escrows USDC  ──►  createJob on the Diamond
                                                          │
                                                          ▼
                                              protocol routes to top miner
                                                          │
                                                          ▼
                                              miner answers  ──►  on-chain resolve
                                                          │
                                                          ▼
                                   callback writes the receipt into your contract
                                                          │
                                                          ▼
                                public page: question · answer · miner · hash · time
```

## Why this exists

Machines and humans now act on AI answers every day, but the evidence behind a consequential decision is usually a screenshot or a copied chat line — something anyone can fake, and nothing a counterparty, a community or an auditor is forced to trust.

DOCKET replaces the screenshot with a receipt the network mints:

- **Not our file.** We never see, store or vouch for the answer. The Telegraph protocol routes the question, a validator-scored miner answers, and settlement happens on-chain.
- **Not yours either.** You cannot edit the record after it exists, which is the entire point when you need to prove *what was said before you acted*.
- **Checkable by anyone.** Every receipt carries the job id, the miner, the response hash and the block — each linkable on a public explorer.

## The one-line invariant

> DOCKET records what the network returned. It never declares what is true.

## ERC-8183 — the mechanism

Telegraph exposes an on-chain inference standard (ERC-8183). A smart contract:

1. escrows USDC on the protocol's **Diamond** contract,
2. calls `createJob(intentId, params, callback)`,
3. the protocol routes the job to the currently top-ranked miner for that intent,
4. the miner answers; the settlement authority calls `transitionToTerminal`,
5. the result is delivered to your contract's `subnetMessage(...)` callback.

The entire lifecycle is on-chain and auditable. **Verified live (2026-09-02):** the Diamond at
`0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8` answers `getJobBasePrice()` = 1,000,000,
`usdcToken()` = `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, has 21 facets, and the ERC-8183
selectors (`createJob`, `cancelJob`, `transitionToTerminal`, `getJob`, `depositUSDC`,
`escrowBalance`, `getJobBasePrice`) are registered. Full receipts: `docs/TELEGRAPH_DEPLOYMENT.md`.

## The receipt contract (ReceiptRegistry)

- escrows USDC into the Diamond, creates the job,
- receives the callback and writes a **single, cheap, immutable record**: `jobId → answer
  commitment (hash) + timestamp`, locked forever,
- `onlyDiamond` guard — no address other than the protocol can mint,
- per the protocol's own constraint the callback stays one write; the full answer is read
  off-chain from the resolving tx and re-verified against the commitment.

## Verified state (what is REAL today)

| Claim | Evidence |
|---|---|
| Contract logic works | 20 forge tests green (10 core + 8 adversarial/fuzz + 2 fork) |
| Registry works against the REAL Diamond | fork test reads live `usdcToken()` + `getJobBasePrice()` |
| Live Diamond verified | on-chain reads: jobBasePrice 1e6, usdcToken, treasury, 21 facets |
| **Live end-to-end job (Base Sepolia)** | **DONE — job #24, real miner, real callback, receipt minted + locked** |
| Receipt binds ask → answer | questionHash = keccak256(abi.encode(question)) — VERIFIED on-chain |
| Contract source-verified | Blockscout (both deployments) |
| Frontend builds + serves | vite build clean, HTTP 200 |
| CLI verifier | reads chain directly, RPC failover, all checks PASS on live receipt |

**Live receipts (both verified from 3 independent RPCs):**
- ReceiptRegistry (active): `0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48` — job #24, ask→answer bound
  `https://sepolia.basescan.org/address/0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48`
- ReceiptRegistry (v1): `0xFE240508CE86638E15ef85f187Cd649d7922646A` — job #23

**No mocks in the shipped path** — test fixtures isolated under `test/`, explicitly labeled, never deployed.

## Current testnet honesty

Base Sepolia is currently a single-signer genesis node: the full 43/64 BFT validator consensus
is NOT active on this testnet. DOCKET receipts record what the network returned on this
testnet; they do not claim mainnet-grade BFT finality. Protocol design and current testnet
operational state are kept separate throughout.

## Docs

- `docs/TELEGRAPH_DEPLOYMENT.md` — verified on-chain addresses/signatures (re-verify before deploy)
- `docs/THREAT_MODEL.md` — assets, trust boundaries, explicit attackers
- `docs/RUNBOOK.md` — incident response (stuck jobs, callback failure, key compromise)
- `docs/DEPLOYMENT_MANIFEST.yaml` — deploy manifest (fill on live deploy)

## Repo layout

```
contracts -> src/        ReceiptRegistry.sol, OnChainData.sol, interfaces/
test/                    core + adversarial + fork suites (test-only mocks labeled)
scripts/                 docket_verify.py (independent CLI verifier)
frontend/                Vite + React + Tailwind v4 + viem (Sauce Labs design)
docs/                    deployment facts, threat model, runbook, manifest
```

## Status

- [x] Contracts + 20 tests green (unit + adversarial + fork against real Diamond)
- [x] Live Diamond + USDC + job price verified on-chain
- [x] Live end-to-end on Base Sepolia: real ERC-8183 job #24 → real miner → real callback → immutable receipt (ask→answer bound)
- [x] Receipt verified from 3 independent RPCs + CLI verifier (all checks PASS)
- [x] Contract source-verified on Blockscout (active + v1 deployments)
- [x] Frontend: ask flow, receipt board, verify-from-chain, error taxonomy (builds clean, points at live registry)
- [x] CLI verifier, docs (deployment facts / threat model / runbook / manifest), env hygiene
- [ ] Full-answer re-hash from callback calldata (documented next enhancement — receipt commitment is already the immutable anchor)

Local dev: `forge test` (contracts) · `cd frontend && npm run dev` (UI) ·
`anvil --fork-url https://sepolia.base.org --port 8545` then `forge test --match-path test/Fork.t.sol`.
