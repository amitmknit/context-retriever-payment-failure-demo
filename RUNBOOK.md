# Customer Demo Runbook: Redis Context Retriever + Agent Memory — Payment Failure Resolution

Two ways to run this. **Default to the web UI** — it's the customer-facing
surface and covers the whole story without a terminal. The CLI scripts remain
for a developer audience that wants to see the raw calls, and for pre-flight.

Everything either surface shows is live against a real Redis Cloud database,
a real Context Retriever service, and a real Agent Memory service — say so
explicitly; it's the differentiator from a slide-only pitch. The deck
([`Context-Retriever-Payment-Failure-Demo.pptx`](Context-Retriever-Payment-Failure-Demo.pptx))
still carries the framing if you want slides up front.

## 0. Web UI (the customer-facing path)

```bash
cd ~/Claude-Code/demo/context-retriever-payment-failure
.venv/bin/python3 -m uvicorn webapp.server:app --port 8800
```

Open <http://127.0.0.1:8800> and present the six sections left to right. Best
at 1400px+ — the resolution view goes two-column (tool calls left, live
session-memory transcript right). Both light and dark themes work; pick
whichever reads better on the room's projector.

| Section | What to do live | The line to land |
|---|---|---|
| **Overview** | Point at the health pills and the tiles — all read live. Scroll to the keyspace table. | "Both products, one Redis. Your entities at the key templates you declared, the memory store in the same database." |
| **Entity model** | Click a row → the inspector opens with fields, index types, relationships, and the actual RedisJSON document. | "This model is the only thing we hand-authored. Everything in the next tab was generated from it." |
| **Resolution** | Press **Run resolution**. Let the five steps land one at a time; watch the transcript build on the right. | "Every one of those was a tool call the agent chose and chained. None of that branching is hand-written." |
| **Capabilities** | Run **Cross-entity join** first, then whichever else they ask about. | "One call traverses a declared relationship — a join, with no SQL and no schema knowledge in the agent." |
| **Memory** | Recall at 0.5, then drag the threshold to 0.7 and press Recall again. Then **Browse memory store**. | "Same query, same data, nothing returned — that's threshold calibration, and it's why we test rather than trust the default." |
| **Governance** | Read the two red/amber banners rather than glossing past them. | "We test every claim ourselves before we put it in front of you. This one didn't hold up yet." |

If a panel errors mid-demo, it renders the real error in a red banner rather
than failing silently — read it out and move on; the other sections are
independent.

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

And if you're presenting through the UI, load it once and confirm all three
health pills are green before the customer joins:

```bash
curl -s localhost:8800/api/health | python3 -m json.tool
```

## 2. Suggested talk track (terminal path)

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

### F. Add memory — same conversation, now with continuity and recall

```bash
.venv/bin/python3 demo_agent_flow_with_memory.py
```

This re-runs the scene-1 resolution, but narrates it: every turn (the
customer's opening message, each of the agent's intermediate findings, the
final answer) is written to **session memory** as it happens. Then it:

1. **Rebuilds the transcript** from session memory alone — say: "if this
   chat drops, or a human agent picks it up, nothing is lost — the whole
   conversation is retrievable in order."
2. **Writes durable facts to long-term memory directly** — the recurring
   `card_expired` pattern and this specific resolution — skipping the
   background LLM-extraction path entirely, because Context Retriever
   already told us this fact structurally. Say: "we're not paying for an LLM
   to re-discover what we already know."
3. **Simulates the customer calling back later**, in a brand-new session,
   and shows the agent recalling their history *before* querying Context
   Retriever again. This is the moment to land: "next time this customer
   calls — about this or anything else — the agent already knows this
   history. Context Retriever gave us the fact once; Agent Memory makes it
   durable."

Two things worth mentioning live, both live findings, not slideware claims:
- **Session memory also auto-promotes to long-term memory in the background** —
  our one 5-turn conversation generated 42 auto-extracted memories on its own,
  on top of the 2 we wrote directly. Say: "promotion is real, and it's
  aggressive — worth planning namespace/topic discipline before this hits
  production volume, not after."
- **The similarity threshold in the docs (0.7) returned zero results** against
  this store's real embeddings for a plain-language query; `0.5` worked. If a
  customer asks why recall seems to miss things, that's the first knob to check
  — not a sign the feature is broken.

Frame the two products together plainly: **Context Retriever answers "what's
true right now, in your structured data." Agent Memory answers "what have we
already learned about this specific conversation, and this specific
customer, over time."** Neither one does the other's job.

### G. Governance — show the design, disclose the finding

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
