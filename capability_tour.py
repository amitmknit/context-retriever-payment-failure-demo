"""Capability tour: hits each distinct class of generated MCP tool, one at a time,
for live customer demos. Run standalone, or run one capability at a time with an
argument -- see CAPABILITIES keys below.

Usage:
    .venv/bin/python3 capability_tour.py            # runs all, in order
    .venv/bin/python3 capability_tour.py lookup      # runs just one
"""

import asyncio
import json
import os
import sys

from dotenv import load_dotenv

from context_surfaces import UnifiedClient

load_dotenv()


def show(step: str, tool: str, args: dict, result) -> None:
    print(f"\n--- {step} ---")
    print(f"call: {tool}({json.dumps(args)})")
    print(f"result: {json.dumps(result, indent=2)[:1000]}")


async def lookup(client, agent_key):
    r = await client.query_tool(agent_key, "get_customer_by_id", {"id": "1001"})
    show(
        "Point lookup -- get_customer_by_id",
        "get_customer_by_id",
        {"id": "1001"},
        r,
    )


async def filter_(client, agent_key):
    args = {"numeric_conditions": [{"field": "amount", "min_value": 200, "max_value": 300}], "limit": 10}
    r = await client.query_tool(agent_key, "filter_transaction", args)
    show(
        "Structured filter -- filter_transaction by numeric range",
        "filter_transaction",
        args,
        r,
    )


async def search(client, agent_key):
    args = {"query": "0007"}
    r = await client.query_tool(agent_key, "search_paymentmethod_by_text", args)
    show(
        "Free-text search -- search_paymentmethod_by_text",
        "search_paymentmethod_by_text",
        args,
        r,
    )


async def count(client, agent_key):
    args = {"function": "count", "group_by": "status"}
    r = await client.query_tool(agent_key, "count_transaction", args)
    show(
        "Aggregate count -- count_transaction grouped by status",
        "count_transaction",
        args,
        r,
    )


async def summarize(client, agent_key):
    args = {"function": "avg", "field": "amount", "group_by": "currency"}
    r = await client.query_tool(agent_key, "summarize_transaction", args)
    show(
        "Aggregate summary -- summarize_transaction: avg(amount) grouped by currency",
        "summarize_transaction",
        args,
        r,
    )


async def expand(client, agent_key):
    args = {
        "set": {
            "entity": "PaymentFailureEvent",
            "tag_conditions": [{"field": "failure_code", "value": "card_expired"}],
        },
        "relationship": "customer",
        "limit": 10,
    }
    r = await client.query_tool(agent_key, "expand_results", args)
    show(
        "Cross-entity join, one call -- expand_results (PaymentFailureEvent -> Customer)",
        "expand_results",
        args,
        r,
    )


CAPABILITIES = {
    "lookup": lookup,
    "filter": filter_,
    "search": search,
    "count": count,
    "summarize": summarize,
    "expand": expand,
}


async def main() -> None:
    agent_key = os.getenv("CTX_AGENT_KEY")
    if not agent_key:
        sys.exit("CTX_AGENT_KEY must be set in .env")

    requested = sys.argv[1:] or list(CAPABILITIES.keys())
    unknown = [r for r in requested if r not in CAPABILITIES]
    if unknown:
        sys.exit(f"Unknown capability {unknown}. Choose from: {list(CAPABILITIES.keys())}")

    async with UnifiedClient() as client:
        for name in requested:
            await CAPABILITIES[name](client, agent_key)


if __name__ == "__main__":
    asyncio.run(main())
