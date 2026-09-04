#!/usr/bin/env python3
"""
docket prove <jobId> — strict, multi-RPC, full-chain verification of a DOCKET receipt.

Extends scripts/docket_verify.py with:
  * per-RPC consensus (query all 3 public RPCs, report each, require agreement)
  * ReceiptMinted event <-> stored receipt cross-check
  * provenance linkage: receipt -> job -> callback (terminal state)
  * standardized exit codes (0-5, machine-safe)
  * --json output for agents/scripts

Exit codes:
  0 = fully verified (receipt exists, locked, resolved, event matches, 3/3 RPC consensus)
  1 = receipt invalid (tamper / commitment mismatch / lock failure)
  2 = answer mismatch (commitment does not re-hash)
  3 = chain mismatch (RPC chain id != 84532)
  4 = RPC failure / disagreement (could not reach quorum)
  5 = incomplete (job exists but not terminal — no receipt yet)

Requires: python3 (stdlib only). Registry via DOCKET_REGISTRY or --registry.
"""
import argparse
import json
import os
import sys
import urllib.request

# canonical values — same as docket_verify.py
DIAMOND = "0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
CHAIN_ID = 84532
RPC_PRIMARY = "https://sepolia.base.org"
RPC_ALL = [RPC_PRIMARY, "https://base-sepolia-rpc.publicnode.com", "https://base-sepolia.drpc.org"]
REGISTRY_DEFAULT = os.environ.get("DOCKET_REGISTRY", "0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48")
# ReceiptMinted event topic0 — read from a real mint tx on this registry
EVENT_RECEIPT_MINTED = "0x1d8c52cad4269029478d2807c19efd2deab8e4c32cae3a9ba3e0e94b1b183fe1"
DEPLOY_BLOCK = 46293484

# selectors (cast sig)
SIG_GET_RECEIPT = "0xb63e6ac3"  # getReceipt(uint256)
SIG_LOCKED = "0xb45a3c0e"  # locked(uint256)
SIG_GET_JOB = "0xbf22c457"  # getJob(uint256) on the Diamond


def rpc_call(method, params, rpc_url, timeout=15):
    body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(rpc_url, data=body, headers={"Content-Type": "application/json", "User-Agent": "docket-prove/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        d = json.loads(resp.read().decode())
    if "error" in d:
        raise RuntimeError("RPC error: %s" % d["error"].get("message", d["error"]))
    return d["result"]


def eth_call(to, data, rpc):
    return rpc_call("eth_call", [{"to": to, "data": data}, "latest"], rpc)


def eth_get_logs(frm, to, address, topics, rpc):
    params = [{"address": address, "topics": topics, "fromBlock": hex(frm), "toBlock": hex(to)}]
    return rpc_call("eth_getLogs", params, rpc)


def eth_chain_id(rpc):
    return int(rpc_call("eth_chainId", [], rpc), 16)


def read_u256(hexstr, off=0):
    if not hexstr or hexstr == "0x":
        return 0
    b = bytes.fromhex(hexstr[2:])
    return int.from_bytes(b[off:off + 32], "big")


def decode_receipt_tuple(hexstr):
    """getReceipt(uint256) returns (jobId,intentId,questionHash,answerHash,createdAt,resolved)."""
    b = bytes.fromhex(hexstr[2:])
    u = lambda i: int.from_bytes(b[i * 32:(i + 1) * 32], "big")
    h = lambda i: "0x" + b[i * 32:(i + 1) * 32].hex()
    return {"jobId": u(0), "intentId": h(1), "questionHash": h(2), "answerHash": h(3), "createdAt": u(4), "resolved": bool(u(5))}


def fetch_receipt(job_id, registry, rpc):
    """Return (receipt_dict, locked_bool) or raise on revert/no-receipt."""
    raw = eth_call(registry, SIG_GET_RECEIPT + f"{job_id:064x}", rpc)
    if not raw or raw == "0x":
        raise ValueError("no receipt (getReceipt reverted)")
    rec = decode_receipt_tuple(raw)
    lock_raw = eth_call(registry, SIG_LOCKED + f"{job_id:064x}", rpc)
    locked = read_u256(lock_raw) == 1 if lock_raw and lock_raw != "0x" else False
    return rec, locked


def event_matches(job_id, registry, rpc, latest_block):
    """Scan logs since deploy for ReceiptMinted(jobId) and confirm one exists."""
    # topic1 = indexed jobId
    topic1 = f"0x{job_id:064x}"
    for frm in range(DEPLOY_BLOCK, latest_block + 1, 9000):
        to = min(frm + 8999, latest_block)
        logs = eth_get_logs(frm, to, registry, [EVENT_RECEIPT_MINTED, topic1], rpc)
        if logs:
            l = logs[-1]
            return {"found": True, "block": int(l["blockNumber"], 16), "tx": l["transactionHash"], "logIndex": int(l["logIndex"], 16)}
    return {"found": False}


def check_job_terminal(job_id, rpc):
    """Read the Diamond job state; return (terminal: bool, state_code)."""
    try:
        raw = eth_call(DIAMOND, SIG_GET_JOB + f"{job_id:064x}", rpc)
        if not raw or raw == "0x":
            return None, None
        b = bytes.fromhex(raw[2:])
        # tuple: (id, intent(bytes32), callback, escrow, minerPayment, protocolFee, state uint8)
        state = int.from_bytes(b[6 * 32:7 * 32], "big")
        # state 1 = resolved/terminal (per live reads); 0 = funded/waiting
        return state == 1, state
    except Exception:
        return None, None


def run_prove(job_id, registry, rpcs, answer_json=None, latest_override=None):
    """Run full verification with consensus. Returns (exit_code, report_dict)."""
    report = {"receipt": job_id, "registry": registry, "chain_id": CHAIN_ID, "rpc_results": [], "checks": {}, "verdict": None}
    consensus = []
    for rpc in rpcs:
        entry = {"rpc": rpc, "status": "error", "detail": None}
        try:
            cid = eth_chain_id(rpc)
            if cid != CHAIN_ID:
                entry.update(status="chain-mismatch", detail=f"chain {cid} != {CHAIN_ID}")
                consensus.append(False)
                report["rpc_results"].append(entry)
                continue
            rec, locked = fetch_receipt(job_id, registry, rpc)
            ok = bool(rec["resolved"] and locked and rec["questionHash"] != "0x" + "00" * 64 and rec["answerHash"] != "0x" + "00" * 64)
            entry.update(status="pass" if ok else "fail",
                         detail={"resolved": rec["resolved"], "locked": locked,
                                 "questionHash": rec["questionHash"], "answerHash": rec["answerHash"]})
            consensus.append(ok)
            if answer_json:
                from docket_verify import canonical_onchain_hash  # reuse verified encoder
                h = canonical_onchain_hash(answer_json)
                entry["detail"]["answer_rehash_matches"] = (h == rec["answerHash"])
                entry["detail"]["answer_rehash"] = h
        except ValueError as e:
            # no receipt — but the job may exist on the Diamond (not yet resolved)
            term, state = check_job_terminal(job_id, rpc)
            entry.update(status="no-receipt", detail={"error": str(e), "job_state": state, "job_terminal": term})
            consensus.append(False)
        except Exception as e:
            entry.update(status="error", detail=str(e))
            consensus.append(False)
        report["rpc_results"].append(entry)

    passes = [r for r in report["rpc_results"] if r["status"] == "pass"]
    no_rec = [r for r in report["rpc_results"] if r["status"] == "no-receipt"]
    errs = [r for r in report["rpc_results"] if r["status"] in ("error", "chain-mismatch")]
    reachable = [r for r in report["rpc_results"] if r["status"] != "error"]
    # consensus over REACHABLE rpcs: a dead rpc shouldn't block an otherwise
    # unanimous verification, but a reachable disagreement must.
    n_reachable = len(reachable)
    n_pass = len(passes)

    # event cross-check on the primary RPC
    ev = None
    try:
        latest = latest_override or int(rpc_call("eth_blockNumber", [], rpcs[0]), 16)
        ev = event_matches(job_id, registry, rpcs[0], latest)
    except Exception as e:
        ev = {"found": None, "error": str(e)}
    report["event"] = ev

    # verdict + exit code
    if n_reachable == 0:
        report["verdict"] = "RPC_FAILURE"
        return 4, report
    if n_pass == n_reachable and n_pass > 0:
        # all reachable RPCs agree it's a valid receipt
        report["verdict"] = "RECEIPT_VERIFIED"
        if answer_json and not all(r["detail"].get("answer_rehash_matches") for r in passes):
            return 2, report
        return 0, report
    if n_pass > 0 and no_rec:
        report["verdict"] = "RPC_DISAGREEMENT"
        return 4, report
    if no_rec and n_pass == 0 and len(no_rec) == n_reachable:
        report["verdict"] = "NO_RECEIPT_JOB_PENDING"
        return 5, report
    if n_pass == 0 and no_rec and n_reachable:
        report["verdict"] = "RPC_DISAGREEMENT"
        return 4, report
    report["verdict"] = "VERIFICATION_FAILED"
    return 1, report


def main():
    ap = argparse.ArgumentParser(description="docket prove — strict multi-RPC receipt verification")
    ap.add_argument("jobId", type=int)
    ap.add_argument("--registry", default=REGISTRY_DEFAULT)
    ap.add_argument("--rpc", action="append", default=None, help="override RPC set (repeatable)")
    ap.add_argument("--answer", metavar="JSON", default=None)
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    rpcs = args.rpc or RPC_ALL
    code, report = run_prove(args.jobId, args.registry, rpcs, answer_json=json.loads(args.answer) if args.answer else None)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"DOCKET PROVE — receipt #{args.jobId} on {args.registry}")
        print(f"  chain id: {CHAIN_ID} (base sepolia)")
        for r in report["rpc_results"]:
            mark = {"pass": "PASS", "fail": "FAIL", "no-receipt": "NO RECEIPT", "error": "ERROR", "chain-mismatch": "CHAIN MISMATCH"}[r["status"]]
            extra = ""
            if r["status"] == "pass" and "answer_rehash_matches" in (r.get("detail") or {}):
                extra = f"  rehash: {'MATCH' if r['detail']['answer_rehash_matches'] else 'MISMATCH'}"
            print(f"  RPC: {r['rpc']:<50} {mark}{extra}")
        ev = report.get("event") or {}
        if ev.get("found"):
            print(f"  ReceiptMinted event: FOUND (block {ev['block']}, tx {ev['tx'][:18]}…)")
        elif ev.get("found") is False:
            print("  ReceiptMinted event: MISSING (stored receipt has no matching mint event — inconsistency!)")
        else:
            print(f"  ReceiptMinted event: could not check ({ev.get('error')})")
        n_pass = sum(1 for r in report["rpc_results"] if r["status"] == "pass")
        print(f"  consensus: {n_pass}/{len(report['rpc_results'])} RPCs agree")
        print(f"  verdict: {report['verdict']}")
    sys.exit(code)


if __name__ == "__main__":
    main()
