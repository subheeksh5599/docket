import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReceiptBoard from './ReceiptBoard';

// The ReceiptBoard reads the chain via ../lib/chain — mock the reads so the
// component tests are deterministic (no live RPC in unit tests).
vi.mock('../lib/chain', () => ({
  fetchUserJobCount: vi.fn(),
  fetchReceipt: vi.fn(),
  publicClient: { readContract: vi.fn() },
  registryAbi: [],
  REGISTRY: '0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48',
}));

const chain = await import('../lib/chain');

describe('ReceiptBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.fetchUserJobCount.mockResolvedValue(0);
    chain.publicClient.readContract.mockResolvedValue(0n);
  });

  it('asks to connect when no wallet', () => {
    render(<ReceiptBoard wallet={{ account: null }} />);
    expect(screen.getByText(/connect your wallet/i)).toBeTruthy();
  });

  it('shows empty state when wallet connected and no receipts', async () => {
    render(<ReceiptBoard wallet={{ account: '0xabc' }} />);
    expect(await screen.findByText(/no receipts yet/i)).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows the receipt count from the chain', async () => {
    chain.fetchUserJobCount.mockResolvedValue(3);
    render(<ReceiptBoard wallet={{ account: '0xabc' }} />);
    expect(await screen.findByText('3')).toBeTruthy();
  });

  it('renders a resolved receipt card with MINTED state', async () => {
    chain.fetchUserJobCount.mockResolvedValue(1);
    chain.publicClient.readContract.mockResolvedValue(42n); // jobsOf returns job 42
    chain.fetchReceipt.mockResolvedValue({
      jobId: 42n, intentId: '0x11', questionHash: '0x22',
      answerHash: '0x' + 'ab'.repeat(32), createdAt: 1788355510n, resolved: true,
    });
    render(<ReceiptBoard wallet={{ account: '0xabc' }} />);
    expect(await screen.findByText(/job #42/i)).toBeTruthy();
    expect(screen.getByText('MINTED')).toBeTruthy();
    expect(screen.getByText(/commitment:/i)).toBeTruthy();
  });

  it('renders a pending receipt card', async () => {
    chain.fetchUserJobCount.mockResolvedValue(1);
    chain.publicClient.readContract.mockResolvedValue(7n); // jobsOf returns job 7
    chain.fetchReceipt.mockResolvedValue({
      jobId: 7n, intentId: '0x11', questionHash: '0x22',
      answerHash: '0x00', createdAt: 1788355510n, resolved: false,
    });
    render(<ReceiptBoard wallet={{ account: '0xabc' }} />);
    expect(await screen.findByText(/job #7/i)).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(screen.getByText(/waiting for the network/i)).toBeTruthy();
  });

  it('recovers gracefully when the chain read fails', async () => {
    chain.fetchUserJobCount.mockRejectedValue(new Error('RPC down'));
    render(<ReceiptBoard wallet={{ account: '0xabc' }} />);
    expect(await screen.findByText(/RPC down/i)).toBeTruthy();
  });

  it('bounded read: never reads more than the returned count', async () => {
    chain.fetchUserJobCount.mockResolvedValue(2);
    chain.publicClient.readContract
      .mockResolvedValueOnce(10n) // jobsOf(user, 0)
      .mockResolvedValueOnce(11n); // jobsOf(user, 1)
    chain.fetchReceipt.mockImplementation(async (id) => ({
      jobId: BigInt(id), intentId: '0x11', questionHash: '0x22',
      answerHash: '0x' + 'cd'.repeat(32), createdAt: 1788355510n, resolved: true,
    }));
    render(<ReceiptBoard wallet={{ account: '0xabc' }} />);
    await screen.findByText(/job #10/i);
    expect(chain.fetchReceipt).toHaveBeenCalledTimes(2);
  });
});
