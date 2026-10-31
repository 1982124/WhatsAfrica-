---
name: payment-integrations
description: Design, implement and audit payment providers, external payment links, checkout, webhooks, reconciliation, refunds and digital entitlements without inventing provider capabilities.
---

# Payment Integrations

## Provider discovery
- Identify the exact provider product, countries, currencies, settlement model, merchant eligibility, supported channels, fees and required legal onboarding.
- Use official current documentation or verified provider support evidence. Never infer an API, webhook, signature header, payout timeline or country from marketing copy.
- Separate external hosted payment links from a true API checkout integration and from transaction/payout reporting.
- Treat provider coverage as country-by-country and merchant-account-specific.

## Safe architecture
- Keep provider credentials server-side in managed secrets.
- Use a provider adapter with explicit capabilities and normalized internal states.
- Verify webhook signatures and timestamps server-side; reject invalid signatures and replayed events.
- Match provider transaction ID, internal order/reference, amount, currency and merchant before changing order state.
- Enforce idempotency with durable unique constraints and safe retry handling.
- Store only necessary transaction metadata; redact personal/payment data from logs.
- Reconcile asynchronous, delayed, duplicated, reversed and disputed events.
- Do not grant digital access or mark an order paid from a redirect, query parameter, client callback, screenshot or pasted URL.

## External payment links
When only a hosted URL is supported:
- validate HTTPS and reject dangerous schemes/hosts according to policy;
- associate it with an owner and a specific product/service/offer;
- label it as an external payment destination;
- do not claim WASSAFRICA can observe payment success or issue entitlements automatically;
- provide a manual reconciliation path with audit trail if product requirements allow it.
Never ask users to paste API secrets into ordinary URL fields.

## Test matrix
Cover success, cancellation, timeout, duplicate webhook, invalid signature, wrong amount/currency, unknown order, delayed settlement, refund/reversal and provider outage as applicable. Use provider sandbox/test credentials only; never initiate real payments during development tests.

## Done
A payment integration is complete only after provider capability is verified, server-side trust checks are tested, idempotency/reconciliation work, security review passes, and a non-production end-to-end flow is demonstrated. State explicitly what remains manual.
