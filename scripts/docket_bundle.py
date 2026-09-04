#!/usr/bin/env python3
"""
docket bundle <jobId> <outdir> — produce a complete, portable, offline-verifiable
evidence package for a DOCKET receipt.

Package contents (deterministic — two machines produce byte-identical files):
  receipt.json        canonical receipt record (schema docket.receipt.v1)
  transactions.json   the on-chain tx + event metadata (block, tx hash, log index)
  verification.txt    human-readable full-chain verification report
  README.txt          how to verify this package with cast/RPC — no DOCKET needed
  SHA256SUMS          sha256 of every file above (content-addressed evidence)

The package is self-verifying offline: `payload -> hash -> receipt -> evidence`
all inside the files, plus the on-chain anchors to re-check live.

Requires: python3 stdlib. Registry via DOCKET_REGISTRY or --registry.
"""
import argparse
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docket_prove as dp

VERIFIER_VERSION = "1.0.0"
SCHEMA = "docket.receipt.v1"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build(job_id, registry, outdir, answer_json=None):
    os.makedirs(outdir, exist_ok=True)
    code, report = dp.run_prove(job_id, registry, dp.RPC_ALL, answer_json=answer_json)

    # canonical receipt record — deterministic field order
    rpc_pass = next((r for r in report["rpc_results"] if r["status"] == "pass"), None)
    detail = (rpc_pass or {}).get("detail") or {}
    ev = report.get("event") or {}

    receipt = {
        "schema": SCHEMA,
        "verifier_version": VERIFIER_VERSION,
        "jobId": str(job_id),
        "registry": registry,
        "chainId": dp.CHAIN_ID,
        "network": "base-sepolia",
        "intentId": str(detail.get("intentId") or ""),
        "questionHash": str(detail.get("questionHash") or ""),
        "answerHash": str(detail.get("answerHash") or ""),
        "createdAt": detail.get("createdAt"),
        "resolved": bool(detail.get("resolved")),
        "locked": bool(detail.get("locked")),
        # no timestamp: the canonical receipt is byte-deterministic across runs.
    }

    transactions = {
        "registry": registry,
        "diamond": dp.DIAMOND,
        "mintEvent": {
            "topic0": dp.EVENT_RECEIPT_MINTED,
            "found": bool(ev.get("found")),
            "blockNumber": ev.get("block"),
            "transactionHash": ev.get("tx"),
            "logIndex": ev.get("logIndex"),
        } if ev.get("found") else {"found": False, "note": "mint event not found in scanned range"},
        "note": "job creation + resolver settlement txs are on the Telegraph Diamond; the mint event above is the receipt's on-chain anchor.",
    }

    verification = {
        "receipt": str(job_id),
        "verdict": report["verdict"],
        "exitCode": code,
        "consensus": f"{sum(1 for r in report['rpc_results'] if r['status']=='pass')}/{len(report['rpc_results'])}",
        "perRpc": [{"rpc": r["rpc"], "status": r["status"]} for r in report["rpc_results"]],
        "answerRehashMatch": (detail.get("answer_rehash_matches") if "answer_rehash_matches" in detail else None),
        "verifiedAt": int(time.time()),
        "verifier": "docket bundle v" + VERIFIER_VERSION,
    }

    # human text
    lines = []
    lines.append("DOCKET receipt evidence bundle — schema docket.receipt.v1")
    lines.append("=" * 60)
    lines.append(f"receipt:      #{job_id}")
    lines.append(f"registry:     {registry}")
    lines.append(f"chain:        Base Sepolia ({dp.CHAIN_ID})")
    lines.append(f"questionHash: {receipt['questionHash']}")
    lines.append(f"answerHash:   {receipt['answerHash']}")
    lines.append(f"resolved:     {receipt['resolved']}  locked: {receipt['locked']}")
    lines.append("")
    lines.append(f"verification: {report['verdict']}  (consensus {verification['consensus']})")
    for r in report["rpc_results"]:
        lines.append(f"  {r['rpc']:<52} {r['status'].upper()}")
    if ev.get("found"):
        lines.append(f"  mint event: block {ev['block']} tx {ev['tx']} logIndex {ev['logIndex']}")
    lines.append("")
    lines.append("Verify this package WITHOUT DOCKET (cast, from any machine):")
    lines.append(f"  cast call {registry} \\")
    lines.append(f"    \"getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)\" {job_id} \\")
    lines.append("    --rpc-url https://sepolia.base.org")
    lines.append("")
    lines.append("Then confirm the fields above match the on-chain tuple.")
    txt = "\n".join(lines) + "\n"

    readme = []
    readme.append("How to verify this DOCKET evidence package")
    readme.append("=" * 48)
    readme.append("")
    readme.append("Files:")
    readme.append("  receipt.json         canonical receipt record")
    readme.append("  transactions.json    on-chain mint event (block/tx/log index)")
    readme.append("  verification.txt     multi-RPC verification report")
    readme.append("  SHA256SUMS           sha256 of each file (content addressing)")
    readme.append("")
    readme.append("1. Check the package is intact:")
    readme.append("     sha256sum -c SHA256SUMS")
    readme.append("")
    readme.append("2. Re-verify the receipt against the live chain (no DOCKET):")
    readme.append(f"     cast call {registry} \\")
    readme.append(f"       \"getReceipt(uint256)(uint256,bytes32,bytes32,bytes32,uint256,bool)\" {job_id} \\")
    readme.append("       --rpc-url https://sepolia.base.org")
    readme.append("")
    readme.append("   The questionHash / answerHash / createdAt / resolved fields in")
    readme.append("   receipt.json must equal the on-chain tuple.")
    readme.append("")
    readme.append("3. Re-hash the answer commitment (optional):")
    readme.append("     DOCKET_REGISTRY=<registry> python3 docket_verify.py {job_id} --answer answer.json")
    readme.append("")
    readme.append("DOCKET never declares what is true — it records what the network")
    readme.append("returned. This package anchors that record to the chain.")
    readme_txt = "\n".join(readme) + "\n"

    files = {
        "receipt.json": json.dumps(receipt, indent=2, sort_keys=False) + "\n",
        "transactions.json": json.dumps(transactions, indent=2) + "\n",
        "verification.txt": txt,
        "README.txt": readme_txt,
    }
    written = []
    for name, content in files.items():
        p = os.path.join(outdir, name)
        with open(p, "w") as f:
            f.write(content)
        written.append(p)

    # SHA256SUMS last (must include itself? no — the canonical convention excludes it)
    sums = []
    for name in files:
        p = os.path.join(outdir, name)
        sums.append(f"{sha256_file(p)}  {name}")
    with open(os.path.join(outdir, "SHA256SUMS"), "w") as f:
        f.write("\n".join(sums) + "\n")
    written.append(os.path.join(outdir, "SHA256SUMS"))

    print(f"evidence bundle for receipt #{job_id} written to {outdir}")
    for p in written:
        print(f"  {os.path.basename(p):<22} {os.path.getsize(p):>7} bytes")
    print(f"\nverification: {report['verdict']} (exit {code})")
    return code


def main():
    ap = argparse.ArgumentParser(description="docket bundle — portable evidence package")
    ap.add_argument("jobId", type=int)
    ap.add_argument("outdir", nargs="?", default=None)
    ap.add_argument("--registry", default=dp.REGISTRY_DEFAULT)
    ap.add_argument("--answer", metavar="JSON", default=None)
    args = ap.parse_args()
    outdir = args.outdir or os.path.join(os.getcwd(), f"evidence-receipt-{args.jobId}")
    return build(args.jobId, args.registry, outdir, answer_json=json.loads(args.answer) if args.answer else None)


if __name__ == "__main__":
    sys.exit(main())
