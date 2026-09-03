// Pending-job persistence — localStorage-backed so an in-flight Telegraph job
// survives a browser close. When the user comes back, the job is still
// discoverable (job id + tx hash are public chain data; nothing here is
// sensitive). No mocks: rows are only written after a real submit tx.

const KEY = 'docket.pendingJobs.v1';

export function savePendingJob(job) {
  // job: { owner, question, intent, jobId?, txHash, approveHash?, submittedAt }
  if (typeof localStorage === 'undefined') return;
  try {
    const all = loadPendingJobs();
    const i = all.findIndex((j) => j.owner === job.owner && j.txHash === job.txHash);
    if (i >= 0) all[i] = { ...all[i], ...job };
    else all.push(job);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-10))); // keep the last 10
  } catch { /* storage full/blocked — non-fatal */ }
}

export function loadPendingJobs() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function removePendingJob(owner, txHash) {
  if (typeof localStorage === 'undefined') return;
  try {
    const all = loadPendingJobs().filter((j) => !(j.owner === owner && j.txHash === txHash));
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* non-fatal */ }
}

export function clearPendingJobs() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* non-fatal */ }
}
