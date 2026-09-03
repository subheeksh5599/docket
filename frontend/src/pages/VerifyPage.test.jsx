import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VerifyPage from './VerifyPage';

vi.mock('../lib/chain', () => ({
  REGISTRY: '0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48',
  fetchReceipt: vi.fn(),
}));

vi.mock('../lib/hash', () => ({
  canonicalAnswerHash: vi.fn((r) => '0x' + 'ab'.repeat(32)),
}));

const chain = await import('../lib/chain');

describe('VerifyPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects a non-numeric id', async () => {
    render(<VerifyPage />);
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText(/enter a numeric receipt id/i)).toBeTruthy();
  });

  it('shows VALID RECEIPT when all checks pass', async () => {
    chain.fetchReceipt.mockResolvedValue({
      jobId: 24n, intentId: '0x11', questionHash: '0x22',
      answerHash: '0x' + 'ab'.repeat(32), createdAt: 1788355510n, resolved: true,
    });
    render(<VerifyPage />);
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '24' } });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText(/VALID RECEIPT/i)).toBeTruthy();
    expect(screen.getByText(/receipt exists on-chain/i)).toBeTruthy();
    expect(screen.getByText(/receipt is locked/i)).toBeTruthy();
    expect(screen.getByText(/telegraph job resolved/i)).toBeTruthy();
    expect(screen.getByText(/MACHINE-READABLE RESULT/i)).toBeTruthy();
    expect(screen.getByText(/"verified": true/)).toBeTruthy();
  });

  it('reports when the pasted answer does not match the commitment', async () => {
    chain.fetchReceipt.mockResolvedValue({
      jobId: 24n, intentId: '0x11', questionHash: '0x22',
      answerHash: '0x' + 'ab'.repeat(32), createdAt: 1788355510n, resolved: true,
    });
    const hash = await import('../lib/hash');
    hash.canonicalAnswerHash.mockReturnValueOnce('0x' + 'cd'.repeat(32)); // different
    render(<VerifyPage />);
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '24' } });
    fireEvent.change(screen.getByPlaceholderText(/paste the network response/i), { target: { value: '{"answer":"x"}' } });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText(/INVALID RECEIPT/i)).toBeTruthy();
  });

  it('handles a missing receipt', async () => {
    chain.fetchReceipt.mockRejectedValue(new Error('no receipt'));
    render(<VerifyPage />);
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '999' } });
    fireEvent.click(screen.getByText('Verify'));
    expect(await screen.findByText(/no receipt #999 exists/i)).toBeTruthy();
  });
});
