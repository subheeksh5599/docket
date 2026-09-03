// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ═══════════════════════════════════════════════════════════════════════════
// TEST-ONLY FIXTURE — never deployed, never in the shipped path.
// Mimics the Telegraph Diamond's ERC-8183 job rail so the ReceiptRegistry
// flow can be proven locally without a network. Lives under test/ only.
// ═══════════════════════════════════════════════════════════════════════════
import {IDiamond} from "../../src/interfaces/IDiamond.sol";
import {OnChainData} from "../../src/OnChainData.sol";

contract MockUSDC {
    string public name = "Mock USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address spender, uint256 amt) external returns (bool) {
        allowance[msg.sender][spender] = amt;
        return true;
    }

    function transfer(address to, uint256 amt) external returns (bool) {
        require(balanceOf[msg.sender] >= amt, "insufficient");
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        require(balanceOf[from] >= amt, "insufficient");
        require(allowance[from][msg.sender] >= amt, "allowance");
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
        allowance[from][msg.sender] -= amt;
        return true;
    }
}

/// @notice Emulates the Diamond: holds escrow, assigns job ids, calls the callback
///         on resolve with a canned verified answer.
contract MockDiamond {
    MockUSDC public usdc;
    address public callbackTarget;
    uint256 public nextJob = 1;
    uint256 public jobBasePrice = 1_000_000; // 1 USDC
    uint256 public protocolFeeBps = 200; // 2%

    mapping(address => uint256) public escrows;
    mapping(uint256 => IDiamond.Job) public jobRecord;

    event JobCreated(uint256 indexed jobId, address indexed agent, bytes32 intentId, address callback);
    event Deposited(address indexed who, uint256 amount);

    constructor(address usdc_) {
        usdc = MockUSDC(usdc_);
    }

    function usdcToken() external view returns (address) {
        return address(usdc);
    }

    function getJobBasePrice() external view returns (uint256) {
        return jobBasePrice;
    }

    function getTreasury() external view returns (address) {
        return address(0x000000000000000000000000000000000000dEaD);
    }

    function depositUSDC(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        escrows[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function escrowBalance(address who) external view returns (uint256) {
        return escrows[who];
    }

    function createJob(
        bytes32 intentId,
        OnChainData calldata,
        /*params*/
        address callback
    )
        external
        returns (uint256 jobId)
    {
        // charge the job price from escrow
        require(escrows[msg.sender] >= jobBasePrice, "escrow");
        escrows[msg.sender] -= jobBasePrice;
        jobId = nextJob++;
        jobRecord[jobId] = IDiamond.Job({
            agent: msg.sender,
            intentId: intentId,
            callback: callback,
            budget: jobBasePrice,
            minerPayment: jobBasePrice * (10000 - protocolFeeBps) / 10000,
            protocolFee: jobBasePrice * protocolFeeBps / 10000,
            state: 0,
            createdAt: block.timestamp
        });
        callbackTarget = callback;
        emit JobCreated(jobId, msg.sender, intentId, callback);
    }

    function cancelJob(uint256 jobId) external {
        IDiamond.Job storage j = jobRecord[jobId];
        require(j.agent == msg.sender, "not owner");
        require(j.state == 0, "not funded");
        j.state = 2;
        escrows[msg.sender] += j.budget;
    }

    function getJob(uint256 jobId) external view returns (IDiamond.Job memory) {
        return jobRecord[jobId];
    }

    // Simulate the protocol resolving a job: deliver a canned verified answer
    // through the registry's subnetMessage callback.
    function simulateResolve(uint256 jobId, string memory answerText, string memory model) external {
        OnChainData memory resp;
        resp.strings = new string[](2);
        resp.strings[0] = answerText;
        resp.strings[1] = model;
        // call the registered callback — the real protocol swallows callback reverts
        // (docs: "your revert is swallowed"), so do not require success here
        jobRecord[jobId].callback
            .call(
                abi.encodeWithSignature(
                    "subnetMessage(uint256,bool,(address[],uint256[],string[],bool[]),string)", jobId, true, resp, ""
                )
            );
        jobRecord[jobId].state = 1;
    }
}
