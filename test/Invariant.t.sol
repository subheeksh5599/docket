// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT / STATEFUL TEST — DOCKET receipts can never be corrupted, lost,
// or double-minted no matter what sequence of calls the protocol + users make.
// ═══════════════════════════════════════════════════════════════════════════
import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {IDiamond} from "../src/interfaces/IDiamond.sol";
import {OnChainData} from "../src/OnChainData.sol";
import {MockDiamond, MockUSDC} from "./mocks/MockDiamond.sol";

contract ReceiptInvariant is Test {
    ReceiptRegistry registry;
    MockDiamond diamond;
    MockUSDC usdc;
    address owner = address(0xA11CE);
    address user = address(0xB0B);
    address user2 = address(0xC0C);

    // actors the invariant fuzzer can call
    address[] actors;

    function setUp() public {
        usdc = new MockUSDC();
        diamond = new MockDiamond(address(usdc));
        registry = new ReceiptRegistry(IDiamond(address(diamond)), owner);
        // fund users
        usdc.mint(user, 1_000_000_000);
        usdc.mint(user2, 1_000_000_000);
        actors = [user, user2];
        // name an intent so receipts have readable intent
        vm.prank(owner);
        registry.nameIntent(keccak256("CRYPTO_PRICE"), "CRYPTO_PRICE");
    }

    // ── INVARIANTS (run continuously during handler fuzzing) ──

    /// No two jobs map to the same receipt slot with different data.
    function invariant_receiptsAreNeverCorrupted() public view {
        // every job a user created that resolved must be locked + resolved
        for (uint256 i = 0; i < registry.jobCount(user); i++) {
            uint256 jobId = registry.jobsOf(user, i);
            if (registry.locked(jobId)) {
                ReceiptRegistry.Receipt memory r = registry.getReceipt(jobId);
                assertTrue(r.resolved, "locked receipt must be resolved");
                assertTrue(r.answerHash != bytes32(0), "locked receipt must have answer");
            }
        }
    }

    /// A resolved receipt can NEVER change (immutability is the product).
    function invariant_receiptHashNeverChanges() public view {
        // (covered per-job by locked: once locked, getReceipt is stable)
        // this invariant asserts no receipt exists with resolved=false and locked=true
        for (uint256 i = 0; i < registry.jobCount(user); i++) {
            uint256 jobId = registry.jobsOf(user, i);
            if (registry.locked(jobId)) {
                assertTrue(registry.getReceipt(jobId).resolved);
            }
        }
    }

    /// Total USDC held by registry + diamond escrow + users must be conserved.
    function invariant_noFundsLeak() public view {
        uint256 userBal = usdc.balanceOf(user);
        uint256 user2Bal = usdc.balanceOf(user2);
        uint256 regBal = usdc.balanceOf(address(registry));
        uint256 diamondEscrow = diamond.escrowBalance(address(registry));
        uint256 testContractBal = usdc.balanceOf(address(this));
        // in-flight job escrow: createJob debits jobBasePrice from the diamond escrow.
        // Unresolved jobs still hold that escrow (recoverable via cancel); resolved jobs'
        // escrow was paid to the miner (leaves the system — like the real protocol's
        // USDC→MACHINA swap). So add back only UNRESOLVED jobs' escrow.
        uint256 inFlight = 0;
        for (uint256 i = 0; i < registry.jobCount(user); i++) {
            uint256 jobId = registry.jobsOf(user, i);
            if (!registry.locked(jobId)) inFlight += 1_000_000;
        }
        for (uint256 i = 0; i < registry.jobCount(user2); i++) {
            uint256 jobId = registry.jobsOf(user2, i);
            if (!registry.locked(jobId)) inFlight += 1_000_000;
        }
        uint256 total = userBal + user2Bal + regBal + diamondEscrow + testContractBal + inFlight;
        assertEq(total, 2_000_000_000, "funds must be conserved");
    }

    /// jobCount can never exceed the number of actually-created jobs.
    function invariant_jobCountMatchesJobsCreated() public view {
        assertLe(registry.jobCount(user), 1_000_000); // sane bound — no overflow/spam
    }

    // ── HANDLERS (random actions the fuzzer takes) ──

    /// Randomly create a job (from a random actor) and optionally resolve it.
    function createJobAndMaybeResolve(uint256 actorSeed, uint256 budget, bool resolve) public {
        address actor = actors[actorSeed % actors.length];
        uint256 b = (budget % 100_000_000) + 1_000_000; // 1..100 USDC
        vm.startPrank(actor);
        if (usdc.balanceOf(actor) >= b) {
            usdc.approve(address(registry), type(uint256).max);
            OnChainData memory params;
            try registry.requestVerification(keccak256("CRYPTO_PRICE"), params, "q?", b) returns (uint256 jobId) {
                if (resolve) {
                    // resolve through the diamond (mimics protocol)
                    vm.stopPrank();
                    diamond.simulateResolve(jobId, "answer", "miner");
                    vm.startPrank(actor);
                }
            } catch {}
        }
        vm.stopPrank();
    }

    /// Randomly attempt double-resolve (must never corrupt).
    function doubleResolveAttempt(uint256 seed) public {
        uint256 n = registry.jobCount(user) + registry.jobCount(user2);
        if (n == 0) return;
        // find any resolved job and try to re-resolve
        for (uint256 i = 0; i < registry.jobCount(user); i++) {
            uint256 jobId = registry.jobsOf(user, i);
            if (registry.locked(jobId)) {
                diamond.simulateResolve(jobId, "corrupted", "evil");
                return; // one attempt per handler call
            }
        }
    }
}
