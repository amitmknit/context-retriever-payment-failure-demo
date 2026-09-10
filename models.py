"""Context Retriever entity model for the payment-failure demo.

Extends the `Customer` entity that already exists on the live
`amalik-context-payment-demo` surface with the four entities needed to resolve a
payment failure end to end. See docs/specs/payment-failure-context-retriever-demo.md
for the full field/index table and the relationship-inference assumption this file
depends on (FK fields named `<entity>_id`, tag-indexed, matching the target entity's
key component).
"""

from typing import Any

from pydantic import ConfigDict

from context_surfaces.context_model import ContextField, ContextModel, ContextRelationship


class Customer(ContextModel):
    __redis_key_template__ = "customer:{id}"

    id: str = ContextField(description="Customer ID", is_key_component=True)
    email: str = ContextField(description="Email address", index="text")
    tier: str = ContextField(
        description="Subscription tier",
        index="tag",
        allowed_values=["standard", "premium", "enterprise"],
    )
    city: str = ContextField(description="City", index="tag")


class PaymentMethod(ContextModel):
    __redis_key_template__ = "payment_method:{id}"

    id: str = ContextField(description="Payment method ID", is_key_component=True)
    customer_id: str = ContextField(
        description="Owning customer ID", index="tag"
    )
    type: str = ContextField(
        description="Instrument type",
        index="tag",
        allowed_values=["card", "bank_transfer", "wallet"],
    )
    last4: str = ContextField(description="Last 4 digits / account ref", index="text")
    status: str = ContextField(
        description="Instrument status",
        index="tag",
        allowed_values=["active", "expired", "blocked"],
    )

    customer: Any = ContextRelationship(
        description="Customer who owns this payment method",
        target="Customer",
        source_field="customer_id",
    )


class Transaction(ContextModel):
    __redis_key_template__ = "transaction:{id}"

    id: str = ContextField(description="Transaction ID", is_key_component=True)
    customer_id: str = ContextField(description="Customer ID", index="tag")
    payment_method_id: str = ContextField(
        description="Payment method used", index="tag"
    )
    amount: float = ContextField(description="Amount charged", index="numeric")
    currency: str = ContextField(description="ISO currency code", index="tag")
    status: str = ContextField(
        description="Transaction status",
        index="tag",
        allowed_values=["succeeded", "failed", "pending"],
    )
    created_at: int = ContextField(
        description="Epoch seconds transaction was created", index="numeric"
    )

    customer: Any = ContextRelationship(
        description="Customer who made this transaction",
        target="Customer",
        source_field="customer_id",
    )
    payment_method: Any = ContextRelationship(
        description="Payment method used for this transaction",
        target="PaymentMethod",
        source_field="payment_method_id",
    )


class PaymentFailureEvent(ContextModel):
    __redis_key_template__ = "payment_failure:{id}"

    id: str = ContextField(description="Failure event ID", is_key_component=True)
    transaction_id: str = ContextField(
        description="Transaction that failed", index="tag"
    )
    customer_id: str = ContextField(
        description="Customer ID (denormalized for direct lookup)", index="tag"
    )
    failure_code: str = ContextField(
        description="Machine-readable failure classification",
        index="tag",
        allowed_values=[
            "card_expired",
            "insufficient_funds",
            "gateway_timeout",
            "fraud_block",
        ],
    )
    failure_reason: str = ContextField(
        description="Raw gateway failure message", index="text"
    )
    gateway: str = ContextField(
        description="Payment gateway",
        index="tag",
        allowed_values=["stripe", "adyen"],
    )
    retry_count: int = ContextField(
        description="Number of retries attempted so far", index="numeric"
    )
    occurred_at: int = ContextField(
        description="Epoch seconds the failure occurred", index="numeric"
    )

    transaction: Any = ContextRelationship(
        description="Transaction that produced this failure",
        target="Transaction",
        source_field="transaction_id",
    )
    customer: Any = ContextRelationship(
        description="Customer affected by this failure",
        target="Customer",
        source_field="customer_id",
    )


class SupportTicket(ContextModel):
    __redis_key_template__ = "support_ticket:{id}"

    id: str = ContextField(description="Ticket ID", is_key_component=True)
    customer_id: str = ContextField(description="Customer ID", index="tag")
    transaction_id: str = ContextField(
        description="Related transaction, if any", index="tag"
    )
    status: str = ContextField(
        description="Ticket status",
        index="tag",
        allowed_values=["open", "pending", "closed"],
    )
    priority: str = ContextField(
        description="Ticket priority",
        index="tag",
        allowed_values=["low", "medium", "high"],
    )
    opened_at: int = ContextField(
        description="Epoch seconds the ticket was opened", index="numeric"
    )

    customer: Any = ContextRelationship(
        description="Customer who opened this ticket",
        target="Customer",
        source_field="customer_id",
    )
    transaction: Any = ContextRelationship(
        description="Transaction this ticket relates to",
        target="Transaction",
        source_field="transaction_id",
    )
