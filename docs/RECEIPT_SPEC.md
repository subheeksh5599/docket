# DOCKET — Receipt Specification (docket.receipt.v1)

Versioned, canonical definition of a DOCKET receipt so anyone can implement an
independent verifier. Schema id: **`docket.receipt.v1`** (set on every exported
artifact). Future breaking changes bump the version; old receipts stay readable.

## On-chain receipt (ReceiptRegistry)

```solidity
struct Receipt {
    uint256 jobId;      // registry-side job id (sequential per registry)
    bytes32 intentId;   // protocol intent, committed at request time
    bytes32 questionHash; // keccak256(abi.encode(question)) — the ask
    bytes32 answerHash;   // keccak256(abi.encode(OnChainData)) — the network return
    uint256 createdAt;    // block.timestamp when the callback minted it
    bool    resolved;     // always true once minted
}
```

Read: `getReceipt(uint256 jobId)` on the registry. `locked(jobId)` → bool.
Reverts (`NoSuchReceipt`) when no receipt exists for that job id.

## Canonical hashes

```text
questionHash = keccak256( abi.encode(question) )                  // string arg
answerHash   = keccak256( abi.encode(OnChainData) )               // struct arg
```

`OnChainData` is a Solidity struct (NOT flat args):

```text
struct OnChainData { address[] addresses; uint256[] integers; string[] strings; bool[] bools; }
```

`abi.encode` of a struct is the ABI encoding of the struct as a dynamic tuple:

```text
0x0000…0020                                  // offset word: struct head starts at byte 32
  0000…0080 0000…00a0 0000…00e0 0000…04c0    // array offsets, relative to the struct
                                             // head (byte 32 of the whole encoding)
  <addresses tail: length word + elements>
  <integers tail: length word + elements>
  <strings tail:  length word + offset words + (length + bytes) per string>
  <bools tail:    length word + elements>
```

Verified byte-for-byte against viem's tuple encode and against the LIVE on-chain
receipts #24/#28 on Base Sepolia (recomputed `answerHash == 0x23d1c6ef…`, PASS).

## Verification procedure (independent, no DOCKET)

1. **Job exists** — read the registry at the documented address on chain 84532.
2. **Receipt exists + locked** — `getReceipt(jobId)` returns a receipt and
   `locked(jobId) == true`.
3. **Ask bound** — `questionHash == keccak256(abi.encode(question))` for the
   question the user asked.
4. **Answer committed** — take the network's returned `OnChainData` (from the
   resolving transaction's calldata or your own copy of the answer), encode per
   the canonical rule above, and confirm it equals the stored `answerHash`.
5. **Protocol-produced** — the receipt's minting transaction originates from the
   Telegraph Diamond's resolve path (the registry's `subnetMessage` is
   `onlyDiamond`), and `ReceiptMinted` is emitted on-chain.

CLI:

```bash
cast call <registry> "getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)" <jobId> \
  --rpc-url https://sepolia.base.org
```

Repo verifier (independent program, stdlib-only):

```bash
DOCKET_REGISTRY=<registry> python3 scripts/docket_verify.py <jobId>
DOCKET_REGISTRY=<registry> python3 scripts/docket_verify.py <jobId> \
  --answer '{"addresses":[],"integers":[],"strings":["..."],"bools":[]}'
```

## What a receipt does NOT claim

- It does not certify the answer is **true** — miners can be wrong. It records
  what the network returned.
- It does not imply payment success beyond what the resolve transaction shows.
- It is public data — treat the question and commitment as public.

## Artifacts (evidence bundle)

Every receipt exports three files, all tagged `docket.receipt.v1`:

| File | Content |
|---|---|
| `docket-receipt-<id>.json` | canonical machine-readable record (chain, registry, jobId, intent, hashes, timestamps, explorer links, verification result) |
| `docket-receipt-<id>.txt` | human-readable record + the exact `cast call` to verify it |
| `docket-receipt-<id>.sha256` | SHA-256 of the .json — proves the artifact wasn't altered after export |
