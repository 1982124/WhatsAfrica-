# WhatsAfrica — CTO Product Governance

## Mission
WhatsAfrica must be simple, useful and action-oriented. Nothing visible exists merely because it can exist.

## Core navigation
1. 💬 Discussions — messages, voice notes, audio/video calls.
2. 🌍 Découvrir — people, activities, products and services.
3. 👥 Communautés — discover, join and create communities.
4. 🛒 Marché — commercial discovery and offers.
5. 👤 Moi — profile, own activity, Smart Link, orders and settings.

## Product rules
- If an element looks actionable, it must perform a real action.
- No decorative buttons.
- No duplicate destinations for the same task.
- No user-facing technical terminology when a simple business term exists.
- Authentication must appear only when required by the action.
- Preserve user input when authentication is required.
- Smart Link sells the owner's activity first and grows WhatsAfrica naturally without interrupting the commercial journey.
- Private conversations are not read for CRM; CRM receives structured events only.
- Phone is profile/contact data, not a blocking signup method.
- Human calls/messages are separate from AI voice.

## Keep
Auth, messaging, WebRTC calls, voice messages, communities, discovery, market, Smart Link, products/services, CRM, assistant, sharing, partner payments, security.

## Simplify / contextualize
Dashboard, Analytics, Share Center, Assistant settings, Calls hub, Digital Products, Business Live, payment sub-features, invitation and management screens.

## Remove from primary navigation
Technical/admin screens, duplicate version routes, redundant command buttons, decorative feature badges, empty intermediary pages, and any feature that is not functional end-to-end.

## Certification gate
Before a feature is considered production-ready:
- visible action has a real handler;
- success and failure states are clear;
- mobile/touch/keyboard behavior works;
- authentication is only requested when necessary;
- privacy/RLS is verified;
- production route returns successfully;
- no duplicate UI path remains;
- test link is recorded.

## Current structural findings
The repository contains multiple historical versions of core surfaces (app/auth/calls/vitrine). Only one production implementation per capability should remain routed. Legacy files can remain temporarily for rollback, but must not create user-facing duplicate paths.

## CTO execution order
P0 inventory and route map → P1 consolidate production surfaces → P2 simplify navigation/UI → P3 make every visible action functional → P4 security/RLS audit → P5 production browser certification → P6 remove dead legacy code.
