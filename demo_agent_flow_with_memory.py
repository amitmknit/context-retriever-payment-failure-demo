"""Extends demo_agent_flow.py with Redis Agent Memory: the resolution
conversation is recorded turn-by-turn as session (short-term) memory, and the
diagnosis is written directly to long-term memory as durable facts about the
customer -- then a second, later "call" shows the agent recalling that
history before it queries Context Retriever again.

This demonstrates the two products together, each doing the job the other
doesn't:
  - Context Retriever: governed access to live, structured business data.
  - Agent Memory:       conversation continuity (short-term) and durable,
                         cross-session recall about a customer (long-term).

Requires CTX_AGENT_KEY (Context Retriever) and AGENT_MEMORY_BASE_URL /
AGENT_MEMORY_STORE_ID / AGENT_MEMORY_API_KEY (Agent Memory) in .env.
"""

import asyncio
import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv

from context_surfaces import UnifiedClient
from redis_agent_memory import models

from agent_memory_helpers import (
    make_client,
    recall_customer_history,
    record_turn,
    remember_recurring_failure,
    remember_resolution,
)

load_dotenv()

CUSTOMER_ID = "1042"
SESSION_ID = f"support-{CUSTOMER_ID}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
CUSTOMER_ACTOR = f"customer-{CUSTOMER_ID}"
AGENT_ACTOR = "payment-ops-agent"


def show(step: str, detail: str) -> None:
    print(f"\n--- {step} ---")
    print(detail)


async def scene_1_first_contact(ctx_client, mem_client, agent_key):
    """The original resolution flow, narrated turn-by-turn into session memory."""
    show("Scene 1 -- first contact", f"session_id={SESSION_ID}")

    opening = "Customer 1042's payment just failed -- what happened and what should we do?"
    await record_turn(mem_client, session_id=SESSION_ID, actor_id=CUSTOMER_ACTOR, role=models.MessageRole.USER, text=opening)
    print(f"[session memory] USER: {opening}")

    customer = await ctx_client.query_tool(agent_key, "get_customer_by_id", {"id": CUSTOMER_ID})
    note = "Looked up customer 1042: Sofia Moreno, Madrid, enterprise tier."
    await record_turn(mem_client, session_id=SESSION_ID, actor_id=AGENT_ACTOR, role=models.MessageRole.ASSISTANT, text=note)
    print(f"[session memory] ASSISTANT: {note}")

    txns = await ctx_client.query_tool(
        agent_key, "filter_transaction", {"tag_conditions": [{"field": "customer_id", "value": CUSTOMER_ID}], "limit": 10}
    )
    note = "Found 2 transactions, both failed, both EUR 249, both on payment_method pm_5."
    await record_turn(mem_client, session_id=SESSION_ID, actor_id=AGENT_ACTOR, role=models.MessageRole.ASSISTANT, text=note)
    print(f"[session memory] ASSISTANT: {note}")

    failures = await ctx_client.query_tool(
        agent_key, "filter_paymentfailureevent", {"tag_conditions": [{"field": "customer_id", "value": CUSTOMER_ID}], "limit": 10}
    )
    note = "Both failures are failure_code=card_expired on stripe -- pm_5's card has expired."
    await record_turn(mem_client, session_id=SESSION_ID, actor_id=AGENT_ACTOR, role=models.MessageRole.ASSISTANT, text=note)
    print(f"[session memory] ASSISTANT: {note}")

    final_answer = (
        "Diagnosis: expired card, recurring (2 attempts), not a wider gateway "
        "incident, no duplicate ticket open. Recommended action: prompt for a "
        "new card, not a blind retry."
    )
    await record_turn(mem_client, session_id=SESSION_ID, actor_id=AGENT_ACTOR, role=models.MessageRole.ASSISTANT, text=final_answer)
    show("Final answer (recorded to session memory)", final_answer)

    return ["tx_5", "tx_6"], "stripe", "pm_5", "card_expired"


async def scene_2_write_long_term_facts(mem_client, transaction_ids, gateway, payment_method_id, failure_code):
    """Skip LLM extraction -- Context Retriever already told us this
    structurally, so write the durable facts directly."""
    show("Scene 2 -- writing durable facts to long-term memory", "")

    res1 = await remember_recurring_failure(
        mem_client,
        customer_id=CUSTOMER_ID,
        failure_code=failure_code,
        gateway=gateway,
        payment_method_id=payment_method_id,
        transaction_ids=transaction_ids,
    )
    print(f"[long-term memory] wrote SEMANTIC fact: created={res1.created}")

    res2 = await remember_resolution(
        mem_client,
        customer_id=CUSTOMER_ID,
        transaction_ids=transaction_ids,
        resolution_summary="Recommended a card update; no support ticket needed.",
    )
    print(f"[long-term memory] wrote EPISODIC fact: created={res2.created}")


async def scene_3_customer_calls_back(mem_client):
    """A week later, in a brand-new session, before Context Retriever is
    even queried -- what does the agent already know about this customer?"""
    show("Scene 3 -- customer calls back next week (new session)", "")

    memories = await recall_customer_history(
        mem_client, customer_id=CUSTOMER_ID, query="payment card problems"
    )
    if not memories:
        print("No long-term memory found yet -- promotion/writes may still be propagating; try again shortly.")
        return

    for m in memories:
        print(f"[recalled] ({m.memory_type}) {m.text}")

    print(
        "\nThe agent can open this new conversation already knowing this is a "
        "repeat issue for this customer -- without re-deriving it from Context "
        "Retriever, and without the customer re-explaining what happened last time."
    )


async def scene_4_rebuild_transcript(mem_client):
    """Show that the original conversation is still fully retrievable --
    e.g. for a human agent picking up where the bot left off."""
    show("Scene 4 -- rebuilding scene 1's transcript from session memory", "")
    res = await mem_client.get_session_memory_async(session_id=SESSION_ID)
    for ev in res.events:
        text = ev.content[0].text if ev.content else ""
        print(f"[{ev.role}] {ev.actor_id}: {text}")


async def main() -> None:
    ctx_agent_key = os.getenv("CTX_AGENT_KEY")
    if not ctx_agent_key:
        sys.exit("CTX_AGENT_KEY must be set in .env")
    for var in ("AGENT_MEMORY_BASE_URL", "AGENT_MEMORY_STORE_ID", "AGENT_MEMORY_API_KEY"):
        if not os.getenv(var):
            sys.exit(f"{var} must be set in .env -- provision an Agent Memory service on Redis Cloud first")

    async with UnifiedClient() as ctx_client, make_client() as mem_client:
        transaction_ids, gateway, payment_method_id, failure_code = await scene_1_first_contact(
            ctx_client, mem_client, ctx_agent_key
        )
        await scene_2_write_long_term_facts(mem_client, transaction_ids, gateway, payment_method_id, failure_code)
        await scene_4_rebuild_transcript(mem_client)
        await scene_3_customer_calls_back(mem_client)


if __name__ == "__main__":
    asyncio.run(main())
