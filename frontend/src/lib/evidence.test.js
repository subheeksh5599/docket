import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  receiptToEvidence, evidenceToJson, downloadEvidence, receiptPermalink,
  explorerTx, explorerAddress, verifyChecksSummary, EXPLORER,
} from './evidence';

const fullReceipt = {
  jobId: 23n,
  intentId: '0x2a50af6c9f1e6f5a4d3c2b1a098f7e6d5c4b3a291807f6e5d4c3b2a1908f7e6d5',
  questionHash: '0x5f8aa309e059516aaff6d218737f5740c073d7d8bbca87dd646930296e96e7b1',
  answerHash: '0x' + 'ab'.repeat(32),
  createdAt: 1788355510n,
  resolved: true,
  registry: '0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48',
};

describe('receiptToEvidence', () => {
  it('produces the v1 schema with jobId stringified', () => {
    const e = receiptToEvidence(fullReceipt);
    expect(e.schema).toBe('docket/receipt/v1');
    expect(e.jobId).toBe('23');
    expect(e.chainId).toBe(84532);
    expect(e.network).toBe('base-sepolia');
    expect(e.resolved).toBe(true);
  });

  it('carries the registry + explorer links', () => {
    const e = receiptToEvidence(fullReceipt);
    expect(e.registry).toBe(fullReceipt.registry);
    expect(e.explorer.receipt).toBe(`${EXPLORER}/tx/23`);
    expect(e.explorer.registry).toBe(`${EXPLORER}/address/${fullReceipt.registry}`);
  });

  it('nulls createdAt when missing', () => {
    const { createdAt, ...rest } = fullReceipt;
    expect(receiptToEvidence(rest).createdAt).toBeNull();
  });

  it('handles an unresolved receipt', () => {
    const e = receiptToEvidence({ ...fullReceipt, resolved: false, answerHash: '0x00' });
    expect(e.resolved).toBe(false);
  });

  it('attaches verify results when present', () => {
    const e = receiptToEvidence({ ...fullReceipt, _checks: { exists: true }, _pass: true });
    expect(e.verified.pass).toBe(true);
    expect(e.verified.checks.exists).toBe(true);
  });
});

describe('evidenceToJson', () => {
  it('serializes pretty JSON round-trippable', () => {
    const e = receiptToEvidence(fullReceipt);
    const json = evidenceToJson(e);
    expect(JSON.parse(json)).toEqual(e);
    expect(json).toContain('\n  "jobId"');
  });
});

describe('downloadEvidence', () => {
  it('creates and clicks a download link then revokes', () => {
    const clicks = [];
    const revoked = [];
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn((u) => revoked.push(u));
    globalThis.document.body.appendChild = vi.fn((el) => { el.click = () => clicks.push(el.download); });
    downloadEvidence(receiptToEvidence(fullReceipt), 23);
    expect(clicks).toEqual(['docket-receipt-23.json']);
    expect(revoked).toEqual(['blob:fake']);
  });
});

describe('receiptPermalink', () => {
  it('builds a #/receipt/:id hash link from the current origin', () => {
    expect(receiptPermalink(23)).toContain('#/receipt/23');
  });
});

describe('explorer helpers', () => {
  it('builds tx + address links', () => {
    expect(explorerTx('0xabc')).toBe(`${EXPLORER}/tx/0xabc`);
    expect(explorerAddress('0xdef')).toBe(`${EXPLORER}/address/0xdef`);
  });

  it('returns null for empty/zero values', () => {
    expect(explorerTx('')).toBeNull();
    expect(explorerTx('0x0')).toBeNull();
    expect(explorerAddress(null)).toBeNull();
  });
});

describe('verifyChecksSummary', () => {
  it('lists only passing checks in order', () => {
    const s = verifyChecksSummary({ exists: true, resolved: true, immutable: false, askBound: true });
    expect(s).toEqual([
      'receipt exists on-chain',
      'protocol marked the job resolved',
      'question commitment present (non-zero)',
    ]);
  });

  it('returns null for no checks', () => {
    expect(verifyChecksSummary(null)).toBeNull();
  });
});
