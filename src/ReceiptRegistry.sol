// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OnChainData} from "./OnChainData.sol";
import {IDiamond} from "./interfaces/IDiamond.sol";
import {IUSDC} from "./interfaces/IUSDC.sol";

/// @title ReceiptRegistry — DOCKET's on-chain record of verified network answers.
/// @notice A user escrows USDC on the Telegraph Diamond, creates an ERC-8183 job,
///         and when the protocol delivers the miner's verified answer through the
///         callback, DOCKET writes ONE compact, immutable receipt and emits an event.
///
///         DOCKET records what the network returned. It never declares what is true.
///
///         THE ASK→ANSWER BINDING: at request time DOCKET commits the question hash
///         and intent id (so the ask is on the record BEFORE the network answers).
///         At callback time it writes the receipt: answer commitment + the ask it
///         answers. The full question/answer text lives off-chain; the hashes bind
///         them immutably and anyone can re-verify against the stored commitment.
///
///         Per the protocol's own constraint the callback must stay a single cheap
///         write (the docs: "keep the callback to a single cheap write"). The
///         callback reads the pre-committed ask (no external calls) and writes one
///         receipt + one lock + one event. The full answer is read off-chain from
///         the resolving transaction and re-verifiable by anyone against the hash.
contract ReceiptRegistry {
    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────
    error OnlyDiamond();
    error OnlyOwner();
    error NoSuchReceipt();
    error NotOwner();
    error AlreadyMinted(uint256 jobId);
    error NotJobOwner(uint256 jobId);
    error ZeroAddress();
    error ZeroBudget();
    error ZeroQuestion();
    error EscrowDepositFailed();
    error CreateJobFailed();
    error NothingToWithdraw();

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────
    /// @notice The Telegraph Diamond (escrow + jobs). Immutable; set at deploy.
    IDiamond public immutable diamond;
    /// @notice USDC (Circle) on the chain the Diamond escrows. Read from the Diamond.
    IUSDC public immutable usdc;
    /// @notice Contract owner (deployer) — admin functions.
    address public immutable owner;

    /// @notice Full record of one verified answer. Stored as a commitment.
    struct Receipt {
        uint256 jobId; // ERC-8183 job id on the Diamond
        bytes32 intentId; // the intent the job was routed under
        bytes32 questionHash; // keccak256(abi.encode(question)) — the ask, committed at request time
        bytes32 answerHash; // keccak256(abi.encode(OnChainData response)) — the network's answer
        uint256 createdAt; // block.timestamp when the callback wrote the record
        bool resolved; // terminal
    }

    /// @notice jobId → receipt.
    mapping(uint256 => Receipt) public receipts;
    /// @notice User → array of their job ids (off-chain enumeration helper).
    mapping(address => uint256[]) public jobsOf;
    /// @notice jobId → owner (the wallet that created the job).
    mapping(uint256 => address) public jobOwner;
    /// @notice Pre-committed ask metadata, set at request time (before resolution).
    mapping(uint256 => bytes32) internal _jobIntent;
    mapping(uint256 => bytes32) internal _jobQuestion;
    /// @notice Locked receipts (jobId → locked). A resolved receipt can never be altered.
    mapping(uint256 => bool) public locked;

    /// @notice intentId hash → human intent name, for readability (set by owner).
    mapping(bytes32 => string) public intentName;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────
    event ReceiptMinted(
        uint256 indexed jobId,
        address indexed owner,
        bytes32 indexed intentId,
        bytes32 questionHash,
        bytes32 answerHash,
        uint256 timestamp
    );
    event JobRequested(uint256 indexed jobId, address indexed owner, bytes32 indexed intentId, bytes32 questionHash);
    event JobCancelled(uint256 indexed jobId, address indexed owner);
    event IntentNamed(bytes32 indexed intentId, string name);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(IDiamond _diamond, address _owner) {
        if (address(_diamond) == address(0) || _owner == address(0)) revert ZeroAddress();
        diamond = _diamond;
        usdc = IUSDC(_diamond.usdcToken());
        owner = _owner;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────
    modifier onlyDiamond() {
        if (msg.sender != address(diamond)) revert OnlyDiamond();
        _;
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // User flow
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Commit an ask on-chain, escrow USDC on the Diamond, and create the job.
    /// @dev The USER approves USDC to THIS contract; this contract escrows on the
    ///      Diamond and creates the job from its own address (so the callback returns
    ///      here). The question is committed as a hash BEFORE the network answers, so
    ///      the record is "what was asked, when" — immutable from the start.
    function requestVerification(
        bytes32 intentId,
        OnChainData calldata params,
        string calldata question,
        uint256 budgetUsdc
    ) external returns (uint256 jobId) {
        if (budgetUsdc == 0) revert ZeroBudget();
        if (bytes(question).length == 0) revert ZeroQuestion();
        bytes32 qHash = keccak256(abi.encode(question));

        // Pull the budget, escrow it on the Diamond, then create the job.
        bool ok = usdc.transferFrom(msg.sender, address(this), budgetUsdc);
        if (!ok) revert EscrowDepositFailed();
        bool approved = usdc.approve(address(diamond), budgetUsdc);
        if (!approved) revert EscrowDepositFailed();
        diamond.depositUSDC(budgetUsdc);

        uint256 newJob = diamond.createJob(intentId, params, address(this));
        if (newJob == 0) revert CreateJobFailed();

        jobOwner[newJob] = msg.sender;
        jobsOf[msg.sender].push(newJob);
        _jobIntent[newJob] = intentId;
        _jobQuestion[newJob] = qHash;

        emit JobRequested(newJob, msg.sender, intentId, qHash);
        return newJob;
    }

    /// @notice The protocol's callback — called by the Diamond when a job resolves.
    /// @dev MUST stay a single cheap write. Reads the pre-committed ask (storage
    ///      reads, no external calls) and writes the immutable receipt.
    ///      Per the protocol: success is ALWAYS true, errorMessage ALWAYS "".
    function subnetMessage(
        uint256 jobId,
        bool,
        /* success */
        OnChainData calldata response,
        string calldata /* errorMessage */
    )
        external
        onlyDiamond
    {
        if (locked[jobId]) revert AlreadyMinted(jobId);

        bytes32 h = keccak256(abi.encode(response));
        receipts[jobId] = Receipt({
            jobId: jobId,
            intentId: _jobIntent[jobId],
            questionHash: _jobQuestion[jobId],
            answerHash: h,
            createdAt: block.timestamp,
            resolved: true
        });
        locked[jobId] = true;

        emit ReceiptMinted(jobId, jobOwner[jobId], _jobIntent[jobId], _jobQuestion[jobId], h, block.timestamp);
    }

    /// @notice User-facing cancel of a stuck (unresolved) job. Only the job owner.
    /// @dev The escrow is on the Diamond under THIS contract's address, so this
    ///      contract must cancel and hold the refund; the owner then withdraws.
    function cancelStuckJob(uint256 jobId) external {
        if (msg.sender != jobOwner[jobId]) revert NotJobOwner(jobId);
        if (locked[jobId]) revert AlreadyMinted(jobId);
        // read the Diamond's job state — must still be Funded (0) to cancel
        IDiamond.Job memory j = diamond.getJob(jobId);
        if (j.state != 0) revert NotJobOwner(jobId); // already terminal/cancelled
        diamond.cancelJob(jobId);
        emit JobCancelled(jobId, msg.sender);
    }

    /// @notice Withdraw USDC that this contract holds (refunded escrow or stray).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = usdc.balanceOf(address(this));
        if (amount == 0 || amount > bal) revert NothingToWithdraw();
        bool ok = usdc.transfer(to, amount);
        if (!ok) revert EscrowDepositFailed();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Label a canonical intent hash with its human name (readability only).
    function nameIntent(bytes32 intentId, string calldata name) external onlyOwner {
        intentName[intentId] = name;
        emit IntentNamed(intentId, name);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Read helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Read one receipt by job id.
    function getReceipt(uint256 jobId) external view returns (Receipt memory) {
        Receipt memory r = receipts[jobId];
        if (!r.resolved && !locked[jobId]) revert NoSuchReceipt();
        return r;
    }

    /// @notice Read the pre-committed intent for a job (before resolution).
    function jobIntent(uint256 jobId) external view returns (bytes32) {
        return _jobIntent[jobId];
    }

    /// @notice Read the pre-committed question hash for a job (before resolution).
    function jobQuestion(uint256 jobId) external view returns (bytes32) {
        return _jobQuestion[jobId];
    }

    /// @notice Enumerate a user's job ids.
    function jobsOfUser(address user) external view returns (uint256[] memory) {
        return jobsOf[user];
    }

    /// @notice Number of jobs a user has created.
    function jobCount(address user) external view returns (uint256) {
        return jobsOf[user].length;
    }
}
