# WASSAFRICA — CTO Cockpit Audit & Final Scope

Date: 2026-09-14
Scope: cockpit, owner operations, partner documents, role boundaries, cost/free-access model, Supabase security posture.
Status: AUDIT / CONTROL-PLANE BRANCH ONLY — NOT PRODUCTION.

## CTO decision
The owner cockpit is the central control plane for WassAfrica. The owner should be able to perform all platform-internal activities from the cockpit at no personal/platform usage charge where the platform can legitimately control that access. External provider fees remain distinct and are never bypassed.

## Current architecture observed
- `dashboard.html` is the authenticated user cockpit and links to Smart Link, Inbox, Groups, Business Live, Market, Commerce, CRM, Analytics, Assistant, Vitrine, Account Security, Share Center and Calls.
- `admin-cockpit.html` is a separate administrative cockpit covering users, businesses, Smart Links, products, groups, messages, orders, reports, CRM, acquisition, prospects and MFA.
- The repository contains governance/release workflows and the current main line includes recent mobile messaging UX work.

## Main finding
The principal problem is fragmentation, not missing functionality. Owner control, daily activity, commercial activity, administration, partner operations, cost/entitlement state and technical health must become one coherent owner control plane without breaking existing proven routes.

## Final cockpit structure
1. **Overview** — platform/user activity, conversations, leads, orders, Smart Links, alerts and technical health.
2. **Quick actions** — create/publish/message/manage users/reports/orders and other existing operations.
3. **My operations** — identity, content, offers, commerce, conversations, Smart Links, business, analytics and calls.
4. **Partners & Documents** — partner dossiers, documents, versions, attachments, sending, status and history.
5. **Administration** — platform users, moderation, security, reports, platform settings and technical controls.
6. **Owner entitlement** — explicit owner role/entitlement; no page-by-page free-access exceptions.

## Partner documents — required capability
The owner cockpit must provide a single partner-document workflow rather than scattered manual pages:
- prepare a partner dossier;
- create or attach the required documents;
- maintain document versions and status;
- send documents to the intended partner;
- track `draft → sent → viewed → accepted/signed → archived` where the underlying workflow supports those states;
- retain a clear history of documents and partner exchanges;
- identify missing documents before sending.

Initial document categories to support as configurable templates/attachments, not hard-coded legal claims:
- WassAfrica presentation;
- offer/service presentation;
- partnership proposal;
- partnership agreement/convention;
- commercial terms;
- company/partner information sheet;
- required legal/compliance documents when actually applicable;
- technical/compliance attachments when actually applicable.

The platform must not invent legal requirements. Required documents vary by partner and jurisdiction and must remain configurable.

## Role model — mandatory separation
The word `admin` must never be treated as a global authorization by itself. The system must distinguish at minimum:

| Role | Scope | Authority |
|---|---|---|
| **Platform Owner** | Entire WassAfrica platform | Global owner control, partner operations, platform administration, entitlements and internal operations |
| **Platform Admin** | Entire platform, only when explicitly granted | Operational platform administration according to assigned permissions; not automatically the owner |
| **Business Owner** | Own business/workspace | Own business, team, catalogue, orders, vitrine and related business operations |
| **Community/Group Admin** | Specific community/group only | Members, content, rules, moderation and announcements inside that group/community |
| **Member/User** | Own account and permitted resources | Normal product usage within granted permissions |

A **Community/Group Admin is NOT a Platform Admin** and must never inherit platform-wide powers merely because they administer a community/group.

Likewise, owning a business, vitrine, Smart Link or group must not grant platform administration privileges.

Authorization must be based on explicit server-side role/entitlement checks and RLS/policy boundaries, never on UI visibility alone.

## Owner free-access principle
`Free for owner` means no unnecessary product/platform charge for platform-internal operations that WassAfrica can legitimately authorize itself. It does **not** mean that third-party provider infrastructure becomes free.

The implementation target is an explicit owner entitlement/role, backed by server-side authorization, covering all legitimate internal platform capabilities. External provider costs such as payment processing, SMS, telecom, media or other unavoidable charges remain actual provider costs and must be measured rather than hidden or bypassed.

## Security review targets
Before consolidating privileges, inspect and validate:
- `SECURITY DEFINER` functions exposed to `anon`/`authenticated`;
- `platform_admins` and owner/admin authorization;
- `digital_entitlements`, `user_subscriptions`, `subscription_plans` and existing free-access logic;
- RLS policies for cockpit, partner, business and group/community data;
- private security-sensitive tables and administrative functions;
- Auth security configuration, including password-breach protection warnings.

Existing security-advisor warnings must be triaged individually. Do not blindly change intentional privileged functions or policies.

## Messaging regression guard
The cockpit consolidation must preserve the current product direction that messaging feels familiar and native. Messaging, camera/audio/video capture and photo/short-video sharing should remain part of the normal conversation flow where supported, rather than forcing users through unnecessary separate communication pages. Known navigation loops that return users unexpectedly to Messages are regression targets for A→B testing.

## Execution order
**P0 — Inventory & authorization matrix**
- map routes/components/data flows;
- map owner/business/group/community/member permissions;
- map partner-document data flow;
- map entitlement and external-cost paths;
- identify duplicate/legacy routes and navigation loops.

**P1 — Cockpit consolidation**
- centralize navigation around the final cockpit structure;
- preserve proven routes and existing functionality;
- do not expose platform administration to ordinary users;
- integrate Partner Documents without creating unnecessary page fragmentation.

**P2 — Owner entitlement**
- establish explicit owner entitlement/role;
- remove page-by-page exceptions;
- verify server-side authorization and RLS.

**P3 — Security hardening**
- audit privileged functions;
- audit RLS;
- harden Auth configuration;
- verify separation between platform, business and group/community administration.

**P4 — Cost control**
- measure external provider costs;
- remove avoidable paid dependencies where an adequate internal/free capability exists;
- do not alter provider/payment economics silently.

**P5 — Real A→B verification**
- owner login → cockpit → operation → result;
- owner → partner dossier → document → send → status/history;
- business owner → business operation only;
- group/community admin → group operation only;
- normal member → no privileged operation;
- messaging → conversation → media/audio/video action without navigation loop;
- security-negative tests for cross-role access.

**P6 — Production gate**
Production deployment/certification only after the above tests pass and regressions are reviewed. This branch remains non-production until that gate is explicitly satisfied.

## Non-negotiables
- Do not break already-proven functionality.
- Do not silently alter payment/provider economics.
- Do not expose platform administration to group/community admins or ordinary users.
- Do not treat `admin` as a sufficient global authorization.
- Do not invent legal document requirements.
- Do not declare a fix production-ready before real A→B evidence.
