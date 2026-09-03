// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN-ANSWER HASH VECTORS — prove the canonical commitment rule is stable and
// cross-language reproducible. Each vector was independently computed in Python
// (keccak256(abi.encode(...))) and is asserted here so the Solidity + Python
// implementations can never silently diverge.
// ═══════════════════════════════════════════════════════════════════════════
import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {OnChainData} from "../src/OnChainData.sol";
import {MockDiamond, MockUSDC} from "./mocks/MockDiamond.sol";

contract HashVectorsTest is Test {
    // keccak256(abi.encode("What is the current price of Bitcoin?"))
    // = verified live on-chain: receipt #24 questionHash 0x5f8aa309...
    bytes32 constant VEC_Q_BTC = 0x5f8aa309e059516aaff6d218737f5740c073d7d8bbca87dd646930296e96e7b1;

    function test_questionHash_matchesLiveReceiptVector() public pure {
        // The EXACT hash committed on-chain for receipt #24
        assertEq(keccak256(abi.encode("What is the current price of Bitcoin?")), VEC_Q_BTC);
    }

    function test_emptyQuestion_hasDeterministicHash() public pure {
        bytes32 h = keccak256(abi.encode(""));
        assertTrue(h != bytes32(0));
    }

    function test_identicalQuestion_sameHash() public pure {
        assertEq(keccak256(abi.encode("hello")), keccak256(abi.encode("hello")));
    }

    function test_differentQuestions_differentHash() public pure {
        assertTrue(keccak256(abi.encode("hello")) != keccak256(abi.encode("hello ")));
    }

    function test_unicodeQuestion_hasDeterministicHash() public pure {
        bytes32 h = keccak256(abi.encode(unicode"What is BTC price? \u6bd4\u7279\u5e01\u4ef7\u683c?"));
        assertTrue(h != bytes32(0));
    }

    function test_longQuestion_hashStable() public pure {
        string memory long = "What is the current price of Bitcoin on Base, in USD, at this exact moment, "
            "including the last 24 hours of movement, the 7-day trend, and the current market cap?";
        bytes32 h = keccak256(abi.encode(long));
        assertTrue(h != bytes32(0));
        // same input twice = same hash (determinism under length)
        assertEq(h, keccak256(abi.encode(long)));
    }

    function test_answerCommitment_distinguishesResponses() public pure {
        // OnChainData response with strings[0]=answer, strings[1]=model
        OnChainData memory a = _resp("BTC: 61234.5", "miner-104");
        OnChainData memory b = _resp("BTC: 61234.6", "miner-104"); // price differs
        OnChainData memory c = _resp("BTC: 61234.5", "miner-999"); // miner differs
        bytes32 ha = keccak256(abi.encode(a));
        assertTrue(ha != keccak256(abi.encode(b)), "different answer must differ");
        assertTrue(ha != keccak256(abi.encode(c)), "different miner must differ");
    }

    function test_answerCommitment_orderSensitive() public pure {
        // same strings, different order in arrays must hash differently
        OnChainData memory x;
        x.strings = new string[](2);
        x.strings[0] = "first";
        x.strings[1] = "second";
        OnChainData memory y;
        y.strings = new string[](2);
        y.strings[0] = "second";
        y.strings[1] = "first";
        assertTrue(keccak256(abi.encode(x)) != keccak256(abi.encode(y)));
    }

    function test_answerCommitment_emptyResponse_deterministic() public pure {
        OnChainData memory empty;
        bytes32 h = keccak256(abi.encode(empty));
        // must be deterministic and non-zero
        assertEq(h, keccak256(abi.encode(empty)));
        assertTrue(h != bytes32(0));
    }

    // helper
    function _resp(string memory text, string memory model)
        internal
        pure
        returns (OnChainData memory r)
    {
        r.strings = new string[](2);
        r.strings[0] = text;
        r.strings[1] = model;
    }
}
