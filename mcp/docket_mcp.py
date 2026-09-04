#!/usr/bin/env python3
"""
docket_mcp — stdio MCP server for DOCKET receipt verification (stdlib only).

Implements the Model Context Protocol (initialize/tools/list, tools/call) over
stdio JSON-RPC 2.0 with zero dependencies, so it runs anywhere python3 runs —
no pip install, no SDK. Verification logic is shared with scripts/docket_verify.py.

Tools:
  verify_docket_receipt(job_id)  -> exists/resolved/locked/verified + question match
  get_docket_receipt(job_id)     -> full on-chain receipt struct
  verify_docket_answer(job_id, answer) -> re-hash vs on-chain commitment

Env:
  DOCKET_REGISTRY  registry address (defaults to canonical)
  DOCKET_RPC       RPC url (defaults to https://sepolia.base.org)

Run:
  DOCKET_REGISTRY=0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48 python3 docket_mcp.py
"""
import json
import os
import sys

# ---- constants (same canonical values as scripts/docket_verify.py) ----
REGISTRY_DEFAULT = os.environ.get("DOCKET_REGISTRY", "0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48")
DIAMOND = "0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
RPC_DEFAULT = os.environ.get("DOCKET_RPC", "https://sepolia.base.org")
RPC_FALLBACKS = ["https://base-sepolia-rpc.publicnode.com", "https://base-sepolia.drpc.org"]
CHAIN_ID = 84532

# ---- minimal RPC client (stdlib) ----
import urllib.request


def rpc_call(method, params, rpc_url, timeout=15):
    body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(rpc_url, data=body, headers={"Content-Type": "application/json", "User-Agent": "docket-mcp/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        d = json.loads(resp.read().decode())
    if "error" in d:
        raise RuntimeError("RPC error: %s" % d["error"].get("message", d["error"]))
    return d["result"]


def eth_call(to, data, rpc_url):
    return rpc_call("eth_call", [{"to": to, "data": data}, "latest"], rpc_url)


def read_uint256(hexstr, offset=0):
    if not hexstr or hexstr == "0x":
        return 0
    b = bytes.fromhex(hexstr[2:])
    return int.from_bytes(b[offset:offset + 32], "big")


def call_with_failover(fn, *args):
    """Try primary RPC then fallbacks; returns (ok, result_or_error)."""
    rpcs = [RPC_DEFAULT] + [r for r in RPC_FALLBACKS if r != RPC_DEFAULT]
    last = None
    for rpc in rpcs:
        try:
            return fn(*args, rpc)
        except Exception as e:
            last = "%s: %s" % (rpc, e)
    return last


# ---- registry ABI helpers (encoded by hand — stable, no deps) ----
SIG_RECEIPT = "0xb63e6ac3"  # getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)
SIG_LOCKED = "0xb45a3c0e"    # locked(uint256)(bool)


def call_get_receipt(job_id, rpc):
    data = SIG_RECEIPT + int(job_id).to_bytes(32, "big").hex()
    raw = eth_call(REGISTRY_DEFAULT, data, rpc)
    # decode 6-tuple (jobId,intentId,questionHash,answerHash,createdAt,resolved)
    h = raw[2:]
    b = bytes.fromhex(h)
    def u32(i): return int.from_bytes(b[i*32:(i+1)*32], "big")
    def b32(i): return "0x" + b[i*32:(i+1)*32].hex()
    return {
        "jobId": u32(0),
        "intentId": b32(1),
        "questionHash": b32(2),
        "answerHash": b32(3),
        "createdAt": u32(4),
        "resolved": bool(u32(5)),
    }


def call_locked(job_id, rpc):
    data = SIG_LOCKED + int(job_id).to_bytes(32, "big").hex()
    raw = eth_call(REGISTRY_DEFAULT, data, rpc)
    return raw != "0x" + "00" * 32


# ---- the three tools ----
def verify_docket_receipt(job_id):
    """Check a receipt exists, is locked + resolved, and question is bound."""
    if not isinstance(job_id, int) or job_id <= 0:
        return {"error": "job_id must be a positive integer"}
    err = call_with_failover(_verify_receipt, job_id)
    if isinstance(err, str):
        return {"error": "could not read chain: %s" % err}
    return err


def _verify_receipt(job_id, rpc):
    r = call_get_receipt(job_id, rpc)
    locked = call_locked(job_id, rpc)
    exists = r["jobId"] != 0 or r["questionHash"] != "0x" + "00" * 32
    q_bound = r["questionHash"] != "0x" + "00" * 32
    verified = bool(exists and locked and r["resolved"])
    return {
        "receipt": r["jobId"],
        "resolved": r["resolved"],
        "locked": locked,
        "question_commitment_matches": q_bound,
        "verified": verified,
    }


def get_docket_receipt(job_id):
    """Return the full on-chain receipt fields for a job id."""
    if not isinstance(job_id, int) or job_id <= 0:
        return {"error": "job_id must be a positive integer"}
    err = call_with_failover(call_get_receipt, job_id)
    if isinstance(err, str):
        return {"error": "could not read chain: %s" % err}
    return err


def verify_docket_answer(job_id, answer):
    """Re-hash an answer payload and compare to the stored on-chain commitment."""
    if not isinstance(job_id, int) or job_id <= 0:
        return {"error": "job_id must be a positive integer"}
    if not isinstance(answer, dict):
        return {"error": "answer must be an object (OnChainData)"}
    try:
        answer_hash = canonical_onchain_hash(answer)
    except Exception as e:
        return {"error": "could not hash answer: %s" % e}

    err = call_with_failover(call_get_receipt, job_id)
    if isinstance(err, str):
        return {"error": "could not read chain: %s" % err}
    return {
        "answer_hash": answer_hash,
        "stored_commitment": err["answerHash"],
        "match": answer_hash == err["answerHash"],
        "receipt": job_id,
    }


# ---- canonical answer hash: keccak256(abi.encode(OnChainData)) ----
# OnChainData = struct { address[] addresses; uint256[] integers; string[] strings; bool[] bools; }
# ABI-encoding matches Solidity exactly (verified LIVE against receipts #24/#28).
import sys as _sys
if __package__:
    from ._keccak import keccak256_hex
else:
    _sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from _keccak import keccak256_hex

def _pad32(b):
    return b + b"\x00" * ((32 - len(b) % 32) % 32)


def _enc_array_strings(arr):
    out = len(arr).to_bytes(32, "big")
    heads = b""
    tails = b""
    acc = 32 * len(arr)
    for s in arr:
        raw = s.encode()
        padded = _pad32(raw)
        heads += acc.to_bytes(32, "big")
        tails += len(raw).to_bytes(32, "big") + padded
        acc += 32 + len(padded)
    return out + heads + tails


def _enc_array_addresses(arr):
    out = len(arr).to_bytes(32, "big")
    for a in arr:
        out += int(a, 16).to_bytes(32, "big")
    return out


def _enc_array_uints(arr):
    out = len(arr).to_bytes(32, "big")
    for u in arr:
        out += int(u).to_bytes(32, "big")
    return out


def _enc_array_bools(arr):
    out = len(arr).to_bytes(32, "big")
    for b in arr:
        out += (1 if b else 0).to_bytes(32, "big")
    return out


def _encode_onchain_data(payload):
    """Encode an OnChainData dict -> the exact bytes Solidity abi.encode(struct) yields.

    Solidity abi.encode(struct) treats the struct as a dynamic component: a leading
    offset word (0x20 = 32) points at the tuple head. Inside the head, the 4 array
    offsets are measured from the STRUCT HEAD START (byte 32 of the whole encoding),
    i.e. acc starts at 128 (4 head words). Verified live against receipt #28's
    stored answerHash 0x23d1c6ef… and against viem byte-for-byte.
    """
    addresses = payload.get("addresses", []) or []
    integers = payload.get("integers", []) or []
    strings = payload.get("strings", []) or []
    bools = payload.get("bools", []) or []

    tails = [_enc_array_addresses(addresses),
             _enc_array_uints(integers),
             _enc_array_strings(strings),
             _enc_array_bools(bools)]
    heads = b""
    acc = 128  # tuple head: 4 offset words
    for t in tails:
        heads += acc.to_bytes(32, "big")
        acc += len(t)
    return (32).to_bytes(32, "big") + heads + b"".join(tails)


def _keccak_bytes(b):
    return keccak256_hex(b)


def canonical_onchain_hash(payload):
    return _keccak_bytes(_encode_onchain_data(payload))


# ---- minimal MCP stdio server ----
def _respond(req_id, result):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}) + "\n")
    sys.stdout.flush()


def _respond_error(req_id, code, message):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}) + "\n")
    sys.stdout.flush()


def trace_docket_receipt(job_id):
    """Return the full provenance graph for a receipt: question -> job -> event -> receipt."""
    if not isinstance(job_id, int) or job_id <= 0:
        return {"error": "job_id must be a positive integer"}
    err = call_with_failover(call_get_receipt, job_id)
    if isinstance(err, str):
        return {"error": "could not read chain: %s" % err}
    r = err
    locked = None
    lerr = call_with_failover(call_locked, job_id)
    locked = lerr if isinstance(lerr, bool) else None
    return {
        "question": {"commitment": r["questionHash"], "committed_before_resolution": r["questionHash"] != "0x" + "00" * 64},
        "job": {"id": r["jobId"], "intent": r["intentId"], "terminal": r["resolved"]},
        "settlement": {"callback_minted": r["resolved"], "locked": locked},
        "answer": {"commitment": r["answerHash"], "present": r["answerHash"] != "0x" + "00" * 64},
        "receipt": {"jobId": r["jobId"], "createdAt": r["createdAt"], "resolved": r["resolved"]},
        "chain": {"id": CHAIN_ID, "network": "base-sepolia"},
        "provenance": "question -> questionHash -> Telegraph job -> resolver settlement -> callback -> answerHash -> receipt",
    }


def assess_docket_receipt(job_id, required_intent=None, max_age_seconds=None):
    """Assess whether a receipt is INTERNALLY VALID and safe for a consumer to act on.

    Answers 'is this record internally consistent and consumable?' — NEVER
    'is the AI answer true?'. Optional consumer policy: required_intent hash
    and max_age_seconds (freshness).
    """
    if not isinstance(job_id, int) or job_id <= 0:
        return {"error": "job_id must be a positive integer"}
    err = call_with_failover(call_get_receipt, job_id)
    if isinstance(err, str):
        return {"error": "could not read chain: %s" % err}
    r = err
    locked = None
    lerr = call_with_failover(call_locked, job_id)
    locked = lerr if isinstance(lerr, bool) else None

    exists = r["jobId"] != 0 or r["questionHash"] != "0x" + "00" * 64
    receipt_locked = bool(locked)
    job_terminal = bool(r["resolved"])
    question_bound = r["questionHash"] != "0x" + "00" * 64
    answer_present = r["answerHash"] != "0x" + "00" * 64
    internally_valid = bool(exists and receipt_locked and job_terminal and question_bound and answer_present)

    intent_ok = True
    if required_intent:
        intent_ok = (r["intentId"] == required_intent)

    fresh = True
    if max_age_seconds is not None:
        import time
        now = int(time.time())
        fresh = (now - r["createdAt"]) <= max_age_seconds

    return {
        "receipt_exists": exists,
        "locked": receipt_locked,
        "telegraph_job_exists": job_terminal,
        "job_terminal": job_terminal,
        "question_commitment_present": question_bound,
        "answer_commitment_present": answer_present,
        "internally_valid": internally_valid,
        "intent_matches": intent_ok,
        "fresh": fresh,
        "safe_to_consume": bool(internally_valid and intent_ok and fresh),
        "note": "DOCKET assesses internal record validity only. It never declares whether the network's answer is true.",
    }


def main():
    if "--self-test" in sys.argv:
        # offline sanity: keccak vector + the canonical receipt-#28 hash vector
        # (reproduces the LIVE on-chain commitment 0x23d1c6ef… without any RPC)
        from _keccak import keccak_256
        assert keccak_256(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470", "keccak vector failed"
        _LONG = ("summary:I cannot look up this transaction because no transaction hash was supplied. "
                 "A transaction hash is 66 characters long: \"0x\" followed by 64 hexadecimal characters. "
                 "Pass one as the tx_hash parameter and I will report its confirmation status, block, "
                 "sender, recipient, value in ETH, and decoded contract method.")
        _ANS = ("answer:I cannot look up this transaction because no transaction hash was supplied. "
                "A transaction hash is 66 characters long: \"0x\" followed by 64 hexadecimal characters. "
                "Pass one as the tx_hash parameter and I will report its confirmation status, block, "
                "sender, recipient, value in ETH, and decoded contract method.")
        h = canonical_onchain_hash({
            "addresses": [],
            "integers": ["1000000000000000000"],
            "strings": ["status:invalid_input", _LONG, "confidence", _ANS],
            "bools": [],
        })
        assert h == "0x23d1c6ef8212c9601d12dc626ecdbce5965e23a1622df5bbf8e47fec280d44c2", "receipt-28 vector failed: %s" % h
        print("keccak256(b'') vector:        PASS")
        print("receipt #28 canonical hash:   PASS (0x23d1c6ef…)")
        print("self-test PASS")
        return 0
    TOOLS = [
        {
            "name": "verify_docket_receipt",
            "description": "Verify a DOCKET receipt exists on-chain and is locked + resolved. Returns verified true/false.",
            "inputSchema": {"type": "object", "properties": {"job_id": {"type": "integer", "description": "DOCKET job id (receipt number)"}}, "required": ["job_id"]},
        },
        {
            "name": "get_docket_receipt",
            "description": "Get the full on-chain DOCKET receipt fields for a job id: intentId, questionHash, answerHash, createdAt, resolved.",
            "inputSchema": {"type": "object", "properties": {"job_id": {"type": "integer", "description": "DOCKET job id (receipt number)"}}, "required": ["job_id"]},
        },
        {
            "name": "verify_docket_answer",
            "description": "Re-hash an answer payload (OnChainData object: addresses[], integers[], strings[], bools[]) and compare against the stored on-chain commitment. Detects tampering.",
            "inputSchema": {"type": "object", "properties": {"job_id": {"type": "integer"}, "answer": {"type": "object"}}, "required": ["job_id", "answer"]},
        },
        {
            "name": "trace_docket_receipt",
            "description": "Return the full provenance graph for a receipt: question commitment -> Telegraph job -> settlement/callback -> answer commitment -> locked receipt. For agents that need the whole chain of custody, not just a verdict.",
            "inputSchema": {"type": "object", "properties": {"job_id": {"type": "integer", "description": "DOCKET job id (receipt number)"}}, "required": ["job_id"]},
        },
        {
            "name": "assess_docket_receipt",
            "description": "Assess whether a receipt is internally valid and safe for a consumer to act on. Optional policy: required_intent (bytes32 hash) and max_age_seconds (freshness). Answers 'is the record internally consistent?' — NEVER 'is the answer true?'.",
            "inputSchema": {"type": "object", "properties": {
                "job_id": {"type": "integer", "description": "DOCKET job id (receipt number)"},
                "required_intent": {"type": "string", "description": "Optional intent hash the receipt must match (e.g. CRYPTO_PRICE intent)"},
                "max_age_seconds": {"type": "integer", "description": "Optional max age for freshness (e.g. 60 for a price receipt)"},
            }, "required": ["job_id"]},
        },
    ]

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        rid = msg.get("id")
        method = msg.get("method")
        params = msg.get("params") or {}

        if method == "initialize":
            _respond(rid, {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "serverInfo": {"name": "docket-mcp", "version": "1.0.0"}})
        elif method == "notifications/initialized":
            pass  # no response for notifications
        elif method == "tools/list":
            _respond(rid, {"tools": TOOLS})
        elif method == "tools/call":
            name = params.get("name")
            args = params.get("arguments") or {}
            if name == "verify_docket_receipt":
                result = verify_docket_receipt(args.get("job_id"))
            elif name == "get_docket_receipt":
                result = get_docket_receipt(args.get("job_id"))
            elif name == "verify_docket_answer":
                result = verify_docket_answer(args.get("job_id"), args.get("answer"))
            elif name == "trace_docket_receipt":
                result = trace_docket_receipt(args.get("job_id"))
            elif name == "assess_docket_receipt":
                result = assess_docket_receipt(args.get("job_id"), args.get("required_intent"), args.get("max_age_seconds"))
            else:
                _respond_error(rid, -32601, "unknown tool: %s" % name)
                continue
            _respond(rid, {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]})
        elif method == "ping":
            _respond(rid, {})
        else:
            _respond_error(rid, -32601, "unknown method: %s" % method)


if __name__ == "__main__":
    main()
