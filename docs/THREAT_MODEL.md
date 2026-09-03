# DOCKET — Threat Model

Assets, trust boundaries, and explicit attackers. Receipts are the crown jewels:
they must be immutable, verifiable without DOCKET, and never rewritable by any party.

## Assets
1. On-chain receipts (jobId → immutable commitment + timestamp). THE asset.
2. User USDC escrow on the Telegraph Diamond (held by the protocol, not DOCKET).
3. Registry owner key (admin-only functions).

## Trust boundaries
- **Chain (Base Sepolia) = source of truth.** RPCs are transport, not authority.
- **Telegraph Diamond = trusted third party** for job lifecycle + callback delivery.
  DOCKET does not validate miner answers; Telegraph's validators do.
- **Explorer/API = convenience only.** Never authoritative.
- **DOCKET frontend/database = presentation/derived data only.** No authoritative state.
- **DOCKET registry contract = records what the network returned. Never declares truth.**

## Attackers
| # | Attacker | Goal | Why it fails |
|---|---|---|---|
| 1 | Fake callback | Mint a receipt without a real job | `onlyDiamond` guard: callback only from the registered Diamond address |
| 2 | Fake answer | Corrupt a receipt's answer | Receipt written once, `locked` permanently; answer is a commitment |
| 3 | Frontend compromise | Rewrite history | Frontend has no write path to receipts; chain is canonical |
| 4 | Database compromise | Rewrite history | No authoritative DB; receipts read from chain |
| 5 | Malicious RPC | Lie about receipt state | CLI verifier + UI support independent RPCs; block/chain-id sanity checks |
| 6 | Malicious miner | Return false answer | OUT OF SCOPE by design — Telegraph's validators score miners; DOCKET records, doesn't arbitrate truth |
| 7 | Compromised admin/owner | Rewrite receipts | Admin cannot mutate a `locked` receipt; owner only labels intents + withdraws stray |
| 8 | Duplicate callback | Double-mint / overwrite | `AlreadyMinted` on second resolve; mock + contract both enforce |
| 9 | Reentrancy | Drain escrow | Callback does a single write + emit, no external calls (CEI) |
| 10 | User submits malicious answer payload | XSS/injection | Frontend treats answers as untrusted; no dangerouslySetInnerHTML |

## Protocol-failure analysis
- Job never resolves (miner offline): job stays Funded on the Diamond; escrow recoverable via `cancelJob`. Receipt never mints. User is not double-charged.
- Callback reverts: the real protocol SWALLOWS callback reverts (docs) — the job still settles and the miner is paid; the receipt may not mint. DOCKET's read side can still reconstruct from the resolving tx calldata. Documented limitation.
- Diamond upgraded externally: DOCKET's registry holds an immutable reference; a Diamond change does not mutate existing receipts. New jobs route to whatever the Diamond then does — a documented external dependency.
- Chain reorg: receipt could be dropped if shallow; on a reorg the read side re-reads from the canonical chain. No local state to corrupt.

## Privilege matrix
| Function | Caller | Effect |
|---|---|---|
| `requestVerification` | Anyone (user pays) | Escrow + create job |
| `subnetMessage` (callback) | Diamond ONLY | Mint + lock receipt |
| `nameIntent` | Owner | Label intent (cosmetic) |
| `withdrawStray` | Owner | Recover stray USDC (never escrowed job funds) |
