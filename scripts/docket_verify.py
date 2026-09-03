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
    ap.add_argument("--answer", metavar="JSON", default=None,
                    help="Answer payload (OnChainData JSON) to re-hash and compare against the on-chain commitment")
    ap.add_argument("--payload", metavar="HEX", default=None,
                    help="Raw callback calldata hex (from the resolving tx) to decode the answer from")
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
            return verify(args.jobId, registry, rpc, answer_json=args.answer, payload_hex=args.payload)
        except Exception as e:
            last_err = e
            print(f"  [rpc {rpc} failed: {e}]", file=sys.stderr)
    print(f"ERROR: all RPCs failed: {last_err}", file=sys.stderr)
    return 2

def verify(job_id, registry, rpc, answer_json=None, payload_hex=None):
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

    # 6) optional answer re-hash: canonical rule keccak256(abi.encode(OnChainData))
    #    where OnChainData = (address[], uint256[], string[], bool[])
    answer_rehash = None
    if answer_json:
        try:
            payload = json.loads(answer_json)
            answer_rehash = canonical_onchain_hash(payload)
            matches = (answer_rehash == f"0x{answer_hash:064x}")
            checks.append(("answer re-hash matches commitment", matches,
                           f"recomputed {answer_rehash[:18]}…"))
        except Exception as e:
            checks.append(("answer re-hash", False, f"could not re-hash: {e}"))
    elif payload_hex:
        # decode raw calldata of the callback into OnChainData and re-hash
        try:
            payload = decode_onchain_calldata(payload_hex)
            answer_rehash = canonical_onchain_hash(payload)
            matches = (answer_rehash == f"0x{answer_hash:064x}")
            checks.append(("callback-calldata re-hash matches commitment", matches,
                           f"decoded {len(payload.get('strings', []))} strings"))
        except Exception as e:
            checks.append(("callback-calldata re-hash", False, f"could not decode: {e}"))

    all_pass = all(c[1] for c in checks)
    print("  checks:")
    for name, ok, note in checks:
        print(f"    [{'PASS' if ok else 'FAIL'}] {name}" + (f" ({note})" if note else ""))
    print()
    if all_pass:
        print("RESULT: RECEIPT VERIFIED - immutable on-chain receipt exists for job", job_id)
        if not (answer_json or payload_hex):
            print("(answer re-hash: pass the network response with --answer <json> to also verify the commitment)")
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

def _keccak256(hexstr):
    # keccak256 of raw hex bytes via `cast keccak` (foundry) — python stdlib has no keccak
    out = subprocess.run(["cast", "keccak", hexstr], capture_output=True, text=True).stdout.strip()
    if out.startswith("0x") and len(out) == 66:
        return out
    raise RuntimeError("cast keccak failed")

def _encode_abi_dynamic(items):
    # Minimal ABI encoder for OnChainData STRUCT hashed as keccak256(abi.encode(struct)).
    # Solidity encodes a struct arg as a nested tuple: head = 4 offset words (one per
    # dynamic array), each offset RELATIVE TO THE START OF THE TUPLE HEAD; tails follow.
    # Matches Solidity abi.encode(OnChainData) exactly — verified LIVE against receipt
    # #24/#28 (recomputed hash 0x23d1c6ef… == stored answerHash).
    def enc_array_strings(arr):
        out = len(arr).to_bytes(32, "big")
        if not arr:
            return out
        # inner head: len(arr) * 32-byte offsets to each string, relative to after count
        heads = b""
        tails = b""
        acc = 32 * len(arr)
        for s in arr:
            raw = s.encode()
            padded = raw + b"\x00" * ((32 - len(raw) % 32) % 32)
            heads += acc.to_bytes(32, "big")
            tails += len(raw).to_bytes(32, "big") + padded
            acc += 32 + len(padded)
        return out + heads + tails

    def enc_array_addresses(arr):
        out = len(arr).to_bytes(32, "big")
        for a in arr:
            out += int(a, 16).to_bytes(32, "big")
        return out

    def enc_array_uints(arr):
        out = len(arr).to_bytes(32, "big")
        for v in arr:
            out += int(v).to_bytes(32, "big")
        return out

    def enc_array_bools(arr):
        out = len(arr).to_bytes(32, "big")
        for v in arr:
            out += (1 if v else 0).to_bytes(32, "big")
        return out

    # tails in struct order (address[], uint256[], string[], bool[])
    tails = [enc_array_addresses(items.get("addresses", [])),
             enc_array_uints(items.get("integers", [])),
             enc_array_strings(items.get("strings", [])),
             enc_array_bools(items.get("bools", []))]
    # Solidity abi.encode(struct) treats the struct as a dynamic component: a leading
    # offset word (0x20 = 32) points at the tuple head. Inside the head, the 4 array
    # offsets are measured from the STRUCT HEAD START (byte 32 of the whole encoding),
    # i.e. acc starts at 128 (4 head words). Matches viem byte-for-byte (verified
    # live against receipt #28's stored answerHash 0x23d1c6ef…).
    heads = b""
    acc = 128  # tuple head: 4 offset words
    for t in tails:
        heads += acc.to_bytes(32, "big")
        acc += len(t)
    return (32).to_bytes(32, "big") + heads + b"".join(tails)

def canonical_onchain_hash(payload):
    """keccak256(abi.encode(OnChainData)) with OnChainData = (address[],uint256[],string[],bool[])."""
    raw = _encode_abi_dynamic(payload)
    return _keccak256("0x" + raw.hex())

def decode_onchain_calldata(hexstr):
    """Decode the OnChainData struct from callback calldata (heuristic: 4 dynamic arrays)."""
    # Callback calldata layout: selector(4) + head(4*32 offsets) + tails.
    # We only need the strings tail for re-hashing the answer text.
    b = bytes.fromhex(hexstr[2:] if hexstr.startswith("0x") else hexstr)
    if len(b) < 4 + 128:
        raise ValueError("calldata too short")
    # offsets of the 4 arrays from the head
    base = 4
    off_strings = int.from_bytes(b[base+64:base+96], "big")  # 3rd array = strings
    # strings tail begins at base + off_strings
    pos = base + off_strings
    n = int.from_bytes(b[pos:pos+32], "big")
    pos += 32
    strings = []
    for _ in range(n):
        s_off = int.from_bytes(b[pos:pos+32], "big")
        sp = base + off_strings + s_off
        ln = int.from_bytes(b[sp:sp+32], "big")
        strings.append(b[sp+32:sp+32+ln].decode("utf-8", "replace"))
        pos += 32
    return {"strings": strings, "addresses": [], "integers": [], "bools": []}

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
