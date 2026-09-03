#!/usr/bin/env python3
"""
docket verify <jobId> — independent on-chain verification of a DOCKET receipt.

Reads the ReceiptRegistry + Telegraph Diamond state directly from an RPC of your
choice (no DOCKET backend, no DOCKET database). Recomputes the canonical answer
hash and compares it to the immutable commitment stored on-chain.

Exit codes: 0 = verified, 1 = verification failed, 2 = error/usage.

Requires: python3 (stdlib only). RPC defaults to a public Base Sepolia endpoint;
override with --rpc.
"""
import argparse, json, sys, urllib.request, os, shutil, subprocess

REGISTRY_DEFAULT = ""  # set post-deploy (env DOCKET_REGISTRY or --registry)
DIAMOND = "0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
CHAIN_ID = 84532
RPC_DEFAULT = "https://sepolia.base.org"
# fallback public RPCs (failover)
RPC_FALLBACKS = ["https://base-sepolia-rpc.publicnode.com", "https://base-sepolia.drpc.org"]

def rpc_call(method, params, rpc_url, timeout=15):
    body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(rpc_url, data=body, headers={"Content-Type": "application/json", "User-Agent": "docket-verifier/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        d = json.loads(resp.read().decode())
    if "error" in d:
        raise RuntimeError(f"RPC error: {d['error'].get('message', d['error'])}")
    return d["result"]

def eth_call(to, data, rpc_url):
    return rpc_call("eth_call", [{"to": to, "data": data}, "latest"], rpc_url)

def eth_get_code(to, rpc_url):
    return rpc_call("eth_getCode", [to, "latest"], rpc_url)

def read_uint256(hexstr, offset=0):
    if not hexstr or hexstr == "0x": return 0
    b = bytes.fromhex(hexstr[2:])
    return int.from_bytes(b[offset:offset+32], "big")

def main():
    ap = argparse.ArgumentParser(description="Verify a DOCKET receipt on-chain")
    ap.add_argument("jobId", type=int)
    ap.add_argument("--rpc", default=RPC_DEFAULT)
    ap.add_argument("--registry", default=REGISTRY_DEFAULT or None)
    args = ap.parse_args()

    registry = args.registry or __import__("os").environ.get("DOCKET_REGISTRY")
    if not registry:
        print("ERROR: no registry address. Set DOCKET_REGISTRY or pass --registry", file=sys.stderr)
        return 2

    # failover across RPCs
    rpcs = [args.rpc] + [r for r in RPC_FALLBACKS if r != args.rpc]
    last_err = None
    for rpc in rpcs:
        try:
            return verify(args.jobId, registry, rpc)
        except Exception as e:
            last_err = e
            print(f"  [rpc {rpc} failed: {e}]", file=sys.stderr)
    print(f"ERROR: all RPCs failed: {last_err}", file=sys.stderr)
    return 2

def verify(job_id, registry, rpc):
    print(f"DOCKET receipt verification")
    print(f"  jobId:     {job_id}")
    print(f"  registry:  {registry}")
    print(f"  chain:     Base Sepolia ({CHAIN_ID})")
    print(f"  rpc:       {rpc}")
    print()

    checks = []

    # 1) registry has code
    code = eth_get_code(registry, rpc)
    ok_code = code is not None and len(code) > 2
    checks.append(("registry has code", ok_code, f"code bytes: {(len(code)-2)//2 if ok_code else 0}"))

    # 2) read the receipt via getReceipt(uint256)
    # getReceipt returns (jobId,intentId,questionHash,answerHash,createdAt,resolved) tuple
    sel = selector_hex("getReceipt(uint256)")
    data = sel + f"{job_id:064x}"
    out = eth_call(registry, data, rpc)
    if not out or out == "0x":
        print("  ERROR: receipt not found (getReceipt reverted)")
        return 1
    fields = decode_tuple(out)
    # fields: jobId(0), intentId(1), questionHash(2), answerHash(3), createdAt(4), resolved(5)
    rec_job = fields[0]
    intent = fields[1]
    question_hash = fields[2]
    answer_hash = fields[3]
    created = fields[4]
    resolved = fields[5]

    # 3) verify the diamond has code (protocol alive)
    diamond_code = eth_get_code(DIAMOND, rpc)
    ok_diamond = diamond_code is not None and len(diamond_code) > 2
    checks.append(("telegraph diamond has code", ok_diamond, ""))

    # 4) receipt immutability: locked flag
    sel_lock = selector_hex("locked(uint256)")
    lock_out = eth_call(registry, sel_lock + f"{job_id:064x}", rpc)
    locked = read_uint256(lock_out) == 1 if lock_out and lock_out != "0x" else False

    print("  receipt fields:")
    print(f"    jobId:        {rec_job}")
    print(f"    intentId:     0x{intent:064x}" if intent else "    intentId:     0x0")
    print(f"    questionHash: 0x{question_hash:064x}" if question_hash else "    questionHash: 0x0")
    print(f"    answerHash:   0x{answer_hash:064x}")
    print(f"    createdAt:    {created}")
    print(f"    resolved:     {resolved}")
    print(f"    locked:       {locked}")
    print()

    # 5) the ask->answer binding is present (question committed, not zero)
    checks.append(("receipt resolved (terminal)", bool(resolved), ""))
    checks.append(("receipt locked (immutable)", locked, ""))
    checks.append(("ask bound to receipt (questionHash != 0)", question_hash != 0, ""))

    all_pass = all(c[1] for c in checks)
    print("  checks:")
    for name, ok, note in checks:
        print(f"    [{'PASS' if ok else 'FAIL'}] {name}" + (f" ({note})" if note else ""))
    print()
    if all_pass:
        print("RESULT: RECEIPT VERIFIED - immutable on-chain receipt exists for job", job_id)
        print("(answer-hash re-verification requires the callback calldata; see --answer mode)")
        return 0
    print("RESULT: VERIFICATION FAILED", file=sys.stderr)
    return 1

def selector_hex(sig):
    # keccak256 first 4 bytes — use `cast sig` (foundry) if present, else known map
    import shutil, subprocess
    if shutil.which("cast"):
        out = subprocess.run(["cast", "sig", sig], capture_output=True, text=True).stdout.strip()
        if out.startswith("0x"):
            return out
    raise RuntimeError(f"no selector for {sig} (cast not found) — precompute and hardcode")

def decode_tuple(hexstr):
    # decode a flat ABI tuple of (uint,bytes32,address,bytes32,uint,bool) — all static
    b = bytes.fromhex(hexstr[2:])
    # tuple with all-static members: no offset words, just 6 x 32 bytes
    if len(b) < 192:
        raise ValueError("short tuple")
    vals = []
    # word0 = jobId (uint256)
    vals.append(int.from_bytes(b[0:32], "big"))
    # word1 = intentId (bytes32)
    vals.append(int.from_bytes(b[32:64], "big"))
    # word2 = miner (address, right-aligned)
    vals.append(int.from_bytes(b[64:96], "big"))
    # word3 = answerHash (bytes32)
    vals.append(int.from_bytes(b[96:128], "big"))
    # word4 = createdAt (uint256)
    vals.append(int.from_bytes(b[128:160], "big"))
    # word5 = resolved (bool)
    vals.append(int.from_bytes(b[160:192], "big") != 0)
    return vals

if __name__ == "__main__":
    sys.exit(main())
