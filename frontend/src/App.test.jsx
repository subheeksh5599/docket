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

vi.mock('./pages/LandingPage', () => ({ default: () => <div>LANDING-PAGE</div> }));
vi.mock('./pages/Dashboard', () => ({ default: ({ tab, receiptId }) => <div>DASHBOARD:{tab}{receiptId ? `:${receiptId}` : ''}</div> }));

import App from './App';

describe('App hash routing', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('renders the landing page by default', () => {
    render(<App />);
    expect(screen.getByText('LANDING-PAGE')).toBeTruthy();
  });

  it('renders the dashboard at #/dashboard', () => {
    window.location.hash = '#/dashboard';
    render(<App />);
    expect(screen.getByText('DASHBOARD:record')).toBeTruthy();
  });

  it('renders a dashboard tab at #/dashboard/receipts', () => {
    window.location.hash = '#/dashboard/receipts';
    render(<App />);
    expect(screen.getByText('DASHBOARD:receipts')).toBeTruthy();
  });

  it('renders the act-on-a-receipt tab at #/dashboard/gate', () => {
    window.location.hash = '#/dashboard/gate';
    render(<App />);
    expect(screen.getByText('DASHBOARD:gate')).toBeTruthy();
  });

  it('renders a receipt permalink at #/r/:id', () => {
    window.location.hash = '#/r/28';
    render(<App />);
    expect(screen.getByText('DASHBOARD:receipt:28')).toBeTruthy();
  });

  it('legacy #/receipt/:id routes to the dashboard receipt tab', () => {
    window.location.hash = '#/receipt/24';
    render(<App />);
    expect(screen.getByText('DASHBOARD:receipt:24')).toBeTruthy();
  });

  it('legacy #/receipts routes to the dashboard receipts tab', () => {
    window.location.hash = '#/receipts';
    render(<App />);
    expect(screen.getByText('DASHBOARD:receipts')).toBeTruthy();
  });

  it('falls back to landing for unknown routes', () => {
    window.location.hash = '#/nonsense';
    render(<App />);
    expect(screen.getByText('LANDING-PAGE')).toBeTruthy();
  });
});
