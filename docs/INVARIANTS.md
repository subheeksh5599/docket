# DOCKET — Invariants

Every invariant maps to tests. If a test stops passing, an invariant is broken.

## The invariants

| ID | Invariant | Enforcement |
|---|---|---|
| I1 | A receipt can be created **at most once** per job. | `subnetMessage` reverts `AlreadyMinted(jobId)` if `locked[jobId]`; `test_doubleResolve_receiptImmutable`, `test_secondResolve_doesNotOverwrite` |
| I2 | **Only the Telegraph protocol callback** can finalize a receipt. | `subnetMessage` is `onlyDiamond`; `test_callback_fromWrongDiamond_reverts`, `test_callback_onlyDiamond_reverts` |
| I3 | Once finalized, `answerHash` **cannot change**. | Receipt struct written once; no update function exists in the contract; `test_receipt_immutableAfterResolve` |
| I4 | A finalized receipt **cannot be deleted**. | No delete/clear function exists; receipts live in a public mapping readable forever via `getReceipt` |
| I5 | **DOCKET never establishes truth** — it only records protocol output. | Enforced by design (no verification/truth logic in the contract); the app's invariant footer + `docs/RECEIPT_SPEC.md` |
| I6 | Every job's escrow is recoverable if the network never resolves it. | `cancelStuckJob` (owner-of-job only, reverts if locked); `test_cancelStuckJob_refundsToRegistry` |
| I7 | Every minted USDC is conserved (no balance created/lost). | Stateful invariant `invariant_noFundsLeak` (mock tracks holders + total supply, fuzzed 128+ runs) |
| I8 | The stored `questionHash` equals `keccak256(abi.encode(question))` — ask → answer binding survives. | Known-answer vectors in Solidity, TypeScript and Python incl. the LIVE receipt #24 hash |
| I9 | The stored `answerHash` equals `keccak256(abi.encode(OnChainData struct))` — answer → commitment binding. | Known-answer vector incl. the LIVE receipt #28 hash (struct-tuple encoding, cross-language) |
| I10 | The owner **cannot** rewrite, delete, or unlock receipts or touch escrowed funds. | Owner powers = intent labels + stray-token withdrawal only; `test_withdraw_onlyOwner`, `test_cancelStuckJob_onlyOwner` |

## Fuzz / property coverage

`ReceiptInvariant` fuzzes the registry + mock state transitions and asserts I3, I4, I7 and the receipt-corruption bounds across 128+ runs × deep call sequences:

```text
invariant_receiptsAreNeverCorrupted()   (runs: 128)
invariant_receiptHashNeverChanges()     (runs: 128)
invariant_noFundsLeak()                 (runs: 128)
invariant_jobCountMatchesJobsCreated()  (runs: 128)
```

## Consumer contract

`DocketGate.sol` demonstrates that another contract can consume a receipt as evidence: an action executes only when a job holds a locked, resolved receipt for the gate's intent **and** the caller supplies the exact stored `answerHash` (I2/I3/I5 compose into a gate). 8 tests cover the allow + every deny path.
