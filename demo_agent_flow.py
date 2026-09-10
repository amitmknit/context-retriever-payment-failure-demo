"""Live walkthrough: an agent resolving "Customer 1042's payment just failed --
what happened and what should we do?" using only the MCP tools Context Retriever
generated from the entity model -- no SQL, no direct Redis access.

Uses the agent key (CTX_AGENT_KEY), not the admin key: this is exactly the
capability surface a real agent would have.
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
    print(f"result: {json.dumps(result, indent=2)[:1200]}")


async def main() -> None:
    agent_key = os.getenv("CTX_AGENT_KEY")
    if not agent_key:
        sys.exit("CTX_AGENT_KEY must be set in .env")

    async with UnifiedClient() as client:
        customer = await client.query_tool(agent_key, "get_customer_by_id", {"id": "1042"})
        show("1. Who is the customer?", "get_customer_by_id", {"id": "1042"}, customer)

        txns = await client.query_tool(
            agent_key,
            "filter_transaction",
            {"tag_conditions": [{"field": "customer_id", "value": "1042"}], "limit": 10},
        )
        show("2. Their transactions", "filter_transaction", {"customer_id": "1042"}, txns)

        failed_txns = await client.query_tool(
            agent_key,
            "filter_transaction",
            {
                "tag_conditions": [
                    {"field": "customer_id", "value": "1042"},
                    {"field": "status", "value": "failed"},
                ],
                "limit": 10,
            },
        )
        show("3. Just the failed one(s)", "filter_transaction", {"customer_id": "1042", "status": "failed"}, failed_txns)

        failures = await client.query_tool(
            agent_key,
            "filter_paymentfailureevent",
            {"tag_conditions": [{"field": "customer_id", "value": "1042"}], "limit": 10},
        )
        show("4. Failure detail for this customer", "filter_paymentfailureevent", {"customer_id": "1042"}, failures)

        peers = await client.query_tool(
            agent_key,
            "filter_paymentfailureevent",
            {"tag_conditions": [{"field": "failure_code", "value": "card_expired"}], "limit": 10},
        )
        show(
            "5. Pattern check: who else hit card_expired?",
            "filter_paymentfailureevent",
            {"failure_code": "card_expired"},
            peers,
        )

        tickets = await client.query_tool(
            agent_key,
            "filter_supportticket",
            {"tag_conditions": [{"field": "customer_id", "value": "1042"}], "limit": 10},
        )
        show(
            "6. Does an open ticket already exist? (avoid duplicating)",
            "filter_supportticket",
            {"customer_id": "1042"},
            tickets,
        )

        print(
            "\n=== Agent's synthesized answer ===\n"
            "Customer 1042's last two payment attempts (tx_5, tx_6) failed with "
            "failure_code=card_expired on the stripe gateway, on the card ending 0007 "
            "(payment_method pm_5, status=expired). This is a recurring failure, "
            "not a one-off, and other customers hit the same failure_code -- so it's "
            "an expired-instrument issue, not a gateway incident. No support ticket is "
            "open yet for this customer, so the correct action is: prompt for an "
            "updated card, not a blind retry."
        )


if __name__ == "__main__":
    asyncio.run(main())
