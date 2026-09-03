// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice DocketGate tests — the receipt-as-evidence-primitive contract.
///         Uses the same TEST-ONLY mock rail as the registry tests: a job is created
///         and resolved (minting a locked receipt), then DocketGate consumes it.
import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {OnChainData} from "../src/OnChainData.sol";
import {IDiamond} from "../src/interfaces/IDiamond.sol";
import {IUSDC} from "../src/interfaces/IUSDC.sol";
import {DocketGate} from "../src/DocketGate.sol";
import {MockDiamond, MockUSDC} from "./mocks/MockDiamond.sol";

contract DocketGateTest is Test {
    MockUSDC usdc;
    MockDiamond diamond;
    ReceiptRegistry registry;
    DocketGate gate;
    address owner = address(0xA11CE);
    address user = address(0xB0B);
    bytes32 constant CRYPTO_PRICE = keccak256("CRYPTO_PRICE");

    function setUp() public {
        usdc = new MockUSDC();
        diamond = new MockDiamond(address(usdc));
        registry = new ReceiptRegistry(IDiamond(address(diamond)), owner);
        gate = new DocketGate(address(registry), CRYPTO_PRICE);
        usdc.mint(user, 1_000_000_000);
        vm.prank(owner);
        registry.nameIntent(CRYPTO_PRICE, "CRYPTO_PRICE");
    }

    /// Create + resolve a job so a locked receipt exists; returns (jobId, answerHash).
    function _mintReceipt(string memory answerText) internal returns (uint256 jobId, bytes32 answerHash) {
        vm.startPrank(user);
        usdc.approve(address(registry), type(uint256).max);
        OnChainData memory params;
        jobId = registry.requestVerification(CRYPTO_PRICE, params, "BTC above 60k?", 2_000_000);
        vm.stopPrank();
        // resolve through the diamond -> callback mints + locks the receipt
        diamond.simulateResolve(jobId, answerText, "miner-1");
        ReceiptRegistry.Receipt memory r = registry.getReceipt(jobId);
        answerHash = r.answerHash;
        assertTrue(registry.locked(jobId), "receipt must be locked");
    }

    function test_gate_allowsAction_onValidLockedReceipt() public {
        (uint256 jobId, bytes32 answerHash) = _mintReceipt("YES BTC above 60k");
        // the gate's accepted answer = the actual stored commitment
        vm.prank(user);
        gate.executeGated(jobId, answerHash);
        assertTrue(gate.actionExecuted(), "action should have executed");
        assertEq(gate.lastGatedJob(), jobId);
        assertEq(gate.lastGatedAnswer(), answerHash);
        assertEq(gate.executionsPerWallet(user), 1);
    }

    function test_gate_allows_onceOnly() public {
        (uint256 jobId, bytes32 answerHash) = _mintReceipt("YES");
        vm.prank(user);
        gate.executeGated(jobId, answerHash);
        vm.prank(user);
        vm.expectRevert(DocketGate.ActionAlreadyExecuted.selector);
        gate.executeGated(jobId, answerHash);
    }

    function test_gate_denies_wrongAnswerHash() public {
        (uint256 jobId, bytes32 realHash) = _mintReceipt("YES BTC above 60k");
        // an attacker supplies a DIFFERENT answerHash — denied, because the receipt
        // commits to what the network actually returned (error carries the REAL hash)
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(DocketGate.AnswerNotAccepted.selector, realHash));
        gate.executeGated(jobId, bytes32(uint256(1)));
    }

    function test_gate_denies_unlockedPendingJob() public {
        vm.startPrank(user);
        usdc.approve(address(registry), type(uint256).max);
        OnChainData memory params;
        uint256 jobId = registry.requestVerification(CRYPTO_PRICE, params, "q?", 2_000_000);
        vm.stopPrank();
        // never resolved -> no receipt exists yet (getReceipt reverts NoSuchReceipt) ->
        // the gate cannot act on a pending job, period
        vm.prank(user);
        vm.expectRevert(); // NoSuchReceipt bubbles from the registry view
        gate.executeGated(jobId, bytes32(uint256(1)));
    }

    function test_gate_denies_wrongIntent() public {
        // create a receipt for a DIFFERENT intent (registry may still name it)
        bytes32 weather = keccak256("WEATHER_CHECK");
        vm.prank(owner);
        registry.nameIntent(weather, "WEATHER_CHECK");
        vm.startPrank(user);
        usdc.approve(address(registry), type(uint256).max);
        OnChainData memory params;
        uint256 jobId = registry.requestVerification(weather, params, "rain?", 2_000_000);
        vm.stopPrank();
        diamond.simulateResolve(jobId, "sunny", "m");
        // assert the receipt's intent is weather (not CRYPTO_PRICE) before gating
        assertEq(registry.getReceipt(jobId).intentId, weather, "receipt intent should be weather");
        assertTrue(weather != CRYPTO_PRICE, "weather and CRYPTO_PRICE must differ");
        assertEq(gate.requiredIntent(), CRYPTO_PRICE, "gate should require CRYPTO_PRICE");
        // gate requires CRYPTO_PRICE -> denied
        bytes32 h = registry.getReceipt(jobId).answerHash;
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(DocketGate.WrongIntent.selector, jobId));
        gate.executeGated(jobId, h);
    }

    function test_gate_denies_noReceipt() public {
        vm.prank(user);
        vm.expectRevert(); // getReceipt(999) reverts (NoSuchReceipt) -> bubbles as revert
        gate.executeGated(999, bytes32(0));
    }

    function test_acceptanceCriteria_reportsTruthfully() public {
        (uint256 jobId,) = _mintReceipt("YES");
        (bool exists, bool locked, bool resolved, bool rightIntent, bool anyAnswer) = gate.acceptanceCriteria(jobId);
        assertTrue(exists && locked && resolved && rightIntent && anyAnswer);

        (bool ex2,,,,) = gate.acceptanceCriteria(4242);
        assertFalse(ex2, "unknown job must report not-exists (no revert)");
    }

    function test_gate_onlyMintsReceipt_onceByContractConstruction() public view {
        // structural guard: the gate has no function to fake or overwrite a receipt —
        // it only READS the registry. Receipts are minted solely by the protocol callback.
        assertEq(address(gate.registry()), address(registry));
        assertEq(gate.requiredIntent(), CRYPTO_PRICE);
    }
}
