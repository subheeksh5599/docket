#!/usr/bin/env python3
"""Tests for the DOCKET MCP server (stdlib unittest — no network needed).

Covers: the offline keccak + canonical-hash vectors, the tool input guards,
and the verification logic against a stub RPC (so CI runs without a network).
The live-chain behavior is verified separately (see docs/VERIFY.md + the
self-test vector which reproduces the real receipt-#28 commitment).
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import docket_mcp as m  # noqa: E402


class MCPCoreTests(unittest.TestCase):
    def setUp(self):
        self._orig_eth_call = m.eth_call

    def tearDown(self):
        m.eth_call = self._orig_eth_call

    @staticmethod
    def _receipt_hex(job, answer_hash="23d1c6ef8212c9601d12dc626ecdbce5965e23a1622df5bbf8e47fec280d44c2"):
        """Real-shaped getReceipt return for a job (hashes from Base Sepolia)."""
        return ("0x" + (job).to_bytes(32, "big").hex()
                + bytes.fromhex("2a50af6c2576add2d054c7dd3176ae33bf33b67d0b2eb9c6f8bd6f4f53a1d51a").hex()
                + bytes.fromhex("5f8aa309e059516aaff6d218737f5740c073d7d8bbca87dd646930296e96e7b1").hex()
                + bytes.fromhex(answer_hash).hex()
                + (1788355510).to_bytes(32, "big").hex()
                + (1).to_bytes(32, "big").hex())

    def test_self_test_vectors(self):
        # keccak256(b'') known vector
        from _keccak import keccak_256
        self.assertEqual(keccak_256(b"").hex(),
                         "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
        # canonical hash reproduces live receipt #28 commitment
        LONG = ("summary:I cannot look up this transaction because no transaction hash was supplied. "
                "A transaction hash is 66 characters long: \"0x\" followed by 64 hexadecimal characters. "
                "Pass one as the tx_hash parameter and I will report its confirmation status, block, "
                "sender, recipient, value in ETH, and decoded contract method.")
        ANS = LONG.replace("summary:", "answer:")
        h = m.canonical_onchain_hash({
            "addresses": [],
            "integers": ["1000000000000000000"],
            "strings": ["status:invalid_input", LONG, "confidence", ANS],
            "bools": [],
        })
        self.assertEqual(h, "0x23d1c6ef8212c9601d12dc626ecdbce5965e23a1622df5bbf8e47fec280d44c2")

    def test_verify_receipt_ok(self):
        # fake eth_call: getReceipt(24) returns the real on-chain receipt #24
        def fake_eth_call(to, data, rpc):
            if data.startswith(m.SIG_RECEIPT):
                return self._receipt_hex(24)
            if data.startswith(m.SIG_LOCKED):
                return "0x" + (1).to_bytes(32, "big").hex()
            return "0x"
        m.eth_call = fake_eth_call
        res = m.verify_docket_receipt(24)
        self.assertEqual(res["receipt"], 24)
        self.assertTrue(res["resolved"])
        self.assertTrue(res["locked"])
        self.assertTrue(res["verified"])

    def test_verify_receipt_unknown_job(self):
        # unknown job -> RPC revert -> tool surfaces it, never crashes
        def fake_eth_call(to, data, rpc):
            raise RuntimeError("execution reverted")
        m.eth_call = fake_eth_call
        # the tool wraps failover, which surfaces a readable error
        res = m.verify_docket_receipt(999)
        self.assertIn("error", res)

    def test_input_guards(self):
        self.assertIn("error", m.verify_docket_receipt(0))
        self.assertIn("error", m.verify_docket_receipt(-1))
        self.assertIn("error", m.get_docket_receipt("x"))
        self.assertIn("error", m.verify_docket_answer(28, "not-a-dict"))

    def test_answer_match_true(self):
        LONG = ("summary:I cannot look up this transaction because no transaction hash was supplied. "
                "A transaction hash is 66 characters long: \"0x\" followed by 64 hexadecimal characters. "
                "Pass one as the tx_hash parameter and I will report its confirmation status, block, "
                "sender, recipient, value in ETH, and decoded contract method.")
        ANS = LONG.replace("summary:", "answer:")
        answer = {
            "addresses": [],
            "integers": ["1000000000000000000"],
            "strings": ["status:invalid_input", LONG, "confidence", ANS],
            "bools": [],
        }
        m.eth_call = lambda to, data, rpc: self._receipt_hex(28)
        res = m.verify_docket_answer(28, answer)
        self.assertTrue(res["match"])
        self.assertEqual(res["answer_hash"], res["stored_commitment"])

    def test_answer_tamper_detected(self):
        LONG = ("summary:I cannot look up this transaction because no transaction hash was supplied. "
                "A transaction hash is 66 characters long: \"0x\" followed by 64 hexadecimal characters. "
                "Pass one as the tx_hash parameter and I will report its confirmation status, block, "
                "sender, recipient, value in ETH, and decoded contract method.")
        ANS = LONG.replace("summary:", "answer:")
        answer = {  # one character changed -> different hash
            "addresses": [],
            "integers": ["1000000000000000000"],
            "strings": ["status:invalid_input", LONG, "confidence", ANS + "X"],
            "bools": [],
        }
        m.eth_call = lambda to, data, rpc: self._receipt_hex(28)
        res = m.verify_docket_answer(28, answer)
        self.assertFalse(res["match"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
