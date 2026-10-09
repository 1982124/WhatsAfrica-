# WASSAFRICA — Growth mode: free core

**Decision date:** 2026-10-09  
**Status:** Policy for the current user-acquisition phase

## Promise to users

During the growth phase, the core WASSAFRICA experience is free:
- Smart Links and business vitrines, including basic identity and appearance customization.
- Product and service listings, physical and digital products, and digital collections.
- Marketplace discovery and sharing.
- Messaging, calls, groups, and the assistant.
- CRM, analytics, AI Studio, and advanced AI features when enabled for the free plan.

There is no mandatory subscription to start or maintain a basic commercial presence.

## Cost and abuse guardrails

- AI remains available at no subscription cost with a **50-credit monthly allowance** on the current free plan. Do not describe AI as unlimited.
- File storage, video processing, AI inference, payment processing, delivery, messaging/telecom and other third-party services can incur real costs. Apply transparent fair-use limits and provider charges where unavoidable; never misrepresent them as a WASSAFRICA subscription.
- Preserve authentication, authorization, RLS, anti-abuse controls and seller ownership checks. A free plan must never mean public access to another user's data.
- Do not bypass RLS or server-side checks to remove a paywall. Core features should be enabled through the plan/entitlement configuration and targeted policy changes.
- Keep paid tiers inactive and priced at 0 XOF while this decision is in force. Do not reactivate them without a deliberate product decision.

## Release verification

Before calling this fully delivered, verify:
1. The free plan is active and has all core feature flags enabled.
2. Other plans are inactive.
3. Existing businesses remain on the free tier.
4. Vitrine, Smart Link, product publishing, collection creation/editing and marketplace routes work in real authenticated user journeys.
5. AI usage limits are shown clearly and do not block unrelated core features.

## Rollback

Revert the migration and restore plan configuration from the prior migration/audit record if the product strategy changes. Do not remove user content or subscriptions as part of a pricing change.
