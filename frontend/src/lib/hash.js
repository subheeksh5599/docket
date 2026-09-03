// DOCKET canonical commitment — the ONE hash construction rule.
// The on-chain receipt stores keccak256(abi.encode(OnChainData response)) as delivered
// by the protocol callback, where OnChainData is a STRUCT. Solidity encodes a struct
// arg as a NESTED TUPLE — the 4 dynamic arrays' offsets are relative to the tuple's
// own head, NOT flat top-level args. Verified LIVE against receipt #24/#28 on Base
// Sepolia (recomputed hash 0x23d1c6ef… matches the stored answerHash exactly).
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

// OnChainData struct = (address[], uint256[], string[], bool[]) — encoded as a
// nested tuple to match Solidity's abi.encode(struct).
export function canonicalAnswerHash(response) {
  const { addresses = [], integers = [], strings = [], bools = [] } = response || {};
  return keccak256(
    encodeAbiParameters(parseAbiParameters('(address[], uint256[], string[], bool[])'), [
      [addresses, integers.map(String), strings, bools],
    ])
  );
}

// Hash a question string the same way the contract does when it commits the ask:
// keccak256(abi.encode(question)) — a single string arg (flat == tuple here).
export function canonicalQuestionHash(question) {
  return keccak256(encodeAbiParameters(parseAbiParameters('string'), [question]));
}
