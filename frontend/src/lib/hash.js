// DOCKET canonical commitment — the ONE hash construction rule.
// The on-chain receipt stores keccak256(abi.encode(OnChainData response)) as delivered
// by the protocol callback. The full answer is read off-chain (callback calldata / tx)
// and re-hashed with the SAME rule to verify the commitment.
// This module is the single source of truth shared by frontend + verifier.
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

// OnChainData = (address[], uint256[], string[], bool[]) — matches the protocol struct.
export function canonicalAnswerHash(response) {
  const { addresses = [], integers = [], strings = [], bools = [] } = response || {};
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address[], uint256[], string[], bool[]'),
      [addresses, integers.map(String), strings, bools]
    )
  );
}

// Hash a question string the same way the contract would if it committed the ask.
// (The current contract does NOT store the question on-chain — the receipt commits to
//  the ANSWER. This stays for the future canonical-request mode.)
export function canonicalQuestionHash(question) {
  return keccak256(encodeAbiParameters(parseAbiParameters('string'), [question]));
}
