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
}));

vi.mock('./components/AskPanel', () => ({ default: () => <div>ASK-PANEL</div> }));
vi.mock('./components/ReceiptBoard', () => ({ default: () => <div>RECEIPT-BOARD</div> }));
vi.mock('./components/ReceiptView', () => ({ default: ({ jobId }) => <div>RECEIPT-VIEW:{jobId}</div> }));
vi.mock('./components/TrustPage', () => ({ default: () => <div>TRUST-PAGE</div> }));

import App from './App';

describe('App hash routing', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders the ask panel by default', () => {
    render(<App />);
    expect(screen.getByText('ASK-PANEL')).toBeTruthy();
  });

  it('renders the receipt board at #/receipts', () => {
    window.location.hash = '#/receipts';
    render(<App />);
    expect(screen.getByText('RECEIPT-BOARD')).toBeTruthy();
  });

  it('renders a single receipt at #/receipt/:id (permalink)', () => {
    window.location.hash = '#/receipt/23';
    render(<App />);
    expect(screen.getByText('RECEIPT-VIEW:23')).toBeTruthy();
  });

  it('renders the trust page at #/trust', () => {
    window.location.hash = '#/trust';
    render(<App />);
    expect(screen.getByText('TRUST-PAGE')).toBeTruthy();
  });

  it('falls back to ask for unknown routes', () => {
    window.location.hash = '#/nonsense';
    render(<App />);
    expect(screen.getByText('ASK-PANEL')).toBeTruthy();
  });
});
