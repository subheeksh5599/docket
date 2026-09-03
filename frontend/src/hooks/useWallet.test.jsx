import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import * as viem from 'viem';

// viem's CJS/ESM interop breaks under this vitest + React 19 stack ("default is
// not a function"). The hook's logic (switch chain, request accounts, wire events)
// is what we test — viem's transport mechanics are viem's own tested surface.
vi.mock('viem', () => {
  const requestFn = vi.fn(async () => ['0xabc']);
  const chainObj = { id: 84532, name: 'Base Sepolia' };
  return {
    createWalletClient: vi.fn(() => ({ requestAddresses: requestFn })),
    custom: vi.fn((p) => p),
    CHAIN: chainObj,
  };
});

// chain.js also builds public/viem clients at module load; useWallet only needs
// the chain constants from it.
vi.mock('../lib/chain', () => ({
  CHAIN: { id: 84532, name: 'Base Sepolia' },
  CHAIN_ID: 84532,
}));

import { useWallet } from './useWallet';

function Host() {
  const { account, status, error, connect, disconnect } = useWallet();
  return (
    <div>
      <span data-testid="account">{account || 'none'}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{error || ''}</span>
      <button onClick={() => connect()}>connect</button>
      <button onClick={() => disconnect()}>disconnect</button>
    </div>
  );
}

function makeProvider() {
  const listeners = {};
  const provider = {
    request: vi.fn(),
    on: (ev, fn) => { listeners[ev] = fn; },
    removeListener: () => {},
    _listeners: listeners,
  };
  return provider;
}

describe('useWallet', () => {
  let provider;
  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeProvider();
    // preserve jsdom's window/document — only attach the injected provider
    Object.defineProperty(globalThis, 'window', {
      value: globalThis.window ?? {},
      writable: true, configurable: true,
    });
    globalThis.window.ethereum = provider;
    provider.request.mockImplementation(async (args) => {
      if (args.method === 'wallet_switchEthereumChain') return null;
      if (args.method === 'eth_requestAccounts' || args.method === 'eth_accounts') return ['0xabc'];
      throw new Error(`unhandled ${args.method}`);
    });
  });

  it('starts disconnected with null account', () => {
    render(<Host />);
    expect(screen.getByTestId('account').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });

  it('connect() requests switch + addresses and sets account', async () => {
    render(<Host />);
    fireEvent.click(screen.getByText('connect'));
    await waitFor(() => expect(screen.getByTestId('account').textContent).toBe('0xabc'));
    expect(provider.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_switchEthereumChain' }));
    expect(screen.getByTestId('status').textContent).toBe('connected');
  });

  it('connect() adds Base Sepolia when wallet says code 4902', async () => {
    provider.request.mockImplementation(async (args) => {
      if (args.method === 'wallet_switchEthereumChain') {
        const e = new Error('not found'); e.code = 4902; throw e;
      }
      if (args.method === 'wallet_addEthereumChain') {
        expect(args.params[0].chainId).toBe('0x14a34');
        expect(args.params[0].chainName).toBe('Base Sepolia');
        return null;
      }
      if (args.method === 'eth_requestAccounts') return ['0xabc'];
      throw new Error(`unhandled ${args.method}`);
    });
    render(<Host />);
    fireEvent.click(screen.getByText('connect'));
    await waitFor(() => expect(screen.getByTestId('account').textContent).toBe('0xabc'));
    expect(provider.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_addEthereumChain' }));
  });

  it('connect() surfaces rejection errors without an account', async () => {
    // viem's requestAddresses rejects (user denied) — the hook must surface it
    const { requestAddresses } = vi.mocked(viem.createWalletClient)();
    requestAddresses.mockRejectedValueOnce(new Error('User rejected the request.'));
    render(<Host />);
    fireEvent.click(screen.getByText('connect'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('account').textContent).toBe('none');
    expect(screen.getByTestId('error').textContent).toMatch(/rejected/i);
  });

  it('reports when no wallet is installed', async () => {
    delete globalThis.window.ethereum;
    render(<Host />);
    fireEvent.click(screen.getByText('connect'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'));
    expect(screen.getByTestId('error').textContent).toMatch(/no wallet found/i);
  });

  it('disconnect() clears the account', async () => {
    render(<Host />);
    fireEvent.click(screen.getByText('connect'));
    await waitFor(() => expect(screen.getByTestId('account').textContent).toBe('0xabc'));
    fireEvent.click(screen.getByText('disconnect'));
    expect(screen.getByTestId('account').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });

  it('listens for accountsChanged and updates the account', async () => {
    render(<Host />);
    await act(async () => { provider._listeners.accountsChanged?.(['0xdef']); });
    expect(screen.getByTestId('account').textContent).toBe('0xdef');
    expect(screen.getByTestId('status').textContent).toBe('connected');
  });

  it('clears the account when accountsChanged empties', async () => {
    render(<Host />);
    await act(async () => { provider._listeners.accountsChanged?.(['0xabc']); });
    expect(screen.getByTestId('account').textContent).toBe('0xabc');
    await act(async () => { provider._listeners.accountsChanged?.([]); });
    expect(screen.getByTestId('account').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('disconnected');
  });
});
