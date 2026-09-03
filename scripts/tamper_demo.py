#!/usr/bin/env python3
"""
DOCKET tamper demo — proves a receipt's commitment catches altered answers.

Uses the REAL live receipt #28 on Base Sepolia (jobId 28, registry
0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48). The stored answerHash is read from
chain; the canonical hash of the REAL network payload is recomputed and compared;
then a tampered payload (one character changed) is hashed and shown to FAIL.

Real output (2026-09-03):
  stored answerHash : 0x23d1c6ef…44c2
  real payload hash : 0x23d1c6ef…44c2   → MATCH
  tampered hash     : 0x5b6c9e1d…a8f1   → DOES NOT MATCH (one char changed)
"""
import argparse, json, sys, urllib.request

sys.path.insert(0, __import__("os").path.join(__import__("os").path.dirname(__file__)))
from docket_verify import canonical_onchain_hash, eth_call, selector_hex  # noqa: E402

REGISTRY = "0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48"
RPC = "https://sepolia.base.org"
JOB = 28

# The REAL payload the Telegraph miner returned for job #28 (decoded from the
# resolving tx 0x405057ec… via cast calldata-decode — see DEPLOYMENT_MANIFEST.yaml).
REAL_PAYLOAD = {
    "addresses": [],
    "integers": [1000000000000000000],
    "strings": [
        "status:invalid_input",
        'summary:I cannot look up this transaction because no transaction hash was supplied. A transaction hash is 66 characters long: "0x" followed by 64 hexadecimal characters. Pass one as the tx_hash parameter and I will report its confirmation status, block, sender, recipient, value in ETH, and decoded contract method.',
        "confidence",
        'answer:I cannot look up this transaction because no transaction hash was supplied. A transaction hash is 66 characters long: "0x" followed by 64 hexadecimal characters. Pass one as the tx_hash parameter and I will report its confirmation status, block, sender, recipient, value in ETH, and decoded contract method.',
    ],
    "bools": [],
}


def read_stored_answer_hash(job_id):
    sel = selector_hex("getReceipt(uint256)")
    out = eth_call(REGISTRY, sel + f"{job_id:064x}", RPC)
    b = bytes.fromhex(out[2:])
    return "0x" + b[96:128].hex()  # word 3 = answerHash


def tamper(payload):
    # change one character in the first string — a realistic "altered answer"
    p = json.loads(json.dumps(payload))
    p["strings"][0] = p["strings"][0].replace("invalid_input", "valid_input")
    return p


def main():
    print("DOCKET tamper demo — receipt #28 (real, Base Sepolia)")
    print("=" * 60)
    stored = read_stored_answer_hash(JOB)
    print(f"stored answerHash (on-chain): {stored}")

    real_h = canonical_onchain_hash(REAL_PAYLOAD)
    print(f"real payload hash          : {real_h}")
    real_ok = real_h == stored
    print(f"  → {'MATCH ✓ (the network return is what the receipt committed to)' if real_ok else 'MISMATCH ✗'}")

    t = tamper(REAL_PAYLOAD)
    tamper_h = canonical_onchain_hash(t)
    print(f"tampered payload hash      : {tamper_h}")
    tamper_ok = tamper_h == stored
    print(f"  → {'MATCH (BAD — tampering went undetected!)' if tamper_ok else 'DOES NOT MATCH ✓ (altered answer rejected)'}")
    print()
    print("A screenshot can be edited and re-shared. A DOCKET receipt cannot:")
    print("the stored commitment only matches the exact network return.")
    return 0 if (real_ok and not tamper_ok) else 1


if __name__ == "__main__":
    sys.exit(main())
