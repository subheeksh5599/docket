# VERIFY.md — a judge can prove a DOCKET receipt in 5 minutes

This guide proves the core promise **without the DOCKET frontend, backend, or key**:
the record is on-chain and anyone can verify it. Every command is copy-pasteable.

## What you are proving

1. A receipt exists on the ReceiptRegistry (a real contract on Base Sepolia).
2. It is resolved and **locked** (immutable — no update path exists).
3. It is bound to a question (committed before the network saw it).
4. The commitment matches what the network returned (re-hashable).
5. The whole thing was paid for and delivered through the Telegraph Diamond —
   the protocol's own rail.

**Registry (canonical):** `0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48`
**Chain:** Base Sepolia (84532). Any public Base Sepolia RPC works — e.g. `https://sepolia.base.org`.

## 1 · Read the receipt from a plain RPC (30 seconds)

```bash
cast call 0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48 \
  "getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)" 24 \
  --rpc-url https://sepolia.base.org
```

You get a 6-tuple: `(jobId, intentId, questionHash, answerHash, timestamp, resolved)`.

Check: `resolved == true`, and `answerHash` is non-zero (locked).

## 2 · Confirm the source is verified (30 seconds)

Open in a browser:
`https://sepolia.basescan.org/address/0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48#code`

The contract shows **verified** (Compiler: v0.8.28) and matches this repository's
`src/ReceiptRegistry.sol`. Skim the code: there is **no update function** and **no
delete function**. That is the immutability proof.

## 3 · Confirm the question binding (1 minute)

The receipt's `questionHash` was committed at request time — before the network saw
the question. Recompute it from the question the asker recorded (in their evidence
bundle or the receipt's metadata):

```text
questionHash = keccak256(abi.encode("the question text"))
```

The repository ships a verifier that does this check for you (step 5).

## 4 · Confirm it went through Telegraph (1 minute)

The job id is the first tuple field. Read the job on the Telegraph Diamond:

```bash
cast call 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8 \
  "getJob(uint256)(uint256,bytes32,address,uint256,uint256,uint8,uint256)" 24 \
  --rpc-url https://sepolia.base.org
```

You see the job's callback = the ReceiptRegistry, escrow = 1,000,000 (1 USDC),
miner payout = 980,000, protocol fee = 20,000, and a terminal state. The job was
real, funded, routed and settled on the protocol.

## 5 · Independent CLI verification (2 minutes)

From a fresh clone of this repository (no installs — Python stdlib only):

```bash
git clone https://github.com/subheeksh5599/docket
cd docket
DOCKET_REGISTRY=0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48 \
  python3 scripts/docket_verify.py 24
```

Expected output ends in:

```
RESULT: RECEIPT VERIFIED - immutable on-chain receipt exists for job 24
```

The verifier fails over across three independent public RPCs and re-checks every
claim: registry has code, Diamond has code, receipt resolved, receipt locked,
ask bound to receipt.

## 6 · (Optional) Re-hash the answer commitment (2 minutes)

The receipt commits to the network response via `keccak256(abi.encode(OnChainData))`.
Pass the recorded response JSON to re-hash and compare:

```bash
DOCKET_REGISTRY=0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48 \
  python3 scripts/docket_verify.py 28 --answer '{"addresses":[],"integers":[1000000000000000000],"strings":["status:invalid_input","summary:...","confidence","answer:..."],"bools":[]}'
```

Any tamper with the payload changes the hash and the check FAILS — that is the
whole point.

## The zero-trust summary

DOCKET's frontend could disappear tomorrow and **nothing above stops working**:
the registry, the receipts, the jobs, the commitments, and the verification are
all on a public chain. The frontend is a viewer. The chain is the record.

---

Known-good receipt IDs to test with: **#24, #28, #30, #31, #32** — all resolved,
locked, and verified live from three independent RPCs on 2026-09-03.
