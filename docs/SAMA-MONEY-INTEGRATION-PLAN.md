# SAMA Money integration preparation for WASSAFRICA

## Status

Preparation only. This document does **not** enable SAMA Money, create a merchant account, or move money. The existing Money Fusion checkout/webhook must remain unchanged until the replacement is reviewed and tested.

## Officially documented starting point

- Developer page: https://sama.money/developpeurs/
- API documentation / developer console: https://developer.sama.money/
- Create a charge: `POST https://api.sama.money/v1/charges`
- Authentication: `Authorization: Bearer <server-side API key>`
- Idempotency: send a unique `Idempotency-Key` for each payment attempt.
- Example request fields shown by SAMA: `client_phone`, `amount_xof`, `description`.
- SAMA advertises a free sandbox using fictitious funds and signed webhooks. The public page states 0.3% per successful online payment, paid by the merchant, and production keys are only activated after business verification and approval.

The exact charge response schema, webhook signature algorithm/header, status-query endpoint, retry behavior, and cancellation/expiry semantics must be taken from SAMA's current API reference before implementing verification. Do not infer these details from examples.

## Non-negotiable marketplace constraint

SAMA's published guidance explicitly says that a marketplace/aggregator collecting funds on behalf of other sellers is a regulated payment service and is not covered by the ordinary API guide. WASSAFRICA must obtain written confirmation from SAMA (and any required authorization) before using a single WASSAFRICA account to collect for multiple sellers or splitting/redistributing their funds.

Ask SAMA to confirm in writing which supported model is allowed:
1. each seller has their own verified merchant account and API credentials; or
2. WASSAFRICA is approved as a marketplace/aggregator under a specific contract and regulatory framework.

Do not represent either model as available until SAMA confirms it.

## Planned safe implementation

1. Keep the current checkout contract and order records; add a provider adapter rather than replacing checkout logic.
2. Add SAMA configuration only in server-side secrets/environment variables. Never expose API keys in browser code, logs, Git, or client-visible database rows.
3. Initially allow only sandbox mode and test credentials. Do not add production credentials until approved.
4. Create a charge server-side using the order's authoritative amount in XOF, not a client-supplied amount. Validate order ownership, unpaid/cancelled state, seller/business ownership, phone format, and currency.
5. Use a stable idempotency key per payment intent and persist the provider's charge/reference identifiers.
6. Verify signed webhooks using SAMA's documented signature method, reject invalid signatures, and fetch/verify payment status from SAMA if the official guide requires it. Never trust a browser redirect as proof of payment.
7. Check provider reference, order reference, currency, exact amount, and final status before calling the existing idempotent payment-application RPC. Ignore duplicate events safely.
8. Test success, decline, timeout, replayed webhook, invalid signature, wrong amount/currency, cancelled order, and delayed webhook with fictitious funds.
9. Keep the existing payment path intact until sandbox tests pass and a reviewed release is deployed. No real-money test without explicit authorization.

## Acceptance criteria

- No real debit during sandbox testing.
- API keys remain server-side.
- Duplicate requests/events cannot create duplicate payment or unlock events.
- An ebook/download unlocks only after a server-verified successful payment.
- Every failure leaves a recoverable order/payment-intent state.
- Written SAMA approval for the marketplace funds flow is recorded before production activation.
