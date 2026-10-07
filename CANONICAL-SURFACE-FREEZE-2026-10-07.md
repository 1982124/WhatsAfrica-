# WASSAFRICA — Canonical Surface Freeze
## 2026-10-07

This document freezes the public production entry points during the consolidation phase.

### Canonical production surfaces

| Capability | Canonical public route | Production implementation |
|---|---|---|
| Home / launch | / | /launch-v2.html |
| Messaging | /inbox | /inbox.html |
| Authentication | /auth | /auth.html |
| Profile | /profile | /profile.html |
| Cockpit | /cockpit | /cockpit.html |
| Smart Link creator | /smartlink | /smartlink-free-v3.html |
| Smart Link AI | /smartlink-ai | /smartlink-ai-v2.html |
| Business vitrine | /vitrine | /business-vitrine-v3.html |
| Market | /marche | /marche.html |
| Product | /marche/produit/:id | /product.html?id=:id |
| Service | /marche/service/:id | /service-detail-v1.html?id=:id |
| Cart | /cart | /cart.html |
| Orders | /orders | /orders.html |
| Collections | /collections | /collections-manage.html |
| Library | /library | /library.html |
| Network | /network | /africa-network.html |
| Discovery | /discover | /discover-v1.html |
| CRM | /crm | /crm.html |
| Analytics | /analytics | /analytics-shell.html |

### Freeze rules

1. Do not create another versioned implementation of a canonical surface.
2. Do not link users directly to historical `*-vN.html` implementations.
3. New fixes must land in the canonical implementation behind the public route.
4. Historical implementations remain available only for controlled migration, comparison, or rollback until explicitly retired.
5. New UX work must not introduce generic placeholder media when canonical production media exists.
6. Production certification requires the public route, not merely a versioned file, to be tested.
7. A deployment is not considered stable until runtime errors and critical user journeys are checked after release.

### Current consolidation priorities

- Home visual integrity and canonical media.
- Market truth-first product/media delivery.
- Smart Link → product/service → contact flow.
- Cockpit route and permission boundaries.
- Runtime error reduction.
- Removal of duplicate routes only after dependency/reference audit.

### Release marker

The Vercel global response header is marked:

`X-WASSAFRICA-Release: 2026-10-07-canonical-freeze`

This is a consolidation marker, not a claim of full product certification.
