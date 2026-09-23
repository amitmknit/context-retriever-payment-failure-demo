"""Thin helpers over the redis-agent-memory SDK, scoped to this demo's needs:
recording a support conversation as session (short-term) memory, and writing/
recalling durable facts about a customer as long-term memory.

Session memory here is per-conversation: raw, ordered turns, cheap to write,
session-TTL-scoped. Long-term memory is per-customer: durable, semantically
searchable facts that should survive across conversations -- written directly
here (not via LLM extraction/promotion) because Context Retriever already
gave us a structured, ground-truth fact; there's nothing to extract.
"""

import os
from datetime import datetime, timezone

from redis_agent_memory import AgentMemory, models


def _slug(*parts: str) -> str:
    """IDs must be alphanumeric + hyphens only -- collapse any other
    separator (e.g. failure codes like `card_expired`) to '-'."""
    raw = "-".join(parts)
    return "".join(c if c.isalnum() or c == "-" else "-" for c in raw)


def make_client() -> AgentMemory:
    return AgentMemory(
        os.environ["AGENT_MEMORY_BASE_URL"],
        store_id=os.environ["AGENT_MEMORY_STORE_ID"],
        api_key=os.environ["AGENT_MEMORY_API_KEY"],
    )


async def record_turn(agent_memory: AgentMemory, *, session_id: str, actor_id: str, role, text: str, metadata: dict | None = None):
    """Append one turn of the support conversation to session (short-term) memory."""
    res = await agent_memory.add_session_event_async(
        session_id=session_id,
        actor_id=actor_id,
        role=role,
        content=[{"text": text}],
        created_at=datetime.now(timezone.utc),
        metadata=metadata,
    )
    return res.event


async def remember_recurring_failure(
    agent_memory: AgentMemory,
    *,
    customer_id: str,
    failure_code: str,
    gateway: str,
    payment_method_id: str,
    transaction_ids: list[str],
):
    """Write a durable SEMANTIC fact about this customer directly -- Context
    Retriever already told us this structurally, so there's no LLM extraction
    to pay for. Deterministic id keeps retries idempotent."""
    fact_id = _slug("cust", customer_id, failure_code, payment_method_id)
    text = (
        f"Customer {customer_id} has a recurring {failure_code} failure on "
        f"payment method {payment_method_id} via {gateway} "
        f"(transactions: {', '.join(transaction_ids)})."
    )
    return await agent_memory.bulk_create_long_term_memories_async(
        memories=[
            {
                "id": fact_id,
                "text": text,
                "memory_type": "semantic",
                "owner_id": f"customer-{customer_id}",
                "namespace": "payment-issues",
                "topics": [failure_code, "recurring", "payment-method"],
            }
        ]
    )


async def remember_resolution(
    agent_memory: AgentMemory,
    *,
    customer_id: str,
    transaction_ids: list[str],
    resolution_summary: str,
):
    """Write a durable EPISODIC fact -- what happened, at this point in time,
    and what the agent decided to do about it."""
    ts = datetime.now(timezone.utc)
    fact_id = f"cust-{customer_id}-resolution-{ts.strftime('%Y%m%d')}"
    text = f"On {ts.date().isoformat()}, resolved payment failure for customer {customer_id} (transactions: {', '.join(transaction_ids)}). {resolution_summary}"
    return await agent_memory.bulk_create_long_term_memories_async(
        memories=[
            {
                "id": fact_id,
                "text": text,
                "memory_type": "episodic",
                "owner_id": f"customer-{customer_id}",
                "namespace": "payment-issues",
                "topics": ["incident", "resolution"],
            }
        ]
    )


async def recall_customer_history(agent_memory: AgentMemory, *, customer_id: str, query: str, k: int = 5, similarity_threshold: float = 0.5):
    """What would a future session already know about this customer, before
    calling Context Retriever again? This SDK version (0.4.1) wraps search
    params in a single `request=` object rather than flat kwargs -- differs
    from the skill doc's example, confirmed by inspecting the real signature.

    similarity_threshold defaults to 0.5, not the doc's suggested 0.7 --
    0.7 returned zero hits against this store's actual embeddings for a query
    like "payment card problems"; 0.5 reliably did not. Tune per workload,
    per the doc's own guidance -- 0.7 is a starting point, not a universal."""
    res = await agent_memory.search_long_term_memory_async(
        request={
            "text": query,
            "similarity_threshold": similarity_threshold,
            "filter_op": models.FilterConjunction.ALL,
            "filter_": {"owner_id": {"eq": f"customer-{customer_id}"}},
            "limit": k,
        }
    )
    return res.items
