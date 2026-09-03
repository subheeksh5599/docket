// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {OnChainData} from "../src/OnChainData.sol";
import {IDiamond} from "../src/interfaces/IDiamond.sol";
import {MockDiamond, MockUSDC} from "./mocks/MockDiamond.sol";

/// @notice End-to-end proof of the DOCKET flow against a test-only Diamond fixture:
///         fund → request job → protocol resolves → callback mints immutable receipt.
contract ReceiptRegistryTest is Test {
    ReceiptRegistry registry;
    MockDiamond diamond;
    MockUSDC usdc;
    address owner = address(0xA11CE);
    address user = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        diamond = new MockDiamond(address(usdc));
        registry = new ReceiptRegistry(IDiamond(address(diamond)), owner);
        usdc.mint(user, 10_000_000); // 10 USDC test
    }

    function test_owner_constructor() public view {
        assertEq(address(registry.diamond()), address(diamond));
        assertEq(registry.owner(), owner);
        assertEq(address(registry.usdc()), address(usdc));
    }

    function test_zeroAddressConstructor_reverts() public {
        vm.expectRevert(ReceiptRegistry.ZeroAddress.selector);
        new ReceiptRegistry(IDiamond(address(0)), owner);
    }

    function test_request_resolve_mint_fullFlow() public {
        bytes32 intent = keccak256("CRYPTO_PRICE");
        string memory q = "What is the price of BTC?";
        bytes32 qHash = keccak256(abi.encode(q));

        vm.startPrank(user);
        usdc.approve(address(registry), 2_000_000);
        OnChainData memory params; // empty — intent decides the shape
        uint256 jobId = registry.requestVerification(intent, params, q, 2_000_000);
        vm.stopPrank();

        assertGt(jobId, 0);
        assertEq(registry.jobOwner(jobId), user);
        assertEq(registry.jobsOf(user, 0), jobId);
        assertEq(registry.jobCount(user), 1);
        // ask committed BEFORE resolution
        assertEq(registry.jobIntent(jobId), intent);
        assertEq(registry.jobQuestion(jobId), qHash);
        // escrow moved: 2 USDC in, 1 USDC job price charged
        assertEq(diamond.escrowBalance(address(registry)), 1_000_000);

        // protocol resolves with a canned verified answer
        diamond.simulateResolve(jobId, "BTC: 61234.5", "miner-104");

        ReceiptRegistry.Receipt memory r = registry.getReceipt(jobId);
        assertTrue(r.resolved);
        assertEq(r.jobId, jobId);
        assertEq(r.intentId, intent); // ask bound to receipt
        assertEq(r.questionHash, qHash); // question bound to receipt
        assertEq(r.answerHash, keccak256(abi.encode(_resp("BTC: 61234.5", "miner-104"))));
        assertTrue(registry.locked(jobId));
        assertEq(registry.getReceipt(jobId).answerHash, r.answerHash);
    }

    function test_callback_onlyDiamond_reverts() public {
        OnChainData memory resp;
        vm.prank(user);
        vm.expectRevert(ReceiptRegistry.OnlyDiamond.selector);
        registry.subnetMessage(1, true, resp, "");
    }

    function test_doubleResolve_receiptImmutable() public {
        bytes32 intent = keccak256("WEATHER_FORECAST");
        string memory q = "Will it rain?";
        vm.startPrank(user);
        usdc.approve(address(registry), 2_000_000);
        OnChainData memory params;
        uint256 jobId = registry.requestVerification(intent, params, q, 2_000_000);
        vm.stopPrank();
        diamond.simulateResolve(jobId, "HIGH", "zeus");
        ReceiptRegistry.Receipt memory first = registry.getReceipt(jobId);

        // second resolve: the real protocol swallows the callback's revert; receipt stays
        diamond.simulateResolve(jobId, "LOW", "zeus");
        ReceiptRegistry.Receipt memory second = registry.getReceipt(jobId);
        assertEq(first.answerHash, second.answerHash);
        assertTrue(registry.locked(jobId));
        assertEq(second.createdAt, first.createdAt);
        assertEq(second.questionHash, first.questionHash);
    }

    function test_receipt_immutableAfterResolve() public {
        vm.startPrank(user);
        usdc.approve(address(registry), 2_000_000);
        OnChainData memory params;
        uint256 jobId = registry.requestVerification(keccak256("STORM_ALERT"), params, "storm?", 2_000_000);
        vm.stopPrank();
        diamond.simulateResolve(jobId, "SEVERE", "zeus");
        assertTrue(registry.locked(jobId));
    }

    function test_cancelStuckJob_refundsToRegistry() public {
        vm.startPrank(user);
        usdc.approve(address(registry), 2_000_000);
        OnChainData memory params;
        uint256 jobId = registry.requestVerification(keccak256("CHAT_COMPLETION"), params, "hi", 2_000_000);
        vm.stopPrank();
        // job stuck in Funded — owner of the job cancels through the registry
        assertEq(diamond.escrowBalance(address(registry)), 1_000_000); // 1 USDC charged for job
        vm.prank(user);
        registry.cancelStuckJob(jobId);
        // refund lands back in the registry's Diamond escrow
        assertEq(diamond.escrowBalance(address(registry)), 2_000_000);
    }

    function test_cancelStuckJob_onlyOwner() public {
        vm.startPrank(user);
        usdc.approve(address(registry), 2_000_000);
        OnChainData memory params;
        uint256 jobId = registry.requestVerification(keccak256("CHAT_COMPLETION"), params, "hi", 2_000_000);
        vm.stopPrank();
        vm.prank(address(0x1234));
        vm.expectRevert(abi.encodeWithSelector(ReceiptRegistry.NotJobOwner.selector, jobId));
        registry.cancelStuckJob(jobId);
    }

    function test_nameIntent_ownerOnly() public {
        vm.prank(owner);
        registry.nameIntent(keccak256("CRYPTO_PRICE"), "CRYPTO_PRICE");
        assertEq(registry.intentName(keccak256("CRYPTO_PRICE")), "CRYPTO_PRICE");
        vm.prank(user);
        vm.expectRevert(ReceiptRegistry.OnlyOwner.selector);
        registry.nameIntent(keccak256("X"), "X");
    }

    function test_zeroQuestion_reverts() public {
        vm.startPrank(user);
        usdc.approve(address(registry), 2_000_000);
        OnChainData memory params;
        // empty question → keccak(abi.encode("")) is not zero, but guard against it anyway
        vm.expectRevert(ReceiptRegistry.ZeroQuestion.selector);
        registry.requestVerification(keccak256("CRYPTO_PRICE"), params, "", 2_000_000);
        vm.stopPrank();
    }

    // helper — build the exact OnChainData the protocol would deliver
    function _resp(string memory text, string memory model) internal pure returns (OnChainData memory r) {
        r.strings = new string[](2);
        r.strings[0] = text;
        r.strings[1] = model;
    }
}
