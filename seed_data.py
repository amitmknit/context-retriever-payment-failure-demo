"""Seed sample payment-failure data into the live Context Retriever surface via
UnifiedClient.import_data (the documented path — not raw Redis writes; see README.md
and docs/specs/payment-failure-context-retriever-demo.md for why).
"""

import asyncio
import os
import sys

from dotenv import load_dotenv

from context_surfaces import UnifiedClient
from models import Customer, PaymentFailureEvent, PaymentMethod, SupportTicket, Transaction

load_dotenv()

NOW = 1_757_000_000  # fixed epoch base so the demo is reproducible

CUSTOMERS = [
    Customer(id="1001", email="amelia.chen@example.com", tier="enterprise", city="London"),
    Customer(id="1002", email="raj.patel@example.com", tier="premium", city="Mumbai"),
    Customer(id="1003", email="lena.fischer@example.com", tier="standard", city="Berlin"),
    Customer(id="1004", email="joao.silva@example.com", tier="premium", city="Lisbon"),
    Customer(id="1042", email="sofia.moreno@example.com", tier="enterprise", city="Madrid"),
]

PAYMENT_METHODS = [
    PaymentMethod(id="pm_1", customer_id="1001", type="card", last4="4242", status="active"),
    PaymentMethod(id="pm_2", customer_id="1002", type="card", last4="4444", status="active"),
    PaymentMethod(id="pm_3", customer_id="1003", type="bank_transfer", last4="8899", status="active"),
    PaymentMethod(id="pm_4", customer_id="1004", type="card", last4="1881", status="blocked"),
    PaymentMethod(id="pm_5", customer_id="1042", type="card", last4="0007", status="expired"),
]

TRANSACTIONS = [
    Transaction(id="tx_1", customer_id="1001", payment_method_id="pm_1", amount=120.00, currency="USD", status="succeeded", created_at=NOW - 86400 * 3),
    Transaction(id="tx_2", customer_id="1002", payment_method_id="pm_2", amount=59.99, currency="USD", status="succeeded", created_at=NOW - 86400 * 2),
    Transaction(id="tx_3", customer_id="1003", payment_method_id="pm_3", amount=899.00, currency="EUR", status="failed", created_at=NOW - 86400 * 1),
    Transaction(id="tx_4", customer_id="1004", payment_method_id="pm_4", amount=45.50, currency="EUR", status="failed", created_at=NOW - 3600 * 5),
    Transaction(id="tx_5", customer_id="1042", payment_method_id="pm_5", amount=249.00, currency="EUR", status="failed", created_at=NOW - 900),
    Transaction(id="tx_6", customer_id="1042", payment_method_id="pm_5", amount=249.00, currency="EUR", status="failed", created_at=NOW - 1800 * 3),
]

PAYMENT_FAILURES = [
    PaymentFailureEvent(id="pf_1", transaction_id="tx_3", customer_id="1003", failure_code="insufficient_funds", failure_reason="The bank account has insufficient funds.", gateway="adyen", retry_count=1, occurred_at=NOW - 86400 * 1),
    PaymentFailureEvent(id="pf_2", transaction_id="tx_4", customer_id="1004", failure_code="fraud_block", failure_reason="Transaction flagged by risk engine, card blocked.", gateway="stripe", retry_count=0, occurred_at=NOW - 3600 * 5),
    PaymentFailureEvent(id="pf_3", transaction_id="tx_5", customer_id="1042", failure_code="card_expired", failure_reason="Your card has expired.", gateway="stripe", retry_count=2, occurred_at=NOW - 900),
    PaymentFailureEvent(id="pf_4", transaction_id="tx_6", customer_id="1042", failure_code="card_expired", failure_reason="Your card has expired.", gateway="stripe", retry_count=1, occurred_at=NOW - 1800 * 3),
]

SUPPORT_TICKETS = [
    SupportTicket(id="st_1", customer_id="1003", transaction_id="tx_3", status="open", priority="medium", opened_at=NOW - 86400 * 1 + 600),
    SupportTicket(id="st_2", customer_id="1004", transaction_id="tx_4", status="open", priority="high", opened_at=NOW - 3600 * 5 + 300),
]

# import_data requires a single ContextModel type per call.
RECORD_GROUPS = [CUSTOMERS, PAYMENT_METHODS, TRANSACTIONS, PAYMENT_FAILURES, SUPPORT_TICKETS]


async def main() -> None:
    admin_key = os.getenv("CTX_ADMIN_KEY")
    surface_id = os.getenv("CTX_SURFACE_ID")
    if not admin_key or not surface_id:
        sys.exit("CTX_ADMIN_KEY and CTX_SURFACE_ID must be set in .env (run update_model.py first).")

    async with UnifiedClient() as client:
        for group in RECORD_GROUPS:
            entity_name = type(group[0]).__name__
            result = await client.import_data(
                admin_key=admin_key,
                context_surface_id=surface_id,
                records=group,
                on_conflict="overwrite",
                on_error="fail_fast",
            )
            print(f"{entity_name}: imported={result.imported}, failed={result.failed}")
            if result.failed:
                print(result)


if __name__ == "__main__":
    asyncio.run(main())
