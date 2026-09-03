// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OnChainData} from "../OnChainData.sol";

/// @title Telegraph Diamond — minimal interface for the ERC-8183 job rail.
/// @notice Only the functions DOCKET touches. Signatures taken verbatim from the
///         sponsor's own docs (using/erc8183-jobs.md + using/onchain-miner-requests.md),
///         which were executed live against the Base Sepolia deployment.
///         Diamond: 0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8
interface IDiamond {
    /// @notice Job record returned by getJob.
    /// (agent, intentId, callback, budget, minerPayment, protocolFee, state, createdAt)
    struct Job {
        address agent;
        bytes32 intentId;
        address callback;
        uint256 budget;
        uint256 minerPayment;
        uint256 protocolFee;
        uint8 state; // 0 Funded, 1 Terminal, 2 Cancelled
        uint256 createdAt;
    }

    event JobCreated(uint256 indexed jobId, address indexed agent, bytes32 intentId, address callback);
    event JobResolved(uint256 indexed jobId, address indexed miner, bytes32 outputHash);

    /// @notice Escrow USDC in the Diamond before creating a job. Requires prior ERC20 approve.
    function depositUSDC(uint256 amount) external;

    /// @notice Read one's escrow balance.
    function escrowBalance(address who) external view returns (uint256);

    /// @notice Create an ERC-8183 inference job. Returns the new job id.
    function createJob(bytes32 intentId, OnChainData calldata params, address callback) external returns (uint256 jobId);

    /// @notice Read a job record.
    function getJob(uint256 jobId) external view returns (Job memory);

    /// @notice Cancel a Funded job; budget returns to escrow.
    function cancelJob(uint256 jobId) external;

    /// @notice The USDC token the Diamond escrows.
    function usdcToken() external view returns (address);

    /// @notice Protocol-wide price for one ERC-8183 job.
    function getJobBasePrice() external view returns (uint256);
}
