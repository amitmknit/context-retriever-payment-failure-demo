# Spec: Payment-Failure Resolution Demo on Redis Context Retriever

## Problem

A support/fraud-ops agent investigating a failed payment today either gets a
hand-built tool per data source (tool-zoo sprawl) or raw DB/SQL access (security
risk, brittle). This demo shows, end to end and against a **real, live** Context
Retriever service, how a data model over Redis-resident payment data becomes a
governed set of MCP tools an agent calls to resolve a payment failure.

Sources: [Context Retriever docs](https://redis.io/docs/latest/develop/ai/context-engine/context-retriever/),
[`redis-context-retriever` PyPI README](https://pypi.org/project/redis-context-retriever/)
(fetched and read in full — see "API notes" below for what's directly confirmed vs.
inferred).

## Live environment (this demo)

- Redis Cloud database: `icicle-legs-scarecrow-84167.db.redis.io:16801` — empty at
  start, safe to seed.
- Context Retriever service: `amalik-context-payment-demo`, MCP endpoint
  `https://gcp-us-east4.context-surfaces.redis.io/mcp`.
- Existing model on that surface (confirmed via a live `tools/list` call): a single
  `Customer` entity with only an `id` key field — no other entities, no relationships.
- Credentials live in the git-ignored `demos/context-retriever-payment-failure/.env`
  (`REDIS_*`, `CTX_MCP_ENDPOINT`, `CTX_AGENT_KEY`, `CTX_ADMIN_KEY`) — never committed,
  never printed.

## API notes (confirmed vs. inferred)

Confirmed by reading the live package README and probing the live MCP endpoint:

- Auth header for both the admin API and the MCP endpoint is `X-API-Key` (not
  `Authorization: Bearer`).
- Admin keys provision (create/update surfaces, agent keys); agent keys only invoke
  already-generated tools.
- Console-managed (Redis Cloud) surfaces don't expose an admin key in the UI. Get one
  via `ctxctl auth login --username <you>` (Redis Cloud session login, browser OAuth —
  **the user performs this login themselves**) followed by `ctxctl admin create`.
- `ContextModel` / `ContextField` (from `context_surfaces.context_model`) define
  entities: `__redis_key_template__`, `is_key_component`, `index` (`text`/`tag`/
  `numeric`), `allowed_values` (tag-only).
- Generated per-entity tools follow a `<verb>_<entity>_by_<field>` naming pattern
  (`get_customer_by_id`, `filter_customer_by_city`, `search_customer_by_text`), plus
  cross-entity set-algebra tools (`union_results`, `intersect_results`,
  `except_results`, `expand_results`) that take an `expand_to`/`relationship`
  parameter to traverse a declared relationship.
- `UnifiedClient.import_data(...)` is the **documented, recommended** way to load data
  once a model is provisioned — the README explicitly warns against writing records
  directly to Redis unless you intend to manage the full storage/index contract
  yourself. This demo uses `import_data`, not raw `HSET`.

**Resolved (updated after initial drafting — see acceptance criteria below for the
correction in full)**: relationships are declared explicitly with
`ContextRelationship(description=..., target=..., source_field=...)`, a class attribute
alongside `ContextField`s. FK-name matching alone (a field named `customer_id`) does
**not** create a relationship — confirmed by exporting a model with only naming
convention in place and getting zero relationships back, then confirmed correct by
matching the bundled `context_surfaces/examples/reddish_models.py` reference file.

**Also resolved, from the capability-tour follow-up**: `count_*` and `summarize_*`
tools are aggregation-only — they take `function` (+ `field` for `summarize_*`, +
optional `group_by`), not `tag_conditions`/`numeric_conditions` like `filter_*`. They
do not support filtering before aggregating in this API version; a customer wanting a
count over a filtered subset would need `filter_*` and count client-side, or ask
Context Retriever for that combination. `expand_results` returns `{entity, ids}`, not
full related-entity records — a real follow-up `get_*_by_id` call is needed to get
the record body, not a cosmetic detail to smooth over in a demo.

## Data model

Five entities, building on the `Customer` entity that already exists on the live
surface.

| Entity | Redis key template | Purpose |
|---|---|---|
| `Customer` | `customer:{id}` | Who the payment belongs to (extend existing) |
| `PaymentMethod` | `payment_method:{id}` | Card/bank instrument used |
| `Transaction` | `transaction:{id}` | The payment attempt itself |
| `PaymentFailureEvent` | `payment_failure:{id}` | Structured failure detail for a failed transaction |
| `SupportTicket` | `support_ticket:{id}` | Case opened as a result of the failure |

### Fields and indexing

| Entity.field | Type | Index | Notes |
|---|---|---|---|
| `Customer.id` | str | key component | already on the live surface |
| `Customer.email` | str | `text` | |
| `Customer.tier` | str | `tag`, allowed: `standard`, `premium`, `enterprise` | |
| `Customer.city` | str | `tag` | |
| `PaymentMethod.id` | str | key component | |
| `PaymentMethod.customer_id` | str | `tag` (FK → `Customer.id`) | |
| `PaymentMethod.type` | str | `tag`, allowed: `card`, `bank_transfer`, `wallet` | |
| `PaymentMethod.last4` | str | `text` | |
| `PaymentMethod.status` | str | `tag`, allowed: `active`, `expired`, `blocked` | |
| `Transaction.id` | str | key component | |
| `Transaction.customer_id` | str | `tag` (FK → `Customer.id`) | |
| `Transaction.payment_method_id` | str | `tag` (FK → `PaymentMethod.id`) | |
| `Transaction.amount` | float | `numeric` | |
| `Transaction.currency` | str | `tag` | |
| `Transaction.status` | str | `tag`, allowed: `succeeded`, `failed`, `pending` | |
| `Transaction.created_at` | int | `numeric` | epoch seconds |
| `PaymentFailureEvent.id` | str | key component | |
| `PaymentFailureEvent.transaction_id` | str | `tag` (FK → `Transaction.id`) | |
| `PaymentFailureEvent.customer_id` | str | `tag` (FK → `Customer.id`, denormalized) | |
| `PaymentFailureEvent.failure_code` | str | `tag`, allowed: `card_expired`, `insufficient_funds`, `gateway_timeout`, `fraud_block` | |
| `PaymentFailureEvent.failure_reason` | str | `text` | raw gateway message |
| `PaymentFailureEvent.gateway` | str | `tag`, allowed: `stripe`, `adyen` | |
| `PaymentFailureEvent.retry_count` | int | `numeric` | |
| `PaymentFailureEvent.occurred_at` | int | `numeric` | epoch seconds |
| `SupportTicket.id` | str | key component | |
| `SupportTicket.customer_id` | str | `tag` (FK → `Customer.id`) | |
| `SupportTicket.transaction_id` | str | `tag` (FK → `Transaction.id`) | |
| `SupportTicket.status` | str | `tag`, allowed: `open`, `pending`, `closed` | |
| `SupportTicket.priority` | str | `tag`, allowed: `low`, `medium`, `high` | |
| `SupportTicket.opened_at` | int | `numeric` | epoch seconds |

### Relationship graph

```
Customer ──1:N── PaymentMethod
Customer ──1:N── Transaction
Customer ──1:N── SupportTicket
PaymentMethod ──1:N── Transaction
Transaction ──1:1── PaymentFailureEvent   (present only when status = failed)
Transaction ──1:N── SupportTicket
```

## Access governance — tested, not confirmed working in this preview

Created a second agent key (`tier1-support-demo`) with
`access_tags={"tier": ["standard"]}`, matching the `Customer.tier` tag field by name,
and queried it live against the enterprise customer `1042`:

- `get_customer_by_id(id="1042")` — returned the enterprise customer's full record.
- `filter_customer(tag_conditions=[{"field": "tier", "value": "enterprise"}])` —
  returned both enterprise customers, unfiltered.

**Neither call was scoped by the agent key's access tags.** The docs describe access
tags as governing what an agent can see, but in this live test, on this preview build,
tag-name-matching alone did not enforce row-level filtering. Not chasing this further
in-session (would need to test whether it requires the OAuth Identity Provider /
`access_tag_claims` path, or a different binding this package doesn't expose) — this is
flagged as an open question for follow-up with the Context Retriever team, not
presented as a working feature. The deck's governance section describes the *documented
intent* and states plainly that live testing did not confirm enforcement in this build.

## End-to-end steps

1. **Admin key.** User runs `ctxctl auth login --username <redis-cloud-account>`
   (their own browser login) then `ctxctl admin create --name "amit-payment-demo-admin"
   --surface-id <id>`, and puts the result in `.env` as `CTX_ADMIN_KEY`.
2. **Extend the model.** [`update_model.py`](../../demos/context-retriever-payment-failure/update_model.py)
   reads the current surface's `data_model`, merges in the four new entities from
   [`models.py`](../../demos/context-retriever-payment-failure/models.py), and calls
   `update_context_surface`.
3. **Seed data.** [`seed_data.py`](../../demos/context-retriever-payment-failure/seed_data.py)
   builds ~10 customers, payment methods, transactions (mix of `succeeded`/`failed`),
   failure events, and tickets, and loads them with `UnifiedClient.import_data`.
4. **Verify tools.** `ctxctl tools list --agent-key <agent-key>` (or the same call this
   demo already made over raw HTTP) should now show entity + relationship tools for
   all five entities.
5. **Create scoped agent keys** for `fraud-ops` and `tier1-support` (step above).
6. **Run the resolution flow.** [`demo_agent_flow.py`](../../demos/context-retriever-payment-failure/demo_agent_flow.py)
   scripts the tool-call sequence for *"Customer 1042's payment just failed — what
   happened and what should we do?"*: find the customer → their transactions → the
   failed one → its `PaymentFailureEvent` → peer failures with the same
   `failure_code` (pattern detection) → existing open tickets (avoid duplicating).
7. **Governance check.** Repeat step 6 with the `tier1-support` key and confirm the
   redaction/scoping behavior.

## Acceptance criteria — all run live, none assumed

- [x] `models.py` imports cleanly; field/index table matches this spec.
- [x] `update_model.py` added the four entities to the live surface `df5e237c-7de7-4cc2-a573-494726a0baf8`.
      Tools before: 5 (bare `Customer`). Tools after: 28, covering all 5 entities
      (`get_*_by_id`, `filter_*`, `search_*_by_text`, `count_*`, `summarize_*`,
      `list_*`) plus 7 relationship hops surfaced through `expand_results`.
- [x] `seed_data.py` imported 22 records (5 Customer, 5 PaymentMethod, 6 Transaction,
      4 PaymentFailureEvent, 2 SupportTicket) with 0 failures. Confirmed independently
      via `redis-cli DBSIZE` (22) and `JSON.GET payment_failure:pf_3` — each entity is
      stored as a RedisJSON document at its `__redis_key_template__` key.
- [x] `demo_agent_flow.py` ran against the live MCP endpoint with the agent key and
      produced a real root-cause narrative (customer 1042, `card_expired`, recurring,
      no duplicate ticket) from real tool responses — see the walkthrough section below.
- [x] The relationship-declaration mechanism was the one open question in this spec,
      and it needed correcting: FK-name inference does **not** work.
      `ContextRelationship(description=..., target="Customer", source_field="customer_id")`
      must be declared explicitly per relationship (confirmed against the bundled
      `context_surfaces/examples/reddish_models.py`). `models.py` was fixed accordingly
      and verified via `export_data_model` before touching the live surface.
- [x] Access-tag governance was tested live and **did not enforce row-level filtering**
      in this preview build — see the governance section above. Documented as-tested,
      not claimed as working.
- [ ] Presentation deck — in progress, will use the real IDs, tool names, and
      request/response pairs captured in this run rather than illustrative examples.

## Live walkthrough (captured output)

Prompt: *"Customer 1042's payment just failed — what happened and what should we do?"*

1. `get_customer_by_id(id="1042")` → Sofia Moreno, Madrid, enterprise tier.
2. `filter_transaction(customer_id=1042)` → 2 transactions, both `status=failed`,
   both €249, both on `payment_method_id=pm_5`.
3. `filter_paymentfailureevent(customer_id=1042)` → both failures are
   `failure_code=card_expired`, gateway `stripe`, on a card (`pm_5`) whose own
   `status=expired`.
4. `filter_paymentfailureevent(failure_code=card_expired)` → exactly those same 2
   records surface — this customer's failures aren't part of a wider gateway incident.
5. `filter_supportticket(customer_id=1042)` → 0 open tickets.
6. **Answer**: expired card, recurring (not a one-off), not a gateway-wide issue, no
   duplicate ticket risk → correct action is prompt-for-new-card, not blind retry.

Every step above is a generated MCP tool call, not hand-written code — the entity
model produced all of it.

## Extension: Redis Agent Memory (short-term + long-term)

Context Retriever answers "what is true right now, in this business's
structured data" — it has no concept of a conversation or of a customer's
history. Redis Agent Memory is the complementary product for that: session
(short-term) memory for a single conversation, and long-term memory for
durable, cross-session facts about a customer. Source:
[Agent Memory docs](https://redis.io/docs/latest/develop/ai/context-engine/agent-memory/),
the `redis-agent-memory` PyPI package, and the `iris-development` skill's
reference files (read in full before implementing — see below for what each
call actually does, confirmed against the SDK, not assumed).

### Why it's relevant here, specifically

The scene 1 walkthrough above is stateless — every run re-derives the
diagnosis from scratch via Context Retriever. A real support agent needs two
more things Context Retriever doesn't provide:

1. **Continuity within one conversation** — if the customer asks a follow-up,
   or a human agent takes over, the conversation so far needs to be
   retrievable, in order, without replaying tool calls.
2. **Recall across conversations** — the second time customer 1042 has a
   card_expired failure (or calls about something unrelated), the agent
   should already know this is a recurring pattern, without re-querying and
   re-reasoning over Context Retriever from zero every time.

### Design

- **Session memory** (`add_session_event`): every turn of the scene-1
  conversation — the customer's opening message and each of the agent's
  intermediate findings — is appended as an ordered event under one
  `session_id`. Cheap writes, no LLM cost on the write path.
- **Long-term memory** (`bulk_create_long_term_memories`): written directly,
  **not** via the background LLM-extraction/promotion path. Context Retriever
  already gave us a structured, ground-truth fact (recurring `card_expired`
  on `pm_5`, via `stripe`) — there's nothing for an LLM to extract that we
  don't already know exactly. One `SEMANTIC` fact (the recurring pattern) and
  one `EPISODIC` fact (this specific resolution, dated) are written, both
  scoped with `owner_id=customer-1042` and `namespace=payment-issues`.
- **Recall** (`search_long_term_memory`): a later, brand-new session queries
  long-term memory filtered by `owner_id` before ever touching Context
  Retriever again — demonstrating that the durable facts survive independent
  of the original session's TTL.

### Implementation

- [`agent_memory_helpers.py`](../../agent_memory_helpers.py) — thin wrappers:
  `record_turn`, `remember_recurring_failure`, `remember_resolution`,
  `recall_customer_history`.
- [`demo_agent_flow_with_memory.py`](../../demo_agent_flow_with_memory.py) —
  four scenes: (1) the original resolution flow, narrated turn-by-turn into
  session memory; (2) writing the durable facts directly to long-term memory;
  (3) rebuilding scene 1's transcript from session memory (`get_session_memory`)
  to prove continuity; (4) a simulated later session recalling customer
  1042's history before querying anything else.

### Run live — everything below is verified, not assumed

Ran against a real Redis Cloud Agent Memory service (separate from the
Context Retriever service above — its own `storeId` and store API key,
provisioned via the Cloud console). The installed SDK is
`redis-agent-memory==0.4.1`; several things differed from the `iris-development`
skill's reference docs, corrected here rather than papered over:

- **`models.MemoryType` does not exist in this SDK version.** `memory_type` is
  a plain `Optional[str]` field — pass `"semantic"` / `"episodic"` directly,
  not an enum member. (`models.MessageRole` and `models.FilterConjunction` *are*
  real enums, confirmed by inspecting `__members__`.)
- **Memory IDs are alphanumeric + hyphens only** — `_` fails with a 400
  (`ID: must contain only alphanumeric characters (A-Z, a-z, 0-9) and hyphens (-)`).
  A field like `card_expired` used verbatim in an ID breaks; `topics` values
  don't have this restriction. `agent_memory_helpers.py`'s `_slug()` handles this.
- **`search_long_term_memory_async` takes a single wrapped `request=` argument**
  in this SDK version, not the flat keyword arguments (`text=`, `filter_=`, etc.)
  shown in the skill doc's example — confirmed via `inspect.signature`. The
  field names *inside* that request dict do match the doc.
- **The search response field is `items`, not `memories`.** `SearchLongTermMemoryResponseContent`
  has `items` and `next_page_token`; `res.memories` raises `AttributeError`.
- **`similarity_threshold=0.7` (the doc's suggested starting point) returned
  zero results** for a natural query ("payment card problems") against this
  store's actual embeddings; `0.5` reliably returned the expected records.
  Confirmed by sweeping `0.7 → 0.5 → 0.3 → 0.0` — 0.7 was the only threshold
  that returned nothing. This isn't a bug, it's exactly the doc's own caveat
  ("start at 0.7 and tune per workload") — but it means **do not demo with the
  doc's suggested threshold untested against your own store's data.**
- **A 5-turn session produced 42 auto-promoted long-term memories** — filtering
  by `owner_id` alone (no text) surfaced them all. Promotion atomizes very
  aggressively (e.g. "Customer 1042 is located in Madrid." and "Customer 1042
  is named Sofia Moreno." as separate records, sometimes duplicated near-verbatim
  across promotion windows). Worth disclosing to a customer sizing this for
  production: promotion volume from ordinary conversation is not negligible,
  and namespace/topic discipline (see `ltm-organize`) is not optional at scale.
  The two facts written *directly* via `bulk_create_long_term_memories`
  (bypassing promotion) landed as exactly 2 records, both fully under our IDs
  and organization fields — as designed.
- **Direct `bulk_create_long_term_memories` writes are retrievable by ID and by
  structured filter immediately**, but were **not yet reachable via the
  vector-similarity path** in the same window purely due to the threshold
  issue above, not an indexing delay — confirmed by the filter-only browse
  returning them right away while a high-threshold semantic search returned
  nothing for the same records.

See the live output captured by [`demo_agent_flow_with_memory.py`](../../demo_agent_flow_with_memory.py)
for the full run: session turns recorded and rebuilt via `get_session_memory`,
two durable facts written directly, and a simulated later session recalling
them via `search_long_term_memory` at `similarity_threshold=0.5`.
