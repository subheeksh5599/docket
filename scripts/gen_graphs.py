#!/usr/bin/env python3
"""Generate the README's live on-chain graphs for DOCKET.

Reads ReceiptMinted logs for the canonical registry on Base Sepolia via
eth_getLogs (chunked, since RPCs cap ranges at ~10k blocks), then writes
three SVG graphs under assets/:

  graph-receipts-cumulative.svg  — every receipt minted, in order (cumulative)
  graph-escrow-total.svg         — total USDC escrowed through the pipeline
  graph-intents.svg              — receipts grouped by intent

Every marker is a real on-chain receipt. No fabricated points. Regenerate
after new receipts land:  python3 scripts/gen_graphs.py
"""
import json
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

REGISTRY = "0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48"
RPC = "https://sepolia.base.org"
DEPLOY_BLOCK = 46293484  # v2 registry deployment (2026-09-02)
# ReceiptMinted(uint256 indexed jobId, address indexed owner, bytes32 indexed
# intentId, bytes32 questionHash, bytes32 answerHash, uint256 timestamp)
MINT_TOPIC = "0x1d8c52cad4269029478d2807c19efd2deab8e4c32cae3a9ba3e0e94b1b183fe1"

ASSETS = "assets"


def rpc(method, params):
    body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
    req = urllib.request.Request(RPC, data=body, headers={
        "Content-Type": "application/json",
        "User-Agent": "docket-gen-graphs/1.0",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def latest_block():
    return int(rpc("eth_blockNumber", [])["result"], 16)


def fetch_logs():
    to = latest_block()
    logs = []
    frm = DEPLOY_BLOCK
    while frm <= to:
        end = min(frm + 9000, to)
        res = rpc("eth_getLogs", [{"address": REGISTRY, "topics": [MINT_TOPIC], "fromBlock": hex(frm), "toBlock": hex(end)}])
        logs.extend(res.get("result", []))
        frm = end + 1
    rows = []
    for l in logs:
        t = l["topics"]
        data = l["data"]
        rows.append({
            "jobId": int(t[1], 16),
            "owner": "0x" + t[2][-40:],
            "intent": t[3],
            "questionHash": "0x" + data[2:66],
            "answerHash": "0x" + data[66:130],
            "ts": int(data[130:194], 16),
            "blk": int(l.get("blockNumber", "0x0"), 16),
        })
    rows.sort(key=lambda r: r["jobId"])
    return rows


def cumulative_graph(rows):
    pts = []
    n = 0
    for r in rows:
        n += 1
        pts.append((r["ts"], n))
    for i in range(1, len(pts)):  # spread same-minute mints
        if pts[i][0] - pts[i - 1][0] < 120:
            pts[i] = (pts[i][0] + 60, pts[i][1])

    W, H = 900, 260
    PL, PR, PT, PB = 60, 20, 30, 44
    t0 = pts[0][0] - 3600
    t1 = max(p[0] for p in pts) + 3600
    total = len(rows)
    X = lambda t: PL + (t - t0) / (t1 - t0) * (W - PL - PR)
    Y = lambda v: H - PB - v / max(total, 1) * (H - PT - PB)

    s = []
    a = s.append
    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="ui-monospace, Menlo, monospace">')
    a(f'<rect width="{W}" height="{H}" fill="#faf9f5"/>')
    for v in range(0, total + 1):
        y = Y(v)
        a(f'<line x1="{PL}" y1="{y:.1f}" x2="{W-PR}" y2="{y:.1f}" stroke="#e5e2da"/>')
        a(f'<text x="{PL-8}" y="{y+4:.1f}" text-anchor="end" font-size="11" fill="#8a877e">{v}</text>')
    for (ts, _) in pts:
        x = X(ts)
        lab = datetime.fromtimestamp(ts, timezone.utc).strftime("%m-%d %H:%M")
        a(f'<text x="{x:.1f}" y="{H-PB+16}" text-anchor="middle" font-size="10" fill="#8a877e" transform="rotate(-35 {x:.1f} {H-PB+16})">{lab}Z</text>')
    prev = None
    for (ts, v) in pts:
        x, y = X(ts), Y(v)
        if prev:
            px_, py_ = prev
            a(f'<line x1="{px_:.1f}" y1="{py_:.1f}" x2="{x:.1f}" y2="{py_:.1f}" stroke="#1d1f24" stroke-width="2"/>')
            a(f'<line x1="{x:.1f}" y1="{py_:.1f}" x2="{x:.1f}" y2="{y:.1f}" stroke="#c6d452" stroke-width="2"/>')
        else:
            a(f'<line x1="{X(t0):.1f}" y1="{Y(0):.1f}" x2="{x:.1f}" y2="{y:.1f}" stroke="#c6d452" stroke-width="2"/>')
        prev = (x, y)
    for (ts, v) in pts:
        x, y = X(ts), Y(v)
        a(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#c6d452" stroke="#1d1f24" stroke-width="1.5"/>')
    for i, ((ts, v), r) in enumerate(zip(pts, rows)):
        x, y = X(ts), Y(v)
        dy = -12 if i % 2 == 0 else 20
        a(f'<text x="{x:.1f}" y="{y+dy:.1f}" text-anchor="middle" font-size="11" fill="#1d1f24" font-weight="600">#{r["jobId"]}</text>')
    a(f'<text x="{PL}" y="18" font-size="12" fill="#1d1f24" font-weight="600">Receipts minted — cumulative ({total} on-chain)</text>')
    a("</svg>")
    return "\n".join(s)


def escrow_graph(total):
    W, H = 420, 220
    s = []
    a = s.append
    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="ui-monospace, Menlo, monospace">')
    a(f'<rect width="{W}" height="{H}" fill="#faf9f5"/>')
    bh = (H - 90) * total / 5.0
    a(f'<rect x="60" y="{H-60-bh:.1f}" width="80" height="{bh:.1f}" fill="#1d1f24"/>')
    a(f'<text x="100" y="{H-60-bh-10:.1f}" text-anchor="middle" font-size="22" font-weight="700" fill="#1d1f24">${total}.00</text>')
    a(f'<text x="100" y="{H-36}" text-anchor="middle" font-size="11" fill="#8a877e">USDC escrowed ({total} jobs x $1)</text>')
    a(f'<text x="16" y="18" font-size="12" fill="#1d1f24" font-weight="600">Total protocol value moved</text>')
    a("</svg>")
    return "\n".join(s)


def intent_graph(counts):
    W, H = 460, 240
    s = []
    a = s.append
    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="ui-monospace, Menlo, monospace">')
    a(f'<rect width="{W}" height="{H}" fill="#faf9f5"/>')
    colors = ["#1d1f24", "#c6d452", "#8a877e"]
    y = 20
    for (name, cnt), col in zip(counts.items(), colors):
        bw = cnt * 26
        a(f'<rect x="140" y="{y}" width="{bw}" height="20" fill="{col}"/>')
        a(f'<text x="132" y="{y+15}" text-anchor="end" font-size="11" fill="#1d1f24">{name}</text>')
        a(f'<text x="{148+bw}" y="{y+15}" font-size="11" fill="#8a877e">{cnt}</text>')
        y += 34
    a(f'<text x="16" y="18" font-size="12" fill="#1d1f24" font-weight="600">Receipts by intent (live)</text>')
    a("</svg>")
    return "\n".join(s)


def main():
    rows = fetch_logs()
    if not rows:
        print("no receipts found — is the RPC reachable?"); sys.exit(1)
    # intent names are the protocol's registered labels for the live receipts
    # (documented in docs/DEPLOYMENT_MANIFEST.yaml); intent field is the hash.
    import collections
    intent_of = {
        "0x2a50af6c2576add2d054c7dd3176ae33bf33b67d0b2eb9c6f8bd6f4f53a1d51a": "CRYPTO_PRICE",
        "0x3db9dfa99f2319adb30c5860240fd78a91663b355591ab2083c86a26aad04e7d": "GAS_PRICE",
        "0x35b355e67b358906a7d64d7d727d0f33c1a465dd7508b3dc8e569ec46f231eaa": "WEATHER_CHECK",
    }
    counts = collections.Counter(intent_of.get(r["intent"], "OTHER") for r in rows)

    open(f"{ASSETS}/graph-receipts-cumulative.svg", "w").write(cumulative_graph(rows))
    open(f"{ASSETS}/graph-escrow-total.svg", "w").write(escrow_graph(len(rows)))
    open(f"{ASSETS}/graph-intents.svg", "w").write(intent_graph(counts))
    print(f"wrote 3 graphs from {len(rows)} live receipts: "
          f"{', '.join(f'{k}={v}' for k, v in counts.items())}")


if __name__ == "__main__":
    main()
