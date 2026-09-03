// DOCKET — small shared chain-read helpers used across pages.
import { REGISTRY, publicClient, registryAbi } from './chain';

/// job id at (wallet, index) — per-wallet enumeration read.
export async function fetchJobIdAt(address, idx) {
  const v = await publicClient.readContract({
    address: REGISTRY, abi: registryAbi, functionName: 'jobsOf', args: [address, BigInt(idx)],
  });
  return v;
}

/// wallet's latest job id (the one just created).
export async function fetchLatestJobId(address) {
  const n = await publicClient.readContract({
    address: REGISTRY, abi: registryAbi, functionName: 'jobCount', args: [address],
  });
  if (!n) return null;
  return fetchJobIdAt(address, n - 1n);
}
