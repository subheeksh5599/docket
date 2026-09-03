// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════════════
// FORK TEST — proves ReceiptRegistry works against the REAL Telegraph Diamond
// + REAL USDC state on a Base Sepolia fork.
// Run:  anvil --fork-url https://sepolia.base.org --port 8545   (background)
//       forge test --match-path test/Fork.t.sol
// ═══════════════════════════════════════════════════════════════════════════
import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {IDiamond} from "../src/interfaces/IDiamond.sol";

contract ForkTest is Test {
    // Live Base Sepolia deployment (verified 2026-09-02)
    address constant DIAMOND = 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    ReceiptRegistry registry;

    function setUp() public {
        // rpc_endpoints.base_sepolia_fork = http://localhost:8545 in foundry.toml
        uint256 fork = vm.createSelectFork("base_sepolia_fork");
        vm.selectFork(fork);
        registry = new ReceiptRegistry(IDiamond(DIAMOND), address(this));
    }

    function test_fork_liveDiamondGetters() public view {
        assertEq(IDiamond(DIAMOND).usdcToken(), USDC);
        assertEq(IDiamond(DIAMOND).getJobBasePrice(), 1_000_000);
    }

    function test_fork_registryPointsAtLiveDiamond() public view {
        assertEq(address(registry.diamond()), DIAMOND);
        assertEq(address(registry.usdc()), USDC);
    }
}
