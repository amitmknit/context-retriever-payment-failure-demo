"""Extend the live `amalik-context-payment-demo` surface with the payment-failure
entity model (adds PaymentMethod, Transaction, PaymentFailureEvent, SupportTicket,
and the richer Customer fields, plus their ContextRelationships).

Requires CTX_ADMIN_KEY in .env (see README.md for how to obtain one).
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

from context_surfaces import (
    ContextSurfacesClient,
    UpdateContextSurfaceRequest,
    export_data_model,
)
from models import Customer, PaymentFailureEvent, PaymentMethod, SupportTicket, Transaction

load_dotenv()

SURFACE_NAME = "amalik-context-payment-demo"
ENTITIES = [Customer, PaymentMethod, Transaction, PaymentFailureEvent, SupportTicket]


async def main() -> None:
    admin_key = os.getenv("CTX_ADMIN_KEY")
    if not admin_key:
        sys.exit(
            "CTX_ADMIN_KEY is not set in .env. See README.md: "
            "ctxctl auth login --username <you>, then ctxctl admin create."
        )

    async with ContextSurfacesClient() as client:
        surfaces = await client.list_context_surfaces(admin_key=admin_key, page_size=50)
        match = next((s for s in surfaces.context_surfaces if s.name == SURFACE_NAME), None)
        if match is None:
            names = [s.name for s in surfaces.context_surfaces]
            sys.exit(f"Surface {SURFACE_NAME!r} not found. Surfaces visible to this key: {names}")

        print(f"Found surface {match.name!r} (id={match.id}), current tools: {match.tools}")

        new_data_model = export_data_model(
            title="Payment Failure Ops",
            description="Customer, payment method, transaction, failure event, and support "
            "ticket entities for end-to-end payment-failure resolution.",
            entities=ENTITIES,
        )

        updated = await client.update_context_surface(
            match.id,
            UpdateContextSurfaceRequest(data_model=new_data_model),
            admin_key=admin_key,
        )
        print(f"Updated surface. Tools now: {updated.tools}")


if __name__ == "__main__":
    asyncio.run(main())
