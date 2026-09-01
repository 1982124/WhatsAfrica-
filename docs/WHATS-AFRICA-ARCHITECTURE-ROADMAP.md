# WhatsAfrica — Architecture, UX, Branding & 12-month roadmap

## Vision
WhatsAfrica is not “African WhatsApp”. It is a universal afro-digital platform where **conversation → trust → opportunity → commerce**.

## Target architecture
- Web/mobile-first client with progressive enhancement and offline-friendly UX.
- Supabase/Postgres as transactional source of truth for profiles, conversations, commerce, calls and policy-controlled data.
- Supabase Realtime Broadcast for realtime signaling/events; do not introduce Firebase unless a measured workload proves it is necessary.
- WebRTC for 1:1 calls; TURN is mandatory before calling this production-grade on heterogeneous mobile networks.
- AES-256-GCM + asymmetric device identity/envelopes for E2EE. Key lifecycle and multi-device recovery remain security-critical work.
- Vercel CDN/edge delivery for public pages and Smart Links; APIs remain stateless and rate-limited.
- Object storage for media with explicit size/MIME/path policies.
- Observability: structured logs, health checks, audit logs, rate limits, error budgets and synthetic smoke tests.

## Performance gates
- LCP target < 2.0s on representative mobile connections.
- INP target < 200ms.
- CLS target < 0.1.
- Lazy-load non-critical media; reserve image/video dimensions; avoid large blocking JS.
- Keep public Smart Links indexable and fast; private/admin surfaces noindex.
- Measure before/after every major frontend change.

## Messaging core
1. Conversation list + unread state.
2. Reliable send/receive with idempotent message IDs.
3. Realtime delivery + reconnect/backoff.
4. Typing/presence/read states only where useful.
5. Media attachments with validation.
6. E2EE by default for eligible private conversations.
7. Translation on demand, cached per message/language.
8. Call entry points directly in conversation UI.

## Calls
### Phase 1
- Authenticated 1:1 audio/video.
- Incoming-call notification.
- Accept/reject/end.
- Camera/microphone controls.
- Network state and reconnect handling.
- No recording by default.

### Production gate
- TURN configured and tested from mobile/NAT-restricted networks.
- Signaling authorization tested.
- Abuse/rate limits and call expiry.
- No claim of call E2EE until separately implemented and audited.

## UX/UI
### Information architecture
Home → Inbox → Communities → Business Live → Smart Link → Assistant → Orders → Profile.

### Smart Link
Every Smart Link should combine identity, storefront, assistant, conversation, order, payment and discovery. A shared link is also a product-discovery gateway into WhatsAfrica.

### Accessibility
- Keyboard navigation.
- Semantic labels and landmarks.
- Visible focus states.
- Contrast-aware themes.
- Reduced-motion preference.
- Screen-reader friendly controls and live regions for messages/calls.
- Touch targets sized for mobile use.

## Localization
Initial product languages: French, English, Swahili, Arabic.
Architecture: stable translation keys, locale fallback, pluralization, RTL support for Arabic, and no business data translated at rest unless explicitly requested.

## Payments
Provider abstraction rather than hard-coding one network:
- Orange Money
- M-Pesa
- other local Mobile Money rails
- international cards where commercially viable

Payment lifecycle: intent → provider authorization → webhook verification → idempotent fulfillment → reconciliation. Never mark a payment successful from client-side claims.

## Education & marketplace
- Education modules: road safety, digital coaching/inclusion, and later health content subject to qualified content review.
- Marketplace: services/content with seller identity, catalog, order, payment and dispute primitives.

## Branding kit
Position: **premium afro-digital**, not a WhatsApp clone.

Recommended design direction:
- Deep graphite base + warm gold + emerald accent.
- Editorial serif for brand/display and clean sans-serif for product UI.
- Strong geometric motifs inspired by African visual systems without copying a specific culture's sacred symbols.
- Motion: restrained, purposeful micro-interactions.
- Avoid WhatsApp's green/white visual language and iconography.

## Monetization
### Free
Messaging, communities, basic Smart Link, basic assistant, limited media.
### Premium
Advanced assistant, business automation, analytics, advanced Smart Link themes, translation quota, priority support and advanced commerce tools.
### Marketplace
Commission on paid services/content.
### Payments
Transparent transaction/service fees where providers permit.
### Partnerships
Mobile operators, fintechs, education and business ecosystems.

Never paywall core human communication.

## 12-month roadmap
### Months 1–2 — Messaging reliability
Messaging Core, realtime reconnect, unread/read states, notification model, media UX, performance baseline, security tests.

### Months 3–4 — Trust & privacy
E2EE production integration, device management, abuse controls, reports/blocking, privacy controls, RGPD foundations.

### Months 5–6 — Calls & language
TURN, mobile network testing, calls embedded in Inbox, translation UX, FR/EN/SW/AR and RTL.

### Months 7–8 — Commerce expansion
Mobile Money provider adapters, webhook reconciliation, delivery states, seller analytics, advanced Smart Links.

### Months 9–10 — Marketplace & education
Service marketplace, education modules, ratings/trust signals, moderation workflows.

### Months 11–12 — Scale & growth
Regional infrastructure strategy, load testing, CDN optimization, observability/SLOs, SEO content engine, referral loops, premium plans and partnership pilots.

## CTO release gates
A feature is “done” only when:
- the happy path works;
- unauthorized access is denied;
- mobile UX works;
- failure/retry behavior is defined;
- logs/metrics exist where operationally important;
- no fake payment/call/security claim is exposed;
- production smoke test passes.
