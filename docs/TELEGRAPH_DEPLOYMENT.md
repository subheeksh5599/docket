# TELEGRAPH_DEPLOYMENT.md — verified on-chain deployment facts (source of truth)

**Every value below was read LIVE from the chain on 2026-09-02 via public RPC + Blockscout,**
**not copied from docs.** Re-verify with the commands shown before any deploy.

## Chain
| Item | Value |
|---|---|
| Network | Base Sepolia |
| Chain ID | 84532 (`0x14a34`) |
| Public RPC (works) | `https://sepolia.base.org` |
| Public RPC (fallback) | `https://base-sepolia-rpc.publicnode.com`, `https://base-sepolia.drpc.org` |

## Telegraph Diamond (ERC-2535 diamond proxy)
| Item | Value |
|---|---|
| Diamond address | `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8` |
| Runtime code | 287 bytes (EIP-2535 reference fallback) |
| Facets | 21 (`facets()` = 0x15) |
| Verified on Blockscout | Yes (Diamond.sol, solc 0.8.30) |

### Live-read getters (eth_call, 2026-09-02)
```bash
# getJobBasePrice() -> 1000000 (1 USDC per ERC-8183 job)
curl -s -X POST https://sepolia.base.org -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8","data":"0xd971c5d4"},"latest"],"id":1}'
# => 0x...f4240

# usdcToken() -> 0x036CbD53842c5426634e7929541eC2318f3dCF7e
# getTreasury() -> 0xffe89e1f0a77C600Ad938b57180E5be3e3119f40
```

## Registered ERC-8183 / job selectors (from loupe facets(), facet 11)
Confirmed present in the live selector set:
| Function | Selector |
|---|---|
| `depositUSDC(uint256)` | `0xf688bcfb` |
| `escrowBalance(address)` | `0x55af6353` |
| `createJob(...)` | `0xfce99037` |
| `cancelJob(uint256)` | `0x1dffa3dc` |
| `transitionToTerminal(...)` | `0x07098705` |
| `getJob(uint256)` | `0xbf22c457` |
| `getJobBasePrice()` | `0xd971c5d4` |
| `subnetMessage` callback signature | `0xc823e530` |

## USDC (Circle canonical on Base Sepolia)
`0x036CbD53842c5426634e7929541eC2318f3dCF7e` — confirmed from `usdcToken()`.

## Intent encoding (docs)
- Intent ID for `createJob` Option A = `keccak256("INTENT_NAME")` (e.g. `keccak256("CRYPTO_PRICE")`).
- Canonical intent list is on-chain (`getCanonicalIntents()`); verify live before registering intents.

## Verification commands (re-run before any deploy)
```bash
curl -s -X POST https://sepolia.base.org -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8","latest"],"id":1}' # non-empty
# + the three getter calls above
```

## Caveat (current testnet operational state)
The docs state Base Sepolia is currently a single-signer genesis node — full 43/64 BFT validator
consensus is NOT active on this testnet. DOCKET's receipts record what the network returned; they
do not claim mainnet-grade BFT finality. See README "current testnet honesty".
