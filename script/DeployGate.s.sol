// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DocketGate} from "../src/DocketGate.sol";

/// Deploy DocketGate (the receipt-consuming demo contract) to Base Sepolia.
/// Usage:
///   PRIVATE_KEY=<deployer key> forge script script/DeployGate.s.sol \
///     --rpc-url https://sepolia.base.org --broadcast
contract DeployGateScript is Script {
    // Canonical ReceiptRegistry (v2) — verified live.
    address constant REGISTRY = 0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48;
    // CRYPTO_PRICE intent hash — the only receipts this gate accepts.
    // keccak256("CRYPTO_PRICE") read from a live job on the registry.
    bytes32 constant REQUIRED_INTENT = 0x2a50af6c2576add2d054c7dd3176ae33bf33b67d0b2eb9c6f8bd6f4f53a1d51a;

    function run() external returns (DocketGate gate) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        gate = new DocketGate(REGISTRY, REQUIRED_INTENT);
        vm.stopBroadcast();
        console2.log("DocketGate deployed at:", address(gate));
        console2.log("registry:", REGISTRY);
        console2.log("requiredIntent:", vm.toString(REQUIRED_INTENT));
        console2.log("owner:", deployer);
    }
}
