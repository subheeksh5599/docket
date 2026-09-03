// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {IDiamond} from "../src/interfaces/IDiamond.sol";

/// Deploy ReceiptRegistry to Base Sepolia.
/// Usage:
///   PRIVATE_KEY=<deployer key> forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast
contract DeployScript is Script {
    address constant DIAMOND = 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8;

    function run() external returns (ReceiptRegistry registry) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        registry = new ReceiptRegistry(IDiamond(DIAMOND), deployer);
        vm.stopBroadcast();
        console2.log("ReceiptRegistry deployed at:", address(registry));
        console2.log("owner:", deployer);
        console2.log("diamond:", DIAMOND);
        console2.log("usdc:", address(registry.usdc()));
    }
}
