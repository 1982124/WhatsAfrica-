# WASSAFRICA — Production readiness gate
Date: 2026-10-16
Base: `5a76521e34a0b415e95e7334e20209bcaa185806` (production deployment reported READY)
Branch: `cto/production-readiness-gate-2026-10-16`

## Scope and safety
This is an audit/checklist only. It does not change application runtime, authentication, database schema, environment variables, payment providers, or production data. Do not merge or deploy this document as a substitute for tests.

## Verified from connected deployment/repository records
- Latest listed production deployment: `dpl_FTqzSW1CBH5EvEK3nroqVH6yMz1E`, state `READY`.
- Production commit: `5a76521e34a0b415e95e7334e20209bcaa185806`.
- Latest deployment commit message concerns service-worker shell cache v39 after Home HTML repair.
- Open risk records include GitHub issues #153, #207, #212, #213 and #216.
- Deployment READY is not proof of end-to-end product acceptance.

## Country payment readiness — Mali and Benin
Do not infer payment availability from a user's country, currency, or regional payment-system membership. Keep the payment-method list country-specific and server-authoritative.

| Country | SAMA Money status for WASSAFRICA | Release rule |
| --- | --- | --- |
| Mali | Existing product/provider relationship and live eligibility must be confirmed against current merchant/API onboarding records before enabling any new flow. | Keep only the currently approved and tested production flow; use sandbox for new work. |
| Benin | Local SAMA Money account/agent/merchant availability and WASSAFRICA acceptance are **not verified** in this audit. | Do not advertise or activate SAMA Money for Benin until the provider confirms eligibility, settlement, API/webhook access and merchant approval in writing. |

Before expanding country coverage:
- [ ] Confirm provider-supported countries, merchant eligibility, currencies, fees, settlement timelines, refunds and dispute handling directly with each provider.
- [ ] Define a country-to-provider allowlist on the server; never rely only on a client-supplied country or hide/show a button as the security control.
- [ ] If no approved provider exists for a country, show a clear unavailable/not-yet-supported state rather than a fake or unverified payment option.
- [ ] Run sandbox tests per country/currency for success, failure, cancellation, timeout, duplicate webhook, refund and reconciliation.
- [ ] Keep real-payment activation blocked until the provider contract, merchant onboarding, webhook verification, idempotency and reconciliation are signed off.

## Release-blocking checks — leave unchecked until evidence exists
- [ ] Confirm public domain serves the expected commit/build and current Home on a clean Android browser session.
- [ ] Verify canonical Home visuals, official logo, both intended women-focused visuals, KÔRÔ demo placement, no malformed HTML, and no stale service-worker shell.
- [ ] Anonymous visitor can remain on Home and navigate public pages without unwanted redirect, blank screen, or tab closure.
- [ ] Smart Link import rejects private/loopback/link-local IPv4 and IPv6 destinations after DNS resolution and after every redirect; response size/time limits are enforced.
- [ ] Smart Link failures return safe user-facing messages; internal exceptions/secrets stay server-side.
- [ ] Public vitrine/product URL, title, description, absolute HTTPS cover image, Open Graph and Twitter metadata are correct when fetched by social crawlers.
- [ ] Test link previews on WhatsApp/Facebook with cache/privacy caveats recorded; do not treat missing preview alone as proof of broken page.
- [ ] Checkout sandbox only: server verifies amount, currency, order reference and provider status; webhook signature/authentication and idempotency are tested.
- [ ] Digital delivery happens only after trusted server-side payment confirmation; duplicate webhook/retry cannot double-deliver.
- [ ] Anonymous/authenticated route access and Supabase RLS are tested separately; client-side guards are not treated as authorization.
- [ ] SAMA Money remains documentation/sandbox-only until merchant onboarding, API/webhook contract, credentials handling, reconciliation and sandbox evidence are reviewed.
- [ ] Build and CI pass; verify Vercel function count stays within the currently available plan limit before adding API functions.
- [ ] Confirm GitHub main-branch protection with an authorized account; current audit record says this was not verifiable.
- [ ] Record test date, device/browser, URLs, non-sensitive evidence, commit SHA and result in issue #153.

## Decision
**NO-GO for payment activation and broad release certification** until all relevant release-blocking checks have evidence. Keep the canonical Home and current payment provider unchanged. Any runtime fix must be small, isolated, reviewed in a PR, tested in Preview, and have a rollback plan. No paid upgrade, real payment, secret rotation, schema migration, merge, or production deployment is authorized by this checklist.

## Tracking
- Release gate: https://github.com/1982124/WhatsAfrica-/issues/153
- Security/Smart Link: https://github.com/1982124/WhatsAfrica-/issues/207
- Regression freeze: https://github.com/1982124/WhatsAfrica-/issues/212
- Visitor stability: https://github.com/1982124/WhatsAfrica-/issues/216
- Publishing/share UX: https://github.com/1982124/WhatsAfrica-/issues/213
