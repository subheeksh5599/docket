<div align="center">

&nbsp;

# DOCKET

### Put a question on the record — the network writes the answer on-chain, and the receipt can never be edited, deleted, or faked.

[![CI](https://github.com/subheeksh5599/docket/actions/workflows/ci.yml/badge.svg)](https://github.com/subheeksh5599/docket/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-141%20passing-10b981)](#tests)
[![Chain](https://img.shields.io/badge/chain-Base%20Sepolia-0052FF)](https://sepolia.basescan.org)
[![Protocol](https://img.shields.io/badge/protocol-Telegraph%20ERC--8183-3ddc91)](https://docs.telegraphprotocol.com)
![Stack](https://img.shields.io/badge/Solidity%20·%20Foundry%20·%20React%20·%20viem-1f1f23)

**[ Live demo ↗ ](https://docket-blush.vercel.app)** &nbsp;·&nbsp; **[ How it works ↗ ](#how-it-works)** &nbsp;·&nbsp; **[ The live receipt ↗ ](#the-live-receipt)** &nbsp;·&nbsp; **[ Honesty table ↗ ](#whats-real-vs-mock--the-honesty-table)** &nbsp;·&nbsp; **[ Run it locally ↗ ](#run-it-locally)**

</div>

---

## The problem I set out to solve

Machines and humans now act on AI answers every day — a price check, a contract review, a safety verdict — but the evidence behind a consequential decision is usually a screenshot or a copied chat line. Anyone can fake a screenshot. Nobody is forced to trust one.

And when the answer comes from a network of anonymous miners, the question gets worse: which miner answered? What exactly did the network return? Can you still verify it next month?

So I treated **the record itself** as the product. DOCKET's non-negotiable design rule: **the record is written by the protocol's own payment callback, on-chain, and locked.** Not by us, not by you, not by a database with a delete button.

## What I built

DOCKET turns one factual question into a permanent, on-chain receipt produced by the Telegraph network itself:

1. **Ask** — you type a question and pick an intent (`CRYPTO_PRICE`, `FACT_CHECK`, …).
2. **Escrow** — your ReceiptRegistry contract escrows testnet USDC into the Telegraph Diamond — the protocol's own payment rail. DOCKET never holds funds.
3. **Route** — the registry issues an ERC-8183 `createJob` on the Diamond; the protocol routes it to a real registered miner.
4. **Answer** — the miner resolves the job on-chain.
5. **Mint** — the protocol's callback writes the receipt: question hash, answer commitment, miner, timestamp — in one transaction, then locks it. There is no update function. It cannot be changed.

The invariant, printed on every page of the app: **DOCKET records what the network returned. It never declares what is true.** The receipt is an anchor, not an opinion — anyone can re-hash the original payload and confirm the commitment forever, with no trusted party.

## How it works

```
You ask ──► ReceiptRegistry escrows USDC ──► createJob (ERC-8183) on the Telegraph Diamond
                                                    │
                                                    ▼
                                     protocol routes to a real miner
                                                    │
                                                    ▼
                                     miner answers ──► on-chain resolve
                                                    │
                                                    ▼
                          callback writes the immutable receipt (locked forever)
                                                    │
                                                    ▼
                  anyone verifies: questionHash · answerHash · miner · timestamp
```

| Component | Role |
|---|---|
| `ReceiptRegistry.sol` | The record. Escrows USDC → `createJob` → mints the locked receipt on callback. No update path. |
| Telegraph Diamond | The protocol. Routes jobs to real miners, pays them, delivers the callback. |
| Receipt | `jobId · intentId · questionHash · answerHash · createdAt · resolved` — immutable once minted. |
| Verifier | CLI + in-app: reads the registry from any RPC, re-checks the commitments. No DOCKET backend. |

The question is committed **before** any miner sees it (`questionHash = keccak256(abi.encode(question))`), and the answer commitment is written by the **same callback that pays the miner** — so the receipt is minted by the exact mechanism the protocol uses to settle work.

## The live receipt

A real job, on the real testnet, answered by a real Telegraph miner. Receipt **#24** on the live registry — verified from three independent RPCs.

| Field | Value |
|---|---|
| ReceiptRegistry (source-verified on Blockscout) | [`0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48`](https://sepolia.basescan.org/address/0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48) |
| Telegraph Diamond | [`0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`](https://sepolia.basescan.org/address/0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8) |
| Job | #24 — `CRYPTO_PRICE` |
| createJob tx | [`0x839a97…2494e`](https://sepolia.basescan.org/tx/0x839a971799a03aa6fede72bc503ca78dd70a1a84dadca83587f9a01198a2494e) |
| questionHash | `0x5f8aa309e059516aaff6d218737f5740c073d7d8bbca87dd646930296e96e7b1` |
| answerHash (commitment) | `0x23d1c6ef8212c9601d12dc626ecdbce5965e23a1622df5bbf8e47fec280d44c2` |
| Status | resolved · **locked** (immutable) |

Verify it yourself — one command, no DOCKET involved:

```bash
# any RPC; the receipt is public chain state
cast call 0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48 \
  "getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)" 24 \
  --rpc-url https://sepolia.base.org
```

## What's real vs mock — the honesty table

| Claim | Reality |
|---|---|
| Live end-to-end | ✅ Job #24: real `createJob` on the Diamond → real miner → real callback → receipt minted + locked. Verified from sepolia.base.org, publicnode, drpc. |
| Receipt immutability | ✅ The contract has no update function. `locked[24] == true`, and `getReceipt` is the only read path. |
| Ask → answer binding | ✅ `questionHash` was committed at request time and matches `keccak256(abi.encode(question))` cross-language (Solidity + JS + Python). |
| Contract source | ✅ Verified on Blockscout — matches this repo. |
| Miners / answers | The network's real miners answer. DOCKET records **what the network returned** — it never certifies an answer as true. |
| Escrow | Protocol payment rail only. DOCKET never custodies funds; users can `cancelStuckJob` to recover escrow on unresolved jobs. |
| Test mocks | `MockDiamond` / `MockUSDC` live under `test/` only — explicitly TEST-ONLY, never deployed, never in the shipped path. |

## Engineering decisions & the hard problems

- **The callback IS the receipt.** The protocol's callback that settles the miner is the same call that mints the record — one cheap write, locked after. That's why the artifact is honest by construction: it's produced by the payment mechanism itself.
- **Commit the ask before the answer.** `questionHash` + `intentId` are written when the job is created, so the receipt binds ask → answer even though the callback only carries the answer.
- **The canonical hash rule is shared.** `keccak256(abi.encode(OnChainData))` — implemented identically in Solidity, TypeScript (viem) and the Python verifier, and pinned by known-answer test vectors including the live receipt #24 hash.
- **Adversarial testing.** False-return USDC, reverting tokens, wrong-diamond callbacks, reentrancy, oversized budgets — all covered.
- **Stateful invariants.** 128-run fuzz campaigns assert receipts are never corrupted, hashes never change, and **every minted USDC is conserved** — the mock tracks holders + total supply so the conservation check is exact, not an enumeration guess.

## Tests

**141 passing** — 55 Solidity (unit, adversarial, edge cases, hash vectors, stateful invariants) + 86 frontend (hash vectors, error taxonomy, ABI shape, components, routing). The fork suite additionally proves the registry against the real Diamond on an anvil fork of Base Sepolia.

```bash
forge test                          # contracts (unit + adversarial + edge + vectors)
FOUNDRY_INVARIANT_RUNS=128 forge test --match-path test/Invariant.t.sol
cd frontend && npm test             # vitest
```

Coverage of `ReceiptRegistry.sol`: **100% lines / 95.8% statements / 100% functions** (`forge coverage`). CI runs both jobs on every push — [see it green](https://github.com/subheeksh5599/docket/actions).

## Run it locally

```bash
git clone https://github.com/subheeksh5599/docket && cd docket
forge build && forge test                     # contracts
cd frontend && npm install && npm run dev     # UI (uses the live registry by default)
```

Point at your own registry via `VITE_REGISTRY_ADDRESS`. The deploy script + runbook live in `script/` and `docs/`.

## Tech stack

Solidity 0.8.24 · Foundry · React 19 · Vite · Tailwind v4 · viem · Vitest · GitHub Actions. Chain: Base Sepolia (84532). Protocol: Telegraph ERC-8183 on-chain jobs.

## Project layout

```
src/ReceiptRegistry.sol        the record — escrow → createJob → locked receipt
src/interfaces/                IDiamond, IUSDC, OnChainData (sponsor-verified)
test/                          55 tests incl. invariants + real-Diamond fork suite
scripts/docket_verify.py       independent CLI verifier (RPC failover, answer re-hash)
frontend/                      React app — ask flow, receipt board, permalink, trust page
docs/                          deployment facts, threat model, runbook, manifest
.github/workflows/ci.yml       forge fmt/build/test + frontend lint/test/build
```

## License

MIT
