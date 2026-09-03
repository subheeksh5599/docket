import { useState, useEffect, useMemo } from 'react';
import { REGISTRY, fetchRecentReceipts, fetchUserJobCount, intentNameOf } from '../lib/chain';
import { fetchJobIdAt } from '../lib/registryFeed';
import { receiptPermalink, explorerTx } from '../lib/evidence';

// Receipts — an Etherscan-style index of permanent records. Search + filters
// over live chain reads. Row: id, intent, question hash, status, share, date.

const short = (s) => (s ? String(s).slice(0, 6) + '…' + String(s).slice(-4) : '—');
const timeAgo = (ts) => {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ReceiptsPage({ wallet }) {
  const [all, setAll] = useState(null); // global recent receipts
  const [mine, setMine] = useState(null); // this wallet's receipts
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All'); // All | Pending | Resolved | My receipts

  // load global + (if connected) my receipts
  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setErr(null);
      const [recent, mineIds] = await Promise.all([
        fetchRecentReceipts(50),
        wallet.account && REGISTRY ? loadMine(wallet.account) : Promise.resolve(null),
      ]);
      if (!live) return;
      setAll(recent || []);
      setMine(mineIds || []);
      setLoading(false);
    })().catch((e) => { if (live) { setErr(e?.message || 'Failed to load'); setLoading(false); } });
    return () => { live = false; };
  }, [wallet.account]);

  async function loadMine(address) {
    try {
      const n = await fetchUserJobCount(address);
      const rows = [];
      for (let i = 0; i < Math.min(n, 50); i++) {
        try {
          const jobId = Number(await fetchJobIdAt(address, i));
          const { fetchReceipt } = await import('../lib/chain');
          const r = await fetchReceipt(jobId);
          rows.push({
            jobId, owner: address, intentId: r.intentId, questionHash: r.questionHash,
            answerHash: r.answerHash, createdAt: Number(r.createdAt), resolved: r.resolved,
          });
        } catch { /* skip */ }
      }
      return rows.sort((a, b) => b.jobId - a.jobId);
    } catch { return []; }
  }

  const shown = useMemo(() => {
    let rows = filter === 'My receipts' ? (mine ?? []) : (all ?? []);
    if (filter === 'Pending') rows = rows.filter((r) => !r.resolved);
    if (filter === 'Resolved') rows = rows.filter((r) => r.resolved);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        String(r.jobId).includes(q) ||
        String(r.questionHash || '').toLowerCase().includes(q) ||
        String(r.intentId || '').toLowerCase().includes(q) ||
        String(r.owner || '').toLowerCase().includes(q.replace(/^0x/, ''))
      );
    }
    return rows;
  }, [all, mine, query, filter]);

  const FILTERS = ['All', 'Pending', 'Resolved', 'My receipts'];

  return (
    <div style={{ padding: 'clamp(8px, 1vw, 12px) 0 24px' }}>
      {/* header */}
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Receipts</h1>
      <p style={{ marginTop: 6, fontSize: 13.5, color: 'var(--muted)' }}>
        Permanent records produced by Telegraph jobs. {REGISTRY ? '' : '— registry env unset.'}
      </p>

      {/* live count — the adoption line */}
      {!loading && all && all.length > 0 && (
        <div className="label" style={{ marginTop: 14, fontSize: 9, color: 'var(--gain)', letterSpacing: '0.08em' }}>
          {all.length} receipt{all.length === 1 ? '' : 's'} minted on Base Sepolia — every record below originates from a real Telegraph job.
        </div>
      )}

      {/* search + filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22, alignItems: 'center' }}>
        <div className="term-search" style={{ flex: '1 1 260px' }}>
          <span className="label" style={{ color: 'var(--faint)' }}>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search by job id, hash, wallet…" />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`filter-pill ${filter === f ? 'filter-on' : ''}`} style={{ fontSize: 11, padding: '7px 11px' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="panel" style={{ padding: '12px 16px', borderColor: 'var(--loss)', marginTop: 16 }}>
          <span className="label" style={{ color: 'var(--loss)' }}>⚠ {err}</span>
        </div>
      )}

      {/* rows */}
      <div style={{ marginTop: 18 }}>
        {loading && (
          <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
            <span className="label" style={{ color: 'var(--faint)' }}>reading the chain…</span>
          </div>
        )}
        {!loading && shown.length === 0 && (
          <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <span className="label" style={{ color: 'var(--faint)' }}>
              {filter === 'My receipts' ? 'no receipts for this wallet yet — ask the network and the record starts here.' : 'no receipts match this filter.'}
            </span>
          </div>
        )}
        {!loading && shown.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 12, padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <span className="label" style={{ width: 46, flexShrink: 0, fontSize: 9 }}>ID</span>
              <span className="label" style={{ width: 96, flexShrink: 0, fontSize: 9 }}>INTENT</span>
              <span className="label" style={{ flex: 1, fontSize: 9 }}>QUESTION (COMMITMENT)</span>
              <span className="label" style={{ width: 78, flexShrink: 0, fontSize: 9 }}>STATUS</span>
              <span className="label" style={{ width: 74, flexShrink: 0, fontSize: 9, textAlign: 'right' }}>DATE</span>
              <span className="label" style={{ width: 56, flexShrink: 0, fontSize: 9, textAlign: 'right' }}>SHARE</span>
            </div>
            {shown.map((r) => (
              <div key={r.jobId} style={{ display: 'flex', gap: 12, padding: '13px 16px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                <a href={receiptPermalink(r.jobId)} style={{ textDecoration: 'none', display: 'contents' }}>
                  <span className="tnum" style={{ width: 46, flexShrink: 0, fontSize: 12.5, color: 'var(--ink)' }}>#{r.jobId}</span>
                  <span className="label tnum" style={{ width: 96, flexShrink: 0, fontSize: 9, color: 'var(--faint)', letterSpacing: '0.04em' }}>{intentNameOf(r.intentId)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {short(r.questionHash)}
                  </span>
                  <span className="label" style={{ width: 78, flexShrink: 0, fontSize: 9, color: r.resolved ? 'var(--gain)' : 'var(--signal)' }}>
                    {r.resolved ? 'RESOLVED' : 'PENDING'}
                  </span>
                  <span className="label tnum" style={{ width: 74, flexShrink: 0, fontSize: 9, color: 'var(--faint)', textAlign: 'right' }}>
                    {timeAgo(r.createdAt)}
                  </span>
                </a>
                <button
                  onClick={() => {
                    const url = window.location.origin + receiptPermalink(r.jobId);
                    navigator.clipboard?.writeText(url).then(() => {
                      const el = document.getElementById('share-' + r.jobId);
                      if (el) { el.textContent = '✓'; setTimeout(() => { el.textContent = 'share'; }, 1400); }
                    }).catch(() => {});
                  }}
                  className="label"
                  id={'share-' + r.jobId}
                  style={{ width: 56, flexShrink: 0, fontSize: 9, textAlign: 'right', color: 'var(--signal)', background: 'none', border: 0, cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}
                  title="copy permalink"
                >
                  share
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <span className="label" style={{ fontSize: 9, color: 'var(--faint)' }}>
          {filter === 'My receipts' ? 'your receipts, read live per-wallet. ' : ''}every receipt ever minted on this registry, read live from the chain. every row opens a permalink that verifies from the chain.
        </span>
      </div>
    </div>
  );
}
