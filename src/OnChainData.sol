// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Shared on-chain data blob used by Telegraph ERC-8183 jobs.
/// @dev Matches the protocol's OnChainData struct exactly (docs: using/erc8183-jobs.md).
struct OnChainData {
    address[] addresses;
    uint256[] integers;
    string[] strings;
    bool[] bools;
}
