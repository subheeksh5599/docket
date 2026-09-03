#!/usr/bin/env bash
# DOCKET live smoke — deploy + real ERC-8183 job end-to-end on Base Sepolia.
# Requires: funded deployer (ETH for gas + USDC for the job), forge, cast.
# Usage: ./scripts/live-smoke.sh
set -euo pipefail

RPC="${RPC_URL:-https://sepolia.base.org}"
DIAMOND="0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
USDC="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
PRIVKEY="0x$(tail -1 "$(dirname "$0")/../.secrets/deployer.txt")"
DEPLOYER="$(head -1 "$(dirname "$0")/../.secrets/deployer.txt")"

echo "=== DOCKET live smoke ==="
echo "chain: Base Sepolia | rpc: $RPC"
echo "deployer: $DEPLOYER"

# 0) sanity: chain id + balances
CHAIN=$(cast chain-id --rpc-url "$RPC")
[ "$CHAIN" = "84532" ] || { echo "FATAL: wrong chain $CHAIN (want 84532)"; exit 1; }
BAL_ETH=$(cast balance "$DEPLOYER" --rpc-url "$RPC")
BAL_USDC_DEC=$(cast call "$USDC" "balanceOf(address)(uint256)" "$DEPLOYER" --rpc-url "$RPC" 2>/dev/null | grep -oE "^[0-9]+" | head -1)
echo "ETH:  $(cast from-wei "$BAL_ETH")"
echo "USDC: $(python3 -c "print(int('$BAL_USDC_DEC')/1e6)")"
[ -n "$BAL_USDC_DEC" ] || { echo "FATAL: could not read USDC"; exit 1; }
[ "$BAL_ETH" != "0" ] || { echo "FATAL: no ETH"; exit 1; }
[ "$BAL_USDC_DEC" != "0" ] && [ -n "$BAL_USDC_DEC" ] || { echo "FATAL: no USDC"; exit 1; }

# 1) deploy ReceiptRegistry
echo "--- deploy ReceiptRegistry ---"
DEPLOY_OUT=$(PRIVATE_KEY="$PRIVKEY" forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast 2>&1)
echo "$DEPLOY_OUT" | grep -E "ReceiptRegistry deployed|owner|diamond|usdc|Error" | head
REGISTRY=$(echo "$DEPLOY_OUT" | grep -oE "ReceiptRegistry deployed at: 0x[0-9a-fA-F]{40}" | grep -oE "0x[0-9a-fA-F]{40}")
[ -n "$REGISTRY" ] || { echo "FATAL: deploy failed"; echo "$DEPLOY_OUT" | tail -20; exit 1; }
echo "registry: $REGISTRY"
# verify on-chain
CODE=$(cast code "$REGISTRY" --rpc-url "$RPC")
[ -n "$CODE" ] && [ "$CODE" != "0x" ] || { echo "FATAL: no code at registry"; exit 1; }
echo "registry code: OK ($((${#CODE}-2)/2) bytes)"

# 2) approve USDC to registry (job price 1 USDC = 1_000_000 raw; approve 2 USDC for headroom)
echo "--- approve USDC ---"
cast send "$USDC" "approve(address,uint256)" "$REGISTRY" 2000000 \
  --rpc-url "$RPC" --private-key "$PRIVKEY" >/dev/null
echo "approved 2 USDC to registry"

# 3) fund escrow + createJob via the registry (CRYPTO_PRICE intent)
echo "--- create ERC-8183 job (CRYPTO_PRICE) ---"
INTENT=$(cast keccak "CRYPTO_PRICE")
TX=$(cast send "$REGISTRY" \
  "requestVerification(bytes32,(address[],uint256[],string[],bool[]),string,uint256)" \
  "$INTENT" '([],[],["What is the current price of BTC?"],[])' "What is the current price of BTC?" 2000000 \
  --rpc-url "$RPC" --private-key "$PRIVKEY" --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['transactionHash'])")
echo "request tx: $TX"
sleep 2
# read the job id back from logs (ReceiptRegistry emits JobRequested(jobId,...)) — decode via getJob? we don't have jobId; read via jobsOf
JOBID=$(cast call "$REGISTRY" "jobsOf(address,uint256)(uint256)" "$DEPLOYER" 0 --rpc-url "$RPC" 2>/dev/null || echo "pending")
echo "job id: $JOBID"

echo "--- waiting for real miner + callback (polling up to 120s) ---"
for i in $(seq 1 24); do
  sleep 5
  RESOLVED=$(cast call "$REGISTRY" "getReceipt(uint256)" "$JOBID" --rpc-url "$RPC" 2>/dev/null | tr -d '[:space:]' || echo "")
  if [ -n "$RESOLVED" ] && [ "$RESOLVED" != "()" ]; then
    echo "RECEIPT MINTED after ~$((i*5))s"
    echo "receipt: $RESOLVED"
    break
  fi
  echo "  ...waiting ($((i*5))s)"
done

echo "=== done ==="
echo "registry: $REGISTRY"
echo "explorer: https://sepolia.basescan.org/address/$REGISTRY"
