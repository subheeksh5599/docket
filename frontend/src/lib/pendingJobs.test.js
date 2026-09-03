import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { savePendingJob, loadPendingJobs, removePendingJob, clearPendingJobs } from './pendingJobs';

// localStorage-backed pending-job persistence (browser-close survival).

function mockStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store,
  };
}

describe('pendingJobs', () => {
  beforeEach(() => {
    global.localStorage = mockStorage();
  });
  afterEach(() => {
    delete global.localStorage;
  });

  it('saves and loads a pending job', () => {
    savePendingJob({ owner: '0xabc', question: 'Q?', txHash: '0x1', jobId: 7 });
    const all = loadPendingJobs();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ owner: '0xabc', question: 'Q?', txHash: '0x1', jobId: 7 });
  });

  it('dedupes by owner+txHash on re-save', () => {
    savePendingJob({ owner: '0xabc', question: 'Q1', txHash: '0x1' });
    savePendingJob({ owner: '0xabc', question: 'Q1 updated', txHash: '0x1', jobId: 9 });
    const all = loadPendingJobs();
    expect(all).toHaveLength(1);
    expect(all[0].jobId).toBe(9);
  });

  it('keeps separate jobs for different wallets', () => {
    savePendingJob({ owner: '0xabc', question: 'Q1', txHash: '0x1' });
    savePendingJob({ owner: '0xdef', question: 'Q2', txHash: '0x2' });
    expect(loadPendingJobs()).toHaveLength(2);
  });

  it('removes a resolved job by owner+txHash', () => {
    savePendingJob({ owner: '0xabc', question: 'Q1', txHash: '0x1' });
    savePendingJob({ owner: '0xabc', question: 'Q2', txHash: '0x2' });
    removePendingJob('0xabc', '0x1');
    const all = loadPendingJobs();
    expect(all).toHaveLength(1);
    expect(all[0].txHash).toBe('0x2');
  });

  it('caps at the last 10 jobs', () => {
    for (let i = 0; i < 15; i++) savePendingJob({ owner: '0xabc', question: `Q${i}`, txHash: `0x${i}` });
    expect(loadPendingJobs()).toHaveLength(10);
  });

  it('clear removes everything', () => {
    savePendingJob({ owner: '0xabc', question: 'Q1', txHash: '0x1' });
    clearPendingJobs();
    expect(loadPendingJobs()).toHaveLength(0);
  });
});
