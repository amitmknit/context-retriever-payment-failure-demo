"""Customer-facing web UI for the Context Retriever + Agent Memory demo.

Everything the browser sees comes from a live service call -- Context
Retriever's generated MCP tools, Redis itself, or Agent Memory. No fixtures,
no canned responses. Credentials stay in this process; the browser never
receives a key.

Run:
    .venv/bin/python3 -m uvicorn webapp.server:app --port 8800
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import redis.asyncio as aioredis
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from context_surfaces import ContextSurfacesClient, UnifiedClient
from redis_agent_memory import models as mem_models

from agent_memory_helpers import (
    make_client as make_memory_client,
    recall_customer_history,
    record_turn,
    remember_recurring_failure,
    remember_resolution,
)

load_dotenv()

STATIC_DIR = Path(__file__).parent / "static"
CUSTOMER_ID = "1042"

app = FastAPI(title="Redis Context Retriever + Agent Memory demo")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ---------------------------------------------------------------- helpers


def _env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"{name} is not set in .env")
    return value


def _unwrap(mcp_result: Any) -> Any:
    """Generated tools return an MCP envelope: {"content":[{"text": "<json>"}]}.
    Unwrap it to real JSON for the UI, leaving non-conforming shapes alone."""
    try:
        text = mcp_result["content"][0]["text"]
    except (TypeError, KeyError, IndexError):
        return mcp_result
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def _redis_client() -> aioredis.Redis:
    addr = _env("REDIS_ADDR")
    host, _, port = addr.partition(":")
    use_tls = os.getenv("REDIS_TLS", "false").strip().lower() == "true"
    return aioredis.Redis(
        host=host,
        port=int(port or 6379),
        username=os.getenv("REDIS_USERNAME") or "default",
        password=os.getenv("REDIS_PASSWORD") or None,
        ssl=use_tls,
        decode_responses=True,
    )


async def _call_tool(name: str, arguments: dict) -> dict:
    started = time.perf_counter()
    async with UnifiedClient() as client:
        raw = await client.query_tool(_env("CTX_AGENT_KEY"), name, arguments)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return {
        "tool": name,
        "arguments": arguments,
        "result": _unwrap(raw),
        "elapsed_ms": elapsed_ms,
    }


# The resolution flow, defined once so the UI and the CLI tell the same story.
RESOLUTION_STEPS: list[dict[str, Any]] = [
    {
        "title": "Identify the customer",
        "question": "Who is this?",
        "tool": "get_customer_by_id",
        "arguments": {"id": CUSTOMER_ID},
        "takeaway": "Point lookup by key -- the generated tool for the entity's primary key.",
    },
    {
        "title": "Pull their transactions",
        "question": "What did they try to pay?",
        "tool": "filter_transaction",
        "arguments": {"tag_conditions": [{"field": "customer_id", "value": CUSTOMER_ID}], "limit": 10},
        "takeaway": "Two attempts, both failed, same amount, same payment method.",
    },
    {
        "title": "Get the failure detail",
        "question": "Why did it fail?",
        "tool": "filter_paymentfailureevent",
        "arguments": {"tag_conditions": [{"field": "customer_id", "value": CUSTOMER_ID}], "limit": 10},
        "takeaway": "Both failures are card_expired on stripe -- the instrument itself is expired.",
    },
    {
        "title": "Rule out a systemic incident",
        "question": "Is this everyone, or just them?",
        "tool": "filter_paymentfailureevent",
        "arguments": {"tag_conditions": [{"field": "failure_code", "value": "card_expired"}], "limit": 10},
        "takeaway": "Same two records only -- isolated to this customer, not a gateway-wide outage.",
    },
    {
        "title": "Check for a duplicate ticket",
        "question": "Has someone already raised this?",
        "tool": "filter_supportticket",
        "arguments": {"tag_conditions": [{"field": "customer_id", "value": CUSTOMER_ID}], "limit": 10},
        "takeaway": "No open ticket -- safe to act without creating a duplicate.",
    },
]

FINAL_ANSWER = (
    "Expired card, recurring across two attempts, isolated to this customer, "
    "and no ticket open yet. Correct action: prompt for an updated card -- not a blind retry."
)

CAPABILITIES: list[dict[str, Any]] = [
    {
        "key": "lookup",
        "label": "Point lookup",
        "tool": "get_customer_by_id",
        "arguments": {"id": "1001"},
        "blurb": "Direct key fetch -- the fast path Redis has always been good at.",
    },
    {
        "key": "filter",
        "label": "Structured filter",
        "tool": "filter_transaction",
        "arguments": {"numeric_conditions": [{"field": "amount", "min_value": 200, "max_value": 300}], "limit": 10},
        "blurb": "Numeric range filtering -- the equivalent of a WHERE clause, generated not hand-coded.",
    },
    {
        "key": "search",
        "label": "Free-text search",
        "tool": "search_paymentmethod_by_text",
        "arguments": {"query": "0007"},
        "blurb": "Text search over fields declared index=\"text\" -- finds the card by its last four digits.",
    },
    {
        "key": "count",
        "label": "Aggregate count",
        "tool": "count_transaction",
        "arguments": {"function": "count", "group_by": "status"},
        "blurb": "Grouped counts, no separate reporting pipeline.",
    },
    {
        "key": "summarize",
        "label": "Aggregate summary",
        "tool": "summarize_transaction",
        "arguments": {"function": "avg", "field": "amount", "group_by": "currency"},
        "blurb": "Numeric aggregation (avg/sum/min/max), grouped by a tag field.",
    },
    {
        "key": "expand",
        "label": "Cross-entity join",
        "tool": "expand_results",
        "arguments": {
            "set": {
                "entity": "PaymentFailureEvent",
                "tag_conditions": [{"field": "failure_code", "value": "card_expired"}],
            },
            "relationship": "customer",
            "limit": 10,
        },
        "blurb": "One call traverses a declared relationship -- a join, with no SQL and no schema knowledge in the agent.",
    },
]


# ---------------------------------------------------------------- routes


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
async def health() -> dict:
    out: dict[str, Any] = {}

    # Redis
    try:
        client = _redis_client()
        dbsize = await client.dbsize()
        await client.aclose()
        out["redis"] = {"ok": True, "detail": f"{dbsize} keys", "endpoint": _env("REDIS_ADDR")}
    except Exception as exc:  # surfaced to the UI, not swallowed
        out["redis"] = {"ok": False, "detail": str(exc)[:160]}

    # Context Retriever
    try:
        async with UnifiedClient() as client:
            tools = await client.list_tools(_env("CTX_AGENT_KEY"))
        out["context_retriever"] = {
            "ok": True,
            "detail": f"{len(tools)} generated tools",
            "endpoint": os.getenv("CTX_MCP_ENDPOINT", ""),
            "tools": sorted(t["name"] for t in tools),
        }
    except Exception as exc:
        out["context_retriever"] = {"ok": False, "detail": str(exc)[:160]}

    # Agent Memory
    try:
        async with make_memory_client() as mem:
            status = await mem.health_async()
        out["agent_memory"] = {
            "ok": True,
            "detail": str(getattr(status, "status", status)),
            "endpoint": os.getenv("AGENT_MEMORY_BASE_URL", ""),
        }
    except Exception as exc:
        out["agent_memory"] = {"ok": False, "detail": str(exc)[:160]}

    return out


@app.get("/api/model")
async def model() -> dict:
    """The entity model as it exists on the live surface, plus the tool surface
    it generated. Nothing here is hard-coded from models.py."""
    async with ContextSurfacesClient() as client:
        surface = await client.get_context_surface(
            _env("CTX_SURFACE_ID"), admin_key=_env("CTX_ADMIN_KEY")
        )

    data_model = surface.data_model or {}
    entities = []
    for entity in data_model.get("entities", []):
        entities.append(
            {
                "name": entity.get("name"),
                "key_template": entity.get("redis_key_template"),
                "fields": [
                    {
                        "name": f.get("name"),
                        "type": f.get("type"),
                        "is_key": bool(f.get("is_key_component")),
                        "indexes": [i.get("type") for i in (f.get("redis_indices") or [])],
                        "allowed_values": f.get("allowed_values") or [],
                        "description": f.get("description") or "",
                    }
                    for f in entity.get("fields", [])
                ],
                "relationships": entity.get("relationships", []),
            }
        )

    tools = sorted(surface.tools or [])
    grouped: dict[str, list[str]] = {}
    for tool in tools:
        prefix = tool.split("_", 1)[0]
        grouped.setdefault(prefix, []).append(tool)

    return {
        "surface_name": surface.name,
        "title": data_model.get("title"),
        "entities": entities,
        "entity_count": len(entities),
        "relationship_count": sum(len(e["relationships"]) for e in entities),
        "tools": tools,
        "tool_count": len(tools),
        "tools_grouped": grouped,
    }


@app.get("/api/redis/doc")
async def redis_doc(key: str) -> dict:
    """Show the raw RedisJSON document behind an entity -- the 'this is really
    just Redis' moment."""
    client = _redis_client()
    try:
        key_type = await client.type(key)
        if key_type == "ReJSON-RL":
            raw = await client.execute_command("JSON.GET", key)
            value = json.loads(raw) if raw else None
        elif key_type == "hash":
            value = await client.hgetall(key)
        elif key_type == "none":
            raise HTTPException(status_code=404, detail=f"key {key!r} not found")
        else:
            value = await client.execute_command("DUMP", key) and "<binary>"
        return {"key": key, "type": key_type, "value": value}
    finally:
        await client.aclose()


@app.get("/api/redis/keyspace")
async def redis_keyspace() -> dict:
    """Group the keyspace by prefix. Both products are backed by the same Redis
    database -- business entities under their declared key templates, and the
    Agent Memory store under memory:<storeId>:*. Worth showing rather than
    asserting."""
    client = _redis_client()
    try:
        groups: dict[str, int] = {}
        async for key in client.scan_iter(count=500):
            if key.startswith("memory:"):
                parts = key.split(":")
                label = f"memory:…:{parts[2]}" if len(parts) >= 3 else "memory:…"
            else:
                label = key.rsplit(":", 1)[0] if ":" in key else key
            groups[label] = groups.get(label, 0) + 1
        ordered = sorted(groups.items(), key=lambda kv: (-kv[1], kv[0]))
        return {
            "total": sum(groups.values()),
            "groups": [
                {
                    "prefix": prefix,
                    "count": count,
                    "owner": "Agent Memory" if prefix.startswith("memory:") else "Context Retriever entity",
                }
                for prefix, count in ordered
            ],
        }
    finally:
        await client.aclose()


@app.get("/api/resolution")
async def resolution() -> dict:
    """Step metadata only -- the UI runs steps one at a time so the presenter
    controls the pace."""
    return {
        "prompt": f"Customer {CUSTOMER_ID}'s payment just failed -- what happened and what should we do?",
        "customer_id": CUSTOMER_ID,
        "steps": [
            {"index": i, "title": s["title"], "question": s["question"], "tool": s["tool"], "takeaway": s["takeaway"]}
            for i, s in enumerate(RESOLUTION_STEPS)
        ],
        "final_answer": FINAL_ANSWER,
    }


class StepRequest(BaseModel):
    index: int
    session_id: str | None = None


@app.post("/api/resolution/step")
async def resolution_step(req: StepRequest) -> dict:
    if not 0 <= req.index < len(RESOLUTION_STEPS):
        raise HTTPException(status_code=400, detail="step index out of range")
    step = RESOLUTION_STEPS[req.index]

    call = await _call_tool(step["tool"], step["arguments"])

    # Mirror the step into session (short-term) memory, exactly as the CLI does.
    memory_written = None
    if req.session_id:
        try:
            async with make_memory_client() as mem:
                if req.index == 0:
                    await record_turn(
                        mem,
                        session_id=req.session_id,
                        actor_id=f"customer-{CUSTOMER_ID}",
                        role=mem_models.MessageRole.USER,
                        text=f"Customer {CUSTOMER_ID}'s payment just failed -- what happened and what should we do?",
                    )
                await record_turn(
                    mem,
                    session_id=req.session_id,
                    actor_id="payment-ops-agent",
                    role=mem_models.MessageRole.ASSISTANT,
                    text=f"{step['title']}: {step['takeaway']}",
                )
            memory_written = True
        except Exception as exc:
            memory_written = f"failed: {str(exc)[:120]}"

    return {
        **call,
        "index": req.index,
        "title": step["title"],
        "question": step["question"],
        "takeaway": step["takeaway"],
        "session_memory_written": memory_written,
    }


class FinishRequest(BaseModel):
    session_id: str


@app.post("/api/resolution/finish")
async def resolution_finish(req: FinishRequest) -> dict:
    """Record the final answer as a session turn, then write the durable facts
    to long-term memory."""
    written: dict[str, Any] = {}
    async with make_memory_client() as mem:
        await record_turn(
            mem,
            session_id=req.session_id,
            actor_id="payment-ops-agent",
            role=mem_models.MessageRole.ASSISTANT,
            text=FINAL_ANSWER,
        )
        semantic = await remember_recurring_failure(
            mem,
            customer_id=CUSTOMER_ID,
            failure_code="card_expired",
            gateway="stripe",
            payment_method_id="pm_5",
            transaction_ids=["tx_5", "tx_6"],
        )
        episodic = await remember_resolution(
            mem,
            customer_id=CUSTOMER_ID,
            transaction_ids=["tx_5", "tx_6"],
            resolution_summary="Recommended a card update; no support ticket needed.",
        )
    written["semantic"] = list(semantic.created or [])
    written["episodic"] = list(episodic.created or [])
    return {"final_answer": FINAL_ANSWER, "long_term_written": written}


@app.get("/api/capabilities")
async def capabilities() -> dict:
    return {
        "capabilities": [
            {"key": c["key"], "label": c["label"], "tool": c["tool"], "blurb": c["blurb"], "arguments": c["arguments"]}
            for c in CAPABILITIES
        ]
    }


@app.post("/api/capabilities/{key}")
async def run_capability(key: str) -> dict:
    match = next((c for c in CAPABILITIES if c["key"] == key), None)
    if match is None:
        raise HTTPException(status_code=404, detail=f"unknown capability {key!r}")
    call = await _call_tool(match["tool"], match["arguments"])
    return {**call, "key": key, "label": match["label"], "blurb": match["blurb"]}


@app.get("/api/memory/session/{session_id}")
async def session_memory(session_id: str) -> dict:
    async with make_memory_client() as mem:
        res = await mem.get_session_memory_async(session_id=session_id)
    events = []
    for ev in res.events or []:
        text = ev.content[0].text if ev.content else ""
        events.append(
            {
                "role": str(getattr(ev.role, "value", ev.role)),
                "actor_id": ev.actor_id,
                "text": text,
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            }
        )
    return {"session_id": session_id, "owner_id": getattr(res, "owner_id", None), "events": events}


class RecallRequest(BaseModel):
    query: str = "payment card problems"
    similarity_threshold: float = 0.5
    limit: int = 5


@app.post("/api/memory/recall")
async def memory_recall(req: RecallRequest) -> dict:
    """Semantic recall. The threshold is exposed deliberately: 0.7 (the value
    the docs suggest as a starting point) returns nothing against this store's
    real embeddings, and that is worth showing rather than hiding."""
    async with make_memory_client() as mem:
        items = await recall_customer_history(
            mem,
            customer_id=CUSTOMER_ID,
            query=req.query,
            k=req.limit,
            similarity_threshold=req.similarity_threshold,
        )
    return {
        "query": req.query,
        "similarity_threshold": req.similarity_threshold,
        "count": len(items),
        "memories": [
            {
                "id": m.id,
                "text": m.text,
                "memory_type": m.memory_type,
                "namespace": m.namespace,
                "topics": list(m.topics or []),
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in items
        ],
    }


# Types registered on this store. `session_summary_view` is deliberately listed:
# a search filtered only by owner_id silently OMITS it, so a browse without this
# explicit list under-reports what the store actually holds (verified: 53 vs 63).
STORE_MEMORY_TYPES = ["semantic", "episodic", "message", "session_summary_view"]


@app.get("/api/memory/browse")
async def memory_browse(limit: int = 100) -> dict:
    """Structured-filter browse (no vector ranking) for everything stored about
    this customer -- this is where the volume of background-promoted memories
    becomes visible."""
    async with make_memory_client() as mem:
        res = await mem.search_long_term_memory_async(
            request={
                "filter_": {
                    "owner_id": {"eq": f"customer-{CUSTOMER_ID}"},
                    "memory_type": {"in_": STORE_MEMORY_TYPES},
                },
                "limit": limit,
            }
        )
    items = res.items or []

    def origin(m) -> str:
        if m.id.startswith("cust-"):
            return "direct"
        if m.memory_type == "session_summary_view":
            return "session summary"
        return "promoted"

    by_type: dict[str, int] = {}
    by_origin: dict[str, int] = {}
    for m in items:
        by_type[m.memory_type or "unknown"] = by_type.get(m.memory_type or "unknown", 0) + 1
        by_origin[origin(m)] = by_origin.get(origin(m), 0) + 1

    return {
        "total": len(items),
        "direct_written_count": by_origin.get("direct", 0),
        "auto_promoted_count": by_origin.get("promoted", 0),
        "session_summary_count": by_origin.get("session summary", 0),
        "by_type": by_type,
        "memories": [
            {
                "id": m.id,
                "text": m.text,
                "memory_type": m.memory_type,
                "origin": origin(m),
                "topics": list(m.topics or []),
                "session_id": m.session_id,
            }
            for m in items
        ],
    }


@app.get("/api/memory/sessions")
async def memory_sessions(limit: int = 20) -> dict:
    """Short-term memory: the sessions themselves, with the TTL read straight
    from Redis. TTL is the clearest way to see that session memory is
    ephemeral (~24h, refreshed per event) while long-term memory is not
    (~365d)."""
    async with make_memory_client() as mem:
        # list_sessions REQUIRES a filter -- a bare call 400s with
        # "a filter (filterOwnerId or namespaceRef) or includeAll=true is
        # required". And the response field is `items`, not `sessions`.
        page = await mem.list_sessions_async(
            limit=limit, filter_owner_id=f"customer-{CUSTOMER_ID}"
        )
    session_ids = list(page.items or [])

    store_id = _env("AGENT_MEMORY_STORE_ID")
    client = _redis_client()
    rows = []
    try:
        for sid in session_ids:
            key = f"memory:{store_id}:session_memory:{sid}"
            ttl = await client.ttl(key)
            key_type = await client.type(key)
            rows.append(
                {
                    "session_id": sid,
                    "redis_key": key,
                    "redis_type": key_type if key_type != "none" else None,
                    "ttl_seconds": ttl if ttl and ttl > 0 else None,
                }
            )
    finally:
        await client.aclose()

    return {"total": getattr(page, "total", len(rows)), "sessions": rows}


@app.get("/api/memory/tiers")
async def memory_tiers() -> dict:
    """Side-by-side of how the two tiers actually look in Redis. Read live:
    key pattern, Redis data type, and TTL for one real key of each."""
    store_id = _env("AGENT_MEMORY_STORE_ID")
    client = _redis_client()
    out: dict[str, Any] = {"store_id_masked": f"{store_id[:6]}…{store_id[-4:]}"}
    try:
        for tier, pattern in (
            ("short_term", f"memory:{store_id}:session_memory:*"),
            ("long_term", f"memory:{store_id}:ltm:*"),
        ):
            sample = None
            count = 0
            async for key in client.scan_iter(match=pattern, count=500):
                count += 1
                if sample is None:
                    sample = key
            entry: dict[str, Any] = {"key_pattern": pattern.replace(store_id, "<storeId>"), "key_count": count}
            if sample:
                ttl = await client.ttl(sample)
                entry["sample_key"] = sample.replace(store_id, "<storeId>")
                entry["redis_type"] = await client.type(sample)
                entry["ttl_seconds"] = ttl if ttl and ttl > 0 else None
                entry["ttl_human"] = (
                    f"~{round(ttl / 3600)} hours" if ttl and ttl < 172800 else f"~{round(ttl / 86400)} days" if ttl and ttl > 0 else "no expiry"
                )
            out[tier] = entry
        return out
    finally:
        await client.aclose()
