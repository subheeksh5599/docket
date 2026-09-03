import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// App pulls useWallet (viem) + the chain lib — mock both so routing logic is testable.
vi.mock('./hooks/useWallet', () => ({
  useWallet: () => ({ account: null, status: 'disconnected', error: null, connect: vi.fn(), disconnect: vi.fn() }),
}));

vi.mock('./lib/chain', () => ({
  REGISTRY: '0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48',
  DIAMOND: '0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8',
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  publicClient: { readContract: vi.fn().mockResolvedValue(0n) },
}));

vi.mock('./pages/HomePage', () => ({ default: () => <div>HOME-PAGE</div> }));
vi.mock('./pages/ReceiptsPage', () => ({ default: () => <div>RECEIPTS-PAGE</div> }));
vi.mock('./pages/ReceiptDetail', () => ({ default: ({ jobId }) => <div>RECEIPT-DETAIL:{jobId}</div> }));
vi.mock('./pages/VerifyPage', () => ({ default: () => <div>VERIFY-PAGE</div> }));
vi.mock('./pages/HowItWorks', () => ({ default: () => <div>HOW-IT-WORKS</div> }));

import App from './App';

describe('App hash routing', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders the home page by default', () => {
    render(<App />);
    expect(screen.getByText('HOME-PAGE')).toBeTruthy();
  });

  it('renders the receipts page at #/receipts', () => {
    window.location.hash = '#/receipts';
    render(<App />);
    expect(screen.getByText('RECEIPTS-PAGE')).toBeTruthy();
  });

  it('renders a single receipt at #/receipt/:id (permalink)', () => {
    window.location.hash = '#/receipt/28';
    render(<App />);
    expect(screen.getByText('RECEIPT-DETAIL:28')).toBeTruthy();
  });

  it('renders the verify page at #/verify', () => {
    window.location.hash = '#/verify';
    render(<App />);
    expect(screen.getByText('VERIFY-PAGE')).toBeTruthy();
  });

  it('renders how-it-works at #/how', () => {
    window.location.hash = '#/how';
    render(<App />);
    expect(screen.getByText('HOW-IT-WORKS')).toBeTruthy();
  });

  it('falls back to home for unknown routes', () => {
    window.location.hash = '#/nonsense';
    render(<App />);
    expect(screen.getByText('HOME-PAGE')).toBeTruthy();
  });
});
