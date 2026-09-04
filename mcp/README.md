# DOCKET MCP server — receipt verification for autonomous agents

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
DOCKET receipts to agents as independently verifiable facts. It reads the
ReceiptRegistry + Telegraph Diamond directly from Base Sepolia — no DOCKET
backend, no DOCKET database, no API key.

An agent can call these tools before acting on a result:

- `verify_docket_receipt` — is there a receipt for this job, is it locked and
  resolved, does the question commitment match?
- `get_docket_receipt` — the full on-chain receipt fields.
- `verify_docket_answer` — re-hash an answer payload and compare against the
  on-chain commitment (tamper detection).

## Run it

```bash
# offline self-test (keccak + canonical receipt-#28 hash vector, no RPC):
python3 docket_mcp.py --self-test

# under an MCP host (stdio transport):
DOCKET_REGISTRY=0xb5Ed97b4F10da09B9b54594925F0Ba5b528BBf48 \
  python3 docket_mcp.py
```

Works with Claude Desktop / any MCP client via stdio. Point the client at:

```json
{
  "mcpServers": {
    "docket": {
      "command": "python3",
      "args": ["/absolute/path/to/docket/mcp/docket_mcp.py"]
    }
  }
}
```

## Tools

| tool | input | returns |
|------|-------|---------|
| `verify_docket_receipt` | `job_id: int` | `{receipt, resolved, locked, question_commitment_matches, verified}` |
| `get_docket_receipt` | `job_id: int` | the full on-chain receipt struct |
| `verify_docket_answer` | `job_id: int`, `answer: object` | `{answer_hash, stored_commitment, match}` |
| `trace_docket_receipt` | `job_id: int` | full provenance graph: question → job → settlement → callback → answer → receipt |
| `assess_docket_receipt` | `job_id: int`, optional `required_intent`, `max_age_seconds` | structured facts: `internally_valid`, `safe_to_consume` — with an explicit note that DOCKET never declares the answer true |

All five default the registry from `DOCKET_REGISTRY` env or the compiled-in
canonical address. RPC defaults to `https://sepolia.base.org` (override with
`DOCKET_RPC`), and the verifier fails over across public RPCs.

The MCP server shares its verification core with `scripts/docket_verify.py`
(the CLI) — one code path, two front doors.
