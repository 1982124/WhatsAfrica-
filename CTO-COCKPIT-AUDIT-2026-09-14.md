# WASSAFRICA — CTO Cockpit Audit

Date: 2026-09-14
Scope: cockpit, owner operations, cost/free-access model, Supabase security posture.
Status: AUDIT BRANCH ONLY — NOT PRODUCTION.

## CTO decision
The owner cockpit must be the central control plane for WassAfrica. The owner should be able to perform all platform-internal activities from the cockpit at no personal/platform usage charge where the platform can legitimately control that access. External provider fees remain distinct and are not bypassed.

## Current architecture observed
- `dashboard.html` is the authenticated user cockpit and currently links to Smart Link, Inbox, Groups, Business Live, Market, Commerce, CRM, Analytics, Assistant, Vitrine, Account Security, Share Center and Calls.
- `admin-cockpit.html` is a separate administrative cockpit covering users, businesses, Smart Links, products, groups, messages, orders, reports, CRM, acquisition, prospects and MFA.
- The repository contains explicit governance/release workflows and a current main commit focused on mobile messaging UX.

## Main finding
The issue is not lack of functionality. It is fragmentation: many operational capabilities already exist, but owner control, daily activity, commercial activity, administration, cost/entitlement state and technical health are not yet presented as one coherent owner control plane.

## Target cockpit
1. Overview: platform/user activity, conversations, leads, orders, Smart Links, alerts, technical health.
2. Quick actions: create/publish/message/manage users/reports/orders/etc.
3. My operations: identity, content, offers, commerce, conversations, Smart Links, business, analytics.
4. Administration: moderation, users, security, reports, platform settings and technical controls.
5. Owner entitlement: explicit owner role/entitlement; no page-by-page exceptions.

## Cost principle
Prefer internal WassAfrica capabilities and existing infrastructure. Do not introduce a paid external service when an adequate internal/free option exists. Payments, SMS, telecom, media or other unavoidable provider charges remain provider costs; the owner interface should not invent charges where none are required.

## Security audit observations
The connected Supabase project contains a large RLS-protected schema. RLS is enabled on the principal public application tables. Several privileged/security-sensitive functions and private tables require deliberate review before any privilege consolidation. Existing security-advisor warnings must be triaged rather than blindly fixed.

Immediate security review targets:
- SECURITY DEFINER functions exposed to anon/authenticated roles.
- owner/admin authorization and `platform_admins`.
- entitlement/subscription tables and free-access logic.
- RLS policies for cockpit-accessible data.
- password breach protection and other Auth configuration warnings.

## Execution order
P0: route/component/data-flow inventory and owner operation matrix.
P1: consolidate cockpit navigation without breaking proven routes.
P2: establish explicit owner entitlement and free internal operations.
P3: harden privileged functions/RLS/Auth.
P4: measure external costs and eliminate avoidable ones.
P5: A→B real tests for every owner action.
P6: production deployment only after regression/certification gates pass.

## Non-negotiables
- Do not break already-proven functionality.
- Do not silently alter payment/provider economics.
- Do not expose admin powers to normal users.
- Do not declare a fix production-ready before a real A→B test.
- This branch is an audit/control-plane preparation branch; no production change is declared.
