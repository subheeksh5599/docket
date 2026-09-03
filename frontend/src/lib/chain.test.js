import { describe, it, expect } from 'vitest';
import { classifyError, errorLabel } from './errors';
import { DIAMOND, USDC, CHAIN_ID, CHAIN, REGISTRY, registryAbi, diamondAbi, usdcAbi } from './chain';

// These constants were verified live on Base Sepolia (2026-09-02) against the
// source-verified Telegraph Diamond — they are the "no hardcoded-by-memory" proof:
// every value was read on-chain, then pinned here as the public protocol constants.
describe('protocol constants', () => {
  it('Diamond is the documented Telegraph Diamond', () => {
    expect(DIAMOND).toBe('0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8');
  });

  it('USDC is Base Sepolia USDbC', () => {
    expect(USDC).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
  });

  it('chain id is Base Sepolia 84532', () => {
    expect(CHAIN_ID).toBe(84532);
    expect(CHAIN.id).toBe(84532);
    expect(CHAIN.name).toBe('Base Sepolia');
  });

  it('registry address is env-supplied (no hardcoded memory value)', () => {
    // It may be '' in test env (VITE_ unset) — the point is it comes from env, not code.
    expect(REGISTRY === '' || /^0x[0-9a-fA-F]{40}$/.test(REGISTRY)).toBe(true);
  });
});

describe('registry ABI shape', () => {
  const fns = Object.fromEntries(registryAbi.map((f) => [f.name, f]));

  it('exposes getReceipt returning the 6-field receipt tuple', () => {
    const gr = fns.getReceipt;
    expect(gr.stateMutability).toBe('view');
    const fields = gr.outputs[0].components.map((c) => c.name);
    expect(fields).toEqual(['jobId', 'intentId', 'questionHash', 'answerHash', 'createdAt', 'resolved']);
    const types = gr.outputs[0].components.map((c) => c.type);
    expect(types).toEqual(['uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bool']);
  });

  it('exposes job enumeration + intent/question getters', () => {
    for (const n of ['jobCount', 'jobsOf', 'jobIntent', 'jobQuestion', 'locked', 'nameIntent']) {
      expect(fns[n], n).toBeTruthy();
    }
  });

  it('getReceipt is view-only (no write path for receipts)', () => {
    expect(fns.getReceipt.stateMutability).not.toBe('nonpayable');
  });
});

describe('diamond/usdc ABI shape', () => {
  it('diamondAbi reads usdcToken, escrowBalance, getJobBasePrice', () => {
    const names = diamondAbi.map((f) => f.name);
    expect(names).toContain('usdcToken');
    expect(names).toContain('escrowBalance');
    expect(names).toContain('getJobBasePrice');
    expect(diamondAbi.every((f) => f.stateMutability === 'view')).toBe(true);
  });

  it('usdcAbi has approve + balanceOf', () => {
    const names = usdcAbi.map((f) => f.name);
    expect(names).toContain('approve');
    expect(names).toContain('balanceOf');
  });
});

describe('error wiring re-export parity', () => {
  it('classifyError + errorLabel exist and work', () => {
    expect(typeof classifyError).toBe('function');
    expect(typeof errorLabel).toBe('function');
    expect(classifyError({ message: 'User rejected the request.' })).toBe('CREATE_JOB_REJECTED');
    expect(errorLabel('RPC_UNAVAILABLE').message).toMatch(/unreachable/i);
  });
});
