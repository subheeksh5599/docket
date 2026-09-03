import { describe, it, expect } from 'vitest';
import { ERRORS, classifyError, errorLabel } from './errors';

describe('error taxonomy completeness', () => {
  it('defines every code with message + retry guidance', () => {
    for (const [code, e] of Object.entries(ERRORS)) {
      expect(code, code).toBe(code);
      expect(e.message, `${code}.message`).toBeTruthy();
      expect(e.retry, `${code}.retry`).toBeTruthy();
    }
  });

  it('has no empty or placeholder messages', () => {
    for (const [code, e] of Object.entries(ERRORS)) {
      expect(e.message.length, code).toBeGreaterThan(10);
      expect(e.message.includes('TODO'), code).toBe(false);
    }
  });

  it('errorLabel returns the entry for a known code', () => {
    expect(errorLabel('RPC_UNAVAILABLE').message).toBe(ERRORS.RPC_UNAVAILABLE.message);
  });

  it('errorLabel falls back to UNKNOWN for an unknown code', () => {
    expect(errorLabel('NOPE').message).toBe(ERRORS.UNKNOWN_PROTOCOL_ERROR.message);
  });

  it('every taxonomy code maps to a label without throwing', () => {
    for (const code of Object.keys(ERRORS)) {
      expect(() => errorLabel(code)).not.toThrow();
    }
  });
});

describe('classifyError', () => {
  it('classifies wallet rejection', () => {
    expect(classifyError({ message: 'User rejected the request.' })).toBe('CREATE_JOB_REJECTED');
    expect(classifyError({ shortMessage: 'MetaMask Tx Signature: User denied transaction signature.' })).toBe('CREATE_JOB_REJECTED');
  });

  it('classifies approval rejection', () => {
    expect(classifyError({ message: 'Approval was rejected by user.' })).toBe('APPROVAL_REJECTED');
  });

  it('classifies insufficient gas/ETH', () => {
    expect(classifyError({ message: 'insufficient funds for gas * price + value' })).toBe('INSUFFICIENT_ETH');
  });

  it('classifies RPC rate limit', () => {
    expect(classifyError({ message: 'HTTP 429 Too Many Requests' })).toBe('RPC_RATE_LIMITED');
    expect(classifyError({ message: 'rate limit exceeded' })).toBe('RPC_RATE_LIMITED');
  });

  it('classifies network/RPC unavailable', () => {
    expect(classifyError({ message: 'fetch failed: socket hang up' })).toBe('RPC_UNAVAILABLE');
    expect(classifyError({ message: 'ECONNREFUSED' })).toBe('RPC_UNAVAILABLE');
    expect(classifyError({ message: 'request timed out' })).toBe('RPC_UNAVAILABLE');
  });

  it('classifies execution revert', () => {
    expect(classifyError({ message: 'execution reverted: zero budget' })).toBe('CREATE_JOB_REVERTED');
  });

  it('classifies invalid intent', () => {
    expect(classifyError({ message: 'unsupported intent provided' })).toBe('INVALID_INTENT');
  });

  it('classifies wrong network', () => {
    expect(classifyError({ message: 'wrong network, expected chain 84532' })).toBe('WRONG_NETWORK');
  });

  it('falls back to UNKNOWN for null/empty/unknown', () => {
    expect(classifyError(null)).toBe('UNKNOWN_PROTOCOL_ERROR');
    expect(classifyError(undefined)).toBe('UNKNOWN_PROTOCOL_ERROR');
    expect(classifyError({ message: 'some completely different thing' })).toBe('UNKNOWN_PROTOCOL_ERROR');
  });

  it('handles viem Error-shaped objects with reason', () => {
    expect(classifyError({ reason: 'User rejected the request.' })).toBe('CREATE_JOB_REJECTED');
  });

  it('prefers shortMessage over message', () => {
    const e = { shortMessage: 'User rejected the request.', message: 'fetch failed' };
    expect(classifyError(e)).toBe('CREATE_JOB_REJECTED');
  });
});
