import { describe, it, expect } from 'vitest';
import { canonicalAnswerHash, canonicalQuestionHash } from './hash';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

// Receipt #24 on Base Sepolia committed keccak256(abi.encode(question))
// for "What is the current price of Bitcoin?" — live on-chain vector (cross-language).
const LIVE_RECEIPT_24_QH =
  '0x5f8aa309e059516aaff6d218737f5740c073d7d8bbca87dd646930296e96e7b1';

describe('canonicalQuestionHash', () => {
  it('reproduces the live on-chain question hash for receipt #24', () => {
    expect(canonicalQuestionHash('What is the current price of Bitcoin?')).toBe(
      LIVE_RECEIPT_24_QH
    );
  });

  it('is deterministic for identical questions', () => {
    expect(canonicalQuestionHash('hello')).toBe(canonicalQuestionHash('hello'));
  });

  it('differs for near-identical questions (trailing space)', () => {
    expect(canonicalQuestionHash('hello')).not.toBe(canonicalQuestionHash('hello '));
  });

  it('differs for case changes', () => {
    expect(canonicalQuestionHash('What price BTC?')).not.toBe(
      canonicalQuestionHash('what price btc?')
    );
  });

  it('handles empty string deterministically', () => {
    expect(canonicalQuestionHash('')).toBe(
      keccak256(encodeAbiParameters(parseAbiParameters('string'), ['']))
    );
  });

  it('handles unicode without error', () => {
    expect(typeof canonicalQuestionHash('¿Qué precio?')).toBe('string');
  });

  it('handles long multi-sentence questions', () => {
    const long =
      'What is the current price of Bitcoin on Base, in USD, at this exact moment, ' +
      'including the last 24 hours of movement, the 7-day trend, and the current market cap?';
    expect(canonicalQuestionHash(long)).toBe(canonicalQuestionHash(long));
  });

  it('outputs 0x-prefixed 32-byte hex', () => {
    const h = canonicalQuestionHash('x');
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('canonicalAnswerHash', () => {
  it('is deterministic for identical responses', () => {
    const resp = { strings: ['BTC: 61234.5', 'miner-104'] };
    expect(canonicalAnswerHash(resp)).toBe(canonicalAnswerHash(resp));
  });

  it('differs when the answer text differs', () => {
    const a = { strings: ['BTC: 61234.5', 'miner-104'] };
    const b = { strings: ['BTC: 61234.6', 'miner-104'] };
    expect(canonicalAnswerHash(a)).not.toBe(canonicalAnswerHash(b));
  });

  it('differs when the miner differs', () => {
    const a = { strings: ['BTC: 61234.5', 'miner-104'] };
    const c = { strings: ['BTC: 61234.5', 'miner-999'] };
    expect(canonicalAnswerHash(a)).not.toBe(canonicalAnswerHash(c));
  });

  it('differs when the model array changes', () => {
    const a = { strings: ['answer'], addresses: [] };
    const b = { strings: ['answer'], addresses: ['0x' + '11'.repeat(20)] };
    expect(canonicalAnswerHash(a)).not.toBe(canonicalAnswerHash(b));
  });

  it('is stable for an empty response object', () => {
    expect(canonicalAnswerHash({})).toBe(canonicalAnswerHash({}));
  });

  it('handles integer fields', () => {
    const resp = { integers: ['12345'], strings: ['ok'] };
    expect(typeof canonicalAnswerHash(resp)).toBe('string');
    expect(canonicalAnswerHash(resp)).toBe(canonicalAnswerHash(resp));
  });

  it('outputs 0x-prefixed 32-byte hex', () => {
    const h = canonicalAnswerHash({ strings: ['v'] });
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('throws on malformed non-array fields', () => {
    expect(() => canonicalAnswerHash({ strings: 'not-an-array' })).toThrow();
  });

  it('matches the reference implementation for a fixed vector', () => {
    // reference: keccak of abi.encode of the OnChainData STRUCT = nested tuple
    const resp = { strings: ['fixed-vector'] };
    const expected = keccak256(
      encodeAbiParameters(parseAbiParameters('(address[], uint256[], string[], bool[])'), [
        [[], [], ['fixed-vector'], []],
      ])
    );
    expect(canonicalAnswerHash(resp)).toBe(expected);
  });

  it('reproduces the LIVE on-chain answerHash for receipt #28 (Base Sepolia)', () => {
    // The real callback payload decoded from the resolving tx 0x405057ec…
    // (miner's actual answer for job #28, incl. the 1e18 integer payment field).
    // Stored on-chain as answerHash 0x23d1c6ef… and reproduced here byte-exact.
    const LONG =
      'summary:I cannot look up this transaction because no transaction hash was supplied. A transaction hash is 66 characters long: "0x" followed by 64 hexadecimal characters. Pass one as the tx_hash parameter and I will report its confirmation status, block, sender, recipient, value in ETH, and decoded contract method.';
    const ANS =
      'answer:I cannot look up this transaction because no transaction hash was supplied. A transaction hash is 66 characters long: "0x" followed by 64 hexadecimal characters. Pass one as the tx_hash parameter and I will report its confirmation status, block, sender, recipient, value in ETH, and decoded contract method.';
    const resp = {
      addresses: [],
      integers: ['1000000000000000000'],
      strings: ['status:invalid_input', LONG, 'confidence', ANS],
      bools: [],
    };
    expect(canonicalAnswerHash(resp)).toBe(
      '0x23d1c6ef8212c9601d12dc626ecdbce5965e23a1622df5bbf8e47fec280d44c2'
    );
  });
});

describe('cross-language hash consistency', () => {
  it('question hash rule matches the on-chain contract construction', () => {
    // The Solidity contract computes keccak256(abi.encode(question)); JS must too.
    // ABI-encoded string = 32-byte offset + 32-byte length + padded bytes — viem handles it.
    const q = 'What is the current price of Bitcoin?';
    const js = canonicalQuestionHash(q);
    // Solidity: keccak256(abi.encode("What is the current price of Bitcoin?"))
    // verified on-chain receipt #24 questionHash = 0x5f8aa309...
    expect(js).toBe(LIVE_RECEIPT_24_QH);
  });
});
