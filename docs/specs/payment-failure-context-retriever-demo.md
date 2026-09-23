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
