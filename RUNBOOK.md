# Customer Demo Runbook: Redis Context Retriever — Payment Failure Resolution

Presented as a mix of terminal (agent tool calls, narrated) and the deck
([`Context-Retriever-Payment-Failure-Demo.pptx`](Context-Retriever-Payment-Failure-Demo.pptx))
for the framing/architecture slides. Everything the terminal shows is live
against a real Redis Cloud database and a real Context Retriever service —
say so explicitly; it's the differentiator from a slide-only pitch.

## 1. Pre-flight (do this before the customer joins)

```bash
cd ~/Claude-Code/demo/context-retriever-payment-failure
```

Confirm the environment still works — Redis reachable, data present, service responsive:

```bash
set -a && source .env && set +a
redis-cli -h "${REDIS_ADDR%%:*}" -p "${REDIS_ADDR##*:}" -a "$REDIS_PASSWORD" --no-auth-warning DBSIZE
```

Expect `22`. If it's `0` or errors, re-seed before the call:

```bash
.venv/bin/python3 update_model.py   # idempotent — re-applies the same 5-entity model
.venv/bin/python3 seed_data.py      # idempotent — on_conflict=overwrite
```

Do a silent dry-run of the centerpiece flow so you're not debugging live:

```bash
.venv/bin/python3 demo_agent_flow.py
```

## 2. Suggested talk track

### A. Frame the problem (deck, slides 2–3)

Open on the "tool zoo" problem: agents fail because the context layer breaks,
not because the model is wrong. Contrast with Context Retriever's pitch —
model once, get a governed MCP surface for free.

### B. Show the entity model (deck, slides 4–6)

Walk the 5-entity diagram (Customer → PaymentMethod → Transaction →
PaymentFailureEvent, plus SupportTicket) and the `ContextModel` /
`ContextRelationship` code slide. Make the callout explicit: **relationships
are not inferred from field names** — you tested this yourself and it's a
real, easy-to-miss gotcha worth customers knowing up front.

### C. Prove it's live — not a mock

```bash
redis-cli -h "${REDIS_ADDR%%:*}" -p "${REDIS_ADDR##*:}" -a "$REDIS_PASSWORD" --no-auth-warning JSON.GET payment_failure:pf_3
```

Point out: this is a plain RedisJSON document, at the exact key template
declared in `models.py`. No hidden ingestion pipeline — what you modeled is
what's in Redis.

### D. Capability tour — run each tool class live

```bash
.venv/bin/python3 capability_tour.py lookup      # point lookup by key
.venv/bin/python3 capability_tour.py filter       # structured filter (tag + numeric)
.venv/bin/python3 capability_tour.py search       # free-text search (found the card by last4 "0007")
.venv/bin/python3 capability_tour.py count        # aggregate count, grouped by status
.venv/bin/python3 capability_tour.py summarize    # aggregate avg(amount), grouped by currency
.venv/bin/python3 capability_tour.py expand       # cross-entity join in one call, zero SQL
```

Narrate each as you go:
- **lookup** — "this is the direct key-value path, as fast as Redis always was"
- **filter** — "this is the equivalent of a WHERE clause, generated, not hand-coded"
- **search** — "free text over the fields you declared `index=\"text\"` on — found the card by its last 4 digits"
- **count / summarize** — "aggregation, grouped, no separate reporting pipeline"
- **expand** — "this is the one to slow down on: one tool call that starts at PaymentFailureEvent and returns the related Customer — a join, without SQL, without the agent knowing your schema's foreign keys." Note honestly: `expand_results` returns entity + IDs, not full customer records — call the corresponding `get_*_by_id` as a natural follow-up if a customer asks why the payload looks thin.

### E. The centerpiece — resolve a real payment failure end to end

```bash
.venv/bin/python3 demo_agent_flow.py
```

Narrate the prompt first, then let each step print: identify the customer,
find their transactions, isolate the failure, pattern-check against other
customers, check for a duplicate ticket, then land the answer. Emphasize:
every one of those is a tool call the agent chose and chained itself — none
of that branching logic is hand-written.

### F. Governance — show the design, disclose the finding

Show the two-key-type model (admin provisions, agent invokes) and the
`access_tags` concept from the deck. **Do not demonstrate this live as if it
works** — in your own testing, access-tag enforcement did not filter results
on this preview build (see
[`docs/specs/payment-failure-context-retriever-demo.md`](docs/specs/payment-failure-context-retriever-demo.md)).
Say that plainly if it comes up: "we test every claim ourselves before we put
it in front of a customer — this one didn't hold up yet, and we're following
up with the Context Retriever team before recommending it as a compliance
boundary for you." That's a credibility builder, not a weakness to hide.

## 3. Close

Recap slide (deck, slide 18): one model replaced 5+ hand-built tools; governed
MCP surface over live data; but verify access-control claims per-deployment,
don't assume from docs. Point to next steps (deck, slide 19) if there's
appetite for a follow-on POC with the customer's own schema.

## 4. Teardown

Nothing to tear down — this is a read/serve demo against a persistent Redis
Cloud database. Leave the data in place for next time; `seed_data.py` is safe
to re-run if you ever need a clean reset (`on_conflict="overwrite"`).
