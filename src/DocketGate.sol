// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DocketGate — consume a DOCKET receipt as an on-chain evidence primitive.
/// @dev Demonstrates the receipt's composability: any contract can REQUIRE a valid,
///      locked, resolved DOCKET receipt before acting. It does NOT declare what is
///      true — it only gates on "the Telegraph network returned a response for this
///      job and DOCKET recorded it immutably". The consuming contract decides what
///      a given answerHash means for ITS OWN logic.
/// @notice Requires the ReceiptRegistry's getReceipt view (read-only, no protocol
///         integration needed beyond the registry address).
interface IReceiptRegistry {
    struct Receipt {
        uint256 jobId;
        bytes32 intentId;
        bytes32 questionHash;
        bytes32 answerHash;
        uint256 createdAt;
        bool resolved;
    }
    function getReceipt(uint256 jobId) external view returns (Receipt memory);
    function locked(uint256 jobId) external view returns (bool);
}

contract DocketGate {
    address public immutable registry;
    address public immutable owner;
    bytes32 public immutable requiredIntent; // only receipts for this intent pass
    bool public actionExecuted;
    uint256 public lastGatedJob;
    bytes32 public lastGatedAnswer;
    mapping(address => uint256) public executionsPerWallet;

    event ActionGated(uint256 indexed jobId, bytes32 intentId, bytes32 answerHash, address indexed actor);
    event ActionDenied(uint256 indexed jobId, string reason);

    error NotOwner();
    error NoReceipt(uint256 jobId);
    error ReceiptNotLocked(uint256 jobId);
    error ReceiptNotResolved(uint256 jobId);
    error WrongIntent(uint256 jobId);
    error AnswerNotAccepted(bytes32 answerHash);
    error ActionAlreadyExecuted();
    error ZeroRegistry();

    constructor(address registry_, bytes32 requiredIntent_) {
        if (registry_ == address(0)) revert ZeroRegistry();
        registry = registry_;
        owner = msg.sender;
        requiredIntent = requiredIntent_;
    }

    /// @notice The gated action. Runs only when jobId holds a valid DOCKET receipt:
    ///         locked, resolved, matching this gate's intent, and carrying an
    ///         answerHash this gate accepts. This contract does not judge the
    ///         answer's truth — it acts on the fact that the network returned it.
    /// @param jobId The DOCKET job whose receipt is the evidence.
    /// @param acceptedAnswer The answerHash this gate considers actionable.
    function executeGated(uint256 jobId, bytes32 acceptedAnswer) external {
        if (actionExecuted) revert ActionAlreadyExecuted();

        IReceiptRegistry.Receipt memory r = IReceiptRegistry(registry).getReceipt(jobId);

        // Receipt must exist (getReceipt reverts with NoSuchReceipt if absent).
        if (!IReceiptRegistry(registry).locked(jobId)) revert ReceiptNotLocked(jobId);
        if (!r.resolved) revert ReceiptNotResolved(jobId);
        if (r.intentId != requiredIntent) revert WrongIntent(jobId);
        if (r.answerHash != acceptedAnswer) revert AnswerNotAccepted(r.answerHash);

        // The gated action: record the evidence-backed execution.
        actionExecuted = true;
        lastGatedJob = jobId;
        lastGatedAnswer = r.answerHash;
        executionsPerWallet[msg.sender] += 1;

        emit ActionGated(jobId, r.intentId, r.answerHash, msg.sender);
    }

    /// @notice Show the acceptance criteria — lets anyone audit what this gate requires.
    function acceptanceCriteria(uint256 jobId)
        external
        view
        returns (bool exists, bool locked, bool resolved, bool rightIntent, bool anyAnswer)
    {
        if (jobId == 0) return (false, false, false, false, false);
        // getReceipt reverts on unknown jobs; treat revert as "no receipt"
        try IReceiptRegistry(registry).getReceipt(jobId) returns (IReceiptRegistry.Receipt memory r) {
            exists = true;
            locked = IReceiptRegistry(registry).locked(jobId);
            resolved = r.resolved;
            rightIntent = r.intentId == requiredIntent;
            anyAnswer = r.answerHash != bytes32(0);
        } catch {
            exists = false;
        }
    }
}
