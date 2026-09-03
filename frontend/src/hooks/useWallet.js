import { useState, useCallback, useEffect } from 'react';
import { createWalletClient, custom } from 'viem';
import { CHAIN, CHAIN_ID } from '../lib/chain';

export function useWallet() {
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | error
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setStatus('error'); setError('No wallet found — install MetaMask or a Base-compatible wallet.');
      return;
    }
    try {
      setStatus('connecting');
      // ensure the right chain (Base Sepolia)
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + CHAIN_ID.toString(16) }] });
      } catch (e) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + CHAIN_ID.toString(16),
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org'],
            }],
          });
        }
      }
      const wallet = createWalletClient({ chain: CHAIN, transport: custom(window.ethereum) });
      const [addr] = await wallet.requestAddresses();
      setAccount(addr); setStatus('connected'); setError(null);
    } catch (err) {
      setStatus('error'); setError(err?.message || 'Connection failed');
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null); setStatus('disconnected'); setError(null);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.on) {
      const h = (accts) => { if (accts?.length) { setAccount(accts[0]); setStatus('connected'); } else { setAccount(null); setStatus('disconnected'); } };
      window.ethereum.on('accountsChanged', h);
      return () => window.ethereum?.removeListener?.('accountsChanged', h);
    }
  }, []);

  return { account, status, error, connect, disconnect };
}
