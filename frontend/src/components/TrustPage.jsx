import { REGISTRY, DIAMOND, USDC } from '../lib/chain';
import { explorerAddress } from '../lib/evidence';

export default function TrustPage() {
  return (
    <main className="max-w-[900px] mx-auto px-8 py-16 pb-24">
      <p className="eyebrow text-neon-pulse mb-2">WHY TRUST THIS</p>
      <h1 className="font-aeonikfono font-medium text-4xl md:text-5xl leading-tight text-pure-white mb-8">
        The network wrote it. Not us. Not you.
      </h1>

      <div className="space-y-6 text-pure-white/70 text-[15px] leading-relaxed">
        <section className="card-dark p-6">
          <h2 className="font-aeonikfono text-xl text-pure-white mb-3">No database. No server. No delete button.</h2>
          <p>
            DOCKET has no backend. There is nothing to hack, censor, or quietly edit. Your
            question is committed to the <strong className="text-pure-white">ReceiptRegistry</strong>, a
            smart contract on Base Sepolia, before any miner sees it. When Telegraph's network
            resolves the job, the protocol's callback writes the answer commitment to the same
            contract in a single transaction. After that the receipt is <strong className="text-pure-white">locked</strong> —
            the contract has no update function. It cannot be edited, deleted, or re-minted.
          </p>
        </section>

        <section className="card-dark p-6">
          <h2 className="font-aeonikfono text-xl text-pure-white mb-3">The receipt is an anchor, not an opinion</h2>
          <p>
            The record stores cryptographic commitments: <code className="font-mono text-xs">keccak256</code> hashes
            of the question and the network's returned answer payload. DOCKET's invariant —
            printed in the footer of every page — is that it <em>records what the network
            returned</em>. It never declares what is true. The hash is the anchor: anyone can
            re-hash the original payload with the same rule and confirm the receipt matches,
            forever, with no trusted party.
          </p>
        </section>

        <section className="card-dark p-6">
          <h2 className="font-aeonikfono text-xl text-pure-white mb-3">Real miners. Real payment. Real callbacks.</h2>
          <p>
            Every request escrows real testnet USDC into the Telegraph Diamond (the protocol's
            own escrow — DOCKET never holds funds) and issues an ERC-8183 <code className="font-mono text-xs">createJob</code>.
            Telegraph routes the job to a real registered miner, who is paid on resolution.
            The callback that mints your receipt is the same callback that settles the miner —
            so the receipt is minted by the exact mechanism the protocol uses to pay for work.
          </p>
        </section>

        <section className="card-dark p-6">
          <h2 className="font-aeonikfono text-xl text-pure-white mb-3">Independently verifiable, no DOCKET required</h2>
          <p>
            Every claim can be checked from a plain explorer or a one-line RPC call:
          </p>
          <ul className="list-disc list-inside space-y-1.5 mt-3 text-pure-white/60 font-mono text-xs">
            <li>ReceiptRegistry source is verified on Blockscout (matches this repo).</li>
            <li>Read <code className="text-neon-pulse">getReceipt(jobId)</code> from any RPC.</li>
            <li>Check the job on the Telegraph Diamond: <code className="text-neon-pulse">getJob(jobId)</code>.</li>
            <li>Re-hash the answer payload and compare — the rule is public.</li>
          </ul>
        </section>

        <section className="card-dark p-6">
          <h2 className="font-aeonikfono text-xl text-pure-white mb-3">What DOCKET does NOT claim</h2>
          <ul className="list-disc list-inside space-y-1.5 mt-2">
            <li>It does not certify answers as true — miners can be wrong, and the record preserves that honestly.</li>
            <li>It is not a wallet, bank, or custodian — escrow is the protocol's payment rail only.</li>
            <li>It is not a court or oracle — nothing here settles disputes; it records outcomes.</li>
            <li>Questions and receipts are public on-chain data — treat them as public.</li>
          </ul>
        </section>

        <section className="card-dark border border-neon-pulse/30 p-6">
          <h2 className="font-aeonikfono text-xl text-neon-pulse mb-4">Verify the anchors yourself</h2>
          <div className="grid gap-2 font-mono text-xs text-pure-white/70 break-all">
            <p><span className="eyebrow text-pure-white/40 block mb-1">RECEIPT REGISTRY (VERIFIED SOURCE)</span>
              <a className="text-neon-pulse underline" href={explorerAddress(REGISTRY)} target="_blank" rel="noreferrer">{REGISTRY || '— set VITE_REGISTRY_ADDRESS'}</a>
            </p>
            <p><span className="eyebrow text-pure-white/40 block mb-1 mt-3">TELEGRAPH DIAMOND</span>
              <a className="text-neon-pulse underline" href={explorerAddress(DIAMOND)} target="_blank" rel="noreferrer">{DIAMOND}</a>
            </p>
            <p><span className="eyebrow text-pure-white/40 block mb-1 mt-3">USDC (ESCROW TOKEN)</span>
              <a className="text-neon-pulse underline" href={explorerAddress(USDC)} target="_blank" rel="noreferrer">{USDC}</a>
            </p>
          </div>
          <p className="mt-5 text-xs text-pure-white/40">
            Registry address is injected at build time via VITE_REGISTRY_ADDRESS. Diamond and USDC are
            public protocol constants verified on-chain 2026-09-02 (see docs/TELEGRAPH_DEPLOYMENT.md).
          </p>
        </section>
      </div>
    </main>
  );
}
