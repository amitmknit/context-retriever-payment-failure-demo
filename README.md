# Payment-Failure Resolution Demo — Redis Context Retriever + Agent Memory

An end-to-end, **live-tested** demo of [Redis Context Retriever](https://redis.io/docs/latest/develop/ai/context-engine/context-retriever/)
and [Redis Agent Memory](https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/)
together: model a payment-failure domain over Redis-resident data, let
Context Retriever auto-generate the MCP tool surface, and have an agent
resolve *"Customer 1042's payment just failed — what happened and what
should we do?"* using only those generated tools — no SQL, no direct Redis
access from the agent. Agent Memory then layers conversation continuity
(short-term/session memory) and durable, cross-session recall about the
customer (long-term memory) on top of that same resolution.

Full design, field/index tables, and — importantly — what was actually verified
live vs. assumed: [`docs/specs/payment-failure-context-retriever-demo.md`](docs/specs/payment-failure-context-retriever-demo.md).

## What's real vs. simulated

Everything in this demo ran against a real Redis Cloud database and a real
Context Retriever service — nothing here is mocked. The one thing **not**
demonstrated as working is agent-key access-tag governance (tested live, did not
filter — see the spec's governance section).

## Prerequisites

- Python 3.11+ (the package requires it; `.venv` here was built with 3.13).
- A Redis Cloud database and a Context Retriever service already created for it
  (Redis Cloud console → **Context Retriever** → New service). This is private
  preview — see [Get access](https://redis.io/docs/latest/develop/ai/context-engine/context-retriever/#get-started-with-redis-context-retriever).
- An **admin key** for that service. The Cloud console doesn't display one
  directly on the service page; get it via:
  ```bash
  ctxctl auth login --username <your-redis-cloud-email>   # session login (SSO accounts may fail — see note below)
  ctxctl admin create --name "<your-name>-admin"
  ```
  If your account uses SSO (common for `@redis.com`), `auth login` returns
  `403` — there's no CLI SSO flow in this client version. Get a session-based
  admin key another way (internal Context Retriever contact, or a Cloud
  console account-level API key page if one exists for your org) and skip the
  CLI login step.
- An **agent key** for the surface (`ctxctl agent create --name <name> --surface-id <id>`
  or via the console's Agent Keys tab).
- A **Redis Cloud Agent Memory service** (separate from Context Retriever) —
  create one at Redis Cloud console → **Agent Memory** → New service, then
  copy its **Server URL**, **Store ID**, and **Store API key** from the
  Configuration page.

## Setup

```bash
python3.11 -m venv .venv   # or 3.12/3.13
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # if starting fresh; this repo's .env is already git-ignored
```

Fill in `.env`:
```
REDIS_ADDR=<host:port>
REDIS_USERNAME=default
REDIS_PASSWORD=<password>
REDIS_TLS=<true|false>

CTX_MCP_ENDPOINT=<service MCP URL, e.g. https://gcp-us-east4.context-surfaces.redis.io/mcp>
CTX_AGENT_KEY=<cs_agent_...>
CTX_ADMIN_KEY=<cs_admin_...>
CTX_SURFACE_ID=<surface id — printed by update_model.py, or from the console URL>

AGENT_MEMORY_BASE_URL=<e.g. https://gcp-us-east4.memory.redis.io>
AGENT_MEMORY_STORE_ID=<32-char store id>
AGENT_MEMORY_API_KEY=<store API key>
```

**Never commit `.env` or paste these values anywhere outside it** — `.env` is
git-ignored. If any of these were ever pasted into a chat/log, rotate them.

## Run order

```bash
.venv/bin/python3 update_model.py     # extends the surface's entity model (idempotent: safe to re-run)
.venv/bin/python3 seed_data.py        # imports ~22 sample records via UnifiedClient.import_data
.venv/bin/python3 demo_agent_flow.py  # runs the live agent resolution walkthrough
.venv/bin/python3 capability_tour.py  # optional: exercises each tool class individually (lookup/filter/search/count/summarize/expand)
.venv/bin/python3 demo_agent_flow_with_memory.py  # optional: layers session + long-term memory on top of the resolution flow
```

`update_model.py` prints the tool list before/after — you should see it grow from
5 generic tools to ~28 covering all five entities plus relationship traversal.

## The web UI (recommended for customer demos)

```bash
.venv/bin/python3 -m uvicorn webapp.server:app --port 8800
```
Then open <http://127.0.0.1:8800>.

A Redis-branded product UI that presents the whole demo without a terminal —
six sections: live environment overview, the entity model (with an inspector
that shows the real RedisJSON document behind each entity), the resolution
walkthrough with real tool calls streaming in beside a live session-memory
transcript, a capability tour, the memory panels, and governance.

Credentials stay server-side; the browser only ever receives data. Every
number and response is a live service call — there are no fixtures. Light and
dark themes both supported.

## Presenting this to a customer

See [`RUNBOOK.md`](RUNBOOK.md) for the exact pre-flight checks, talk track, and
live commands to run per capability (point lookup, filter, text search,
count/summarize, and the relationship-traversal "join") — including the one
governance finding to disclose rather than demo as working.

## Files

| File | Purpose |
|---|---|
| `models.py` | `ContextModel`/`ContextField`/`ContextRelationship` definitions for the 5 entities |
| `update_model.py` | Pushes `models.py` to the live surface via the admin API |
| `seed_data.py` | Loads sample data via `UnifiedClient.import_data` |
| `demo_agent_flow.py` | Runs the agent-key-only resolution walkthrough |
| `capability_tour.py` | Runs each generated tool class individually for live demos |
| `webapp/server.py` | FastAPI backend for the web UI — proxies to Context Retriever, Agent Memory, and Redis |
| `webapp/static/` | The customer-facing UI (Redis product-UI styling, light + dark) |
| `agent_memory_helpers.py` | Thin wrappers over `redis-agent-memory`: session turns, long-term facts, recall |
| `demo_agent_flow_with_memory.py` | Same resolution flow, plus session continuity and cross-session recall via Agent Memory |
| `RUNBOOK.md` | Customer-facing demo script: pre-flight, talk track, teardown |
| `docs/specs/payment-failure-context-retriever-demo.md` | Full spec, including live test results and the one thing that didn't work as documented |
