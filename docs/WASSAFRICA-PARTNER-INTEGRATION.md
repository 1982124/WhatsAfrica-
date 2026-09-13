# WASSAFRICA — Partner Services Integration

## Objective

WASSAFRICA can host the **user experience and distribution journey** for services supplied by qualified partners without presenting WASSAFRICA as the provider of a regulated service it is not licensed to provide.

The product principle is:

> **WASSAFRICA owns the journey; the qualified partner owns the regulated service and its execution.**

## Supported service families

- payments
- money transfer and reception
- banking services
- mobile money
- insurance
- telecom/connectivity
- logistics and other enterprise services
- diaspora-oriented services

Availability is country- and partner-dependent. A service must not be displayed as live merely because its UI exists.

## Integration modes

### 1. Referral
WASSAFRICA creates a qualified referral and sends the user to the partner.

### 2. Embedded handoff
The user starts in WASSAFRICA and completes the regulated step in a partner-controlled flow, with a return/callback where technically and contractually supported.

### 3. API orchestration
Where a partner provides an approved API and the legal/contractual model permits it, WASSAFRICA orchestrates the experience while the partner remains authoritative for KYC, authorization, execution, settlement, limits, fees and compliance.

## Core referral object

A referral should have a stable identifier such as `WAF-REF-XXXXXXXX` and, where applicable:

- referral_id
- partner_id
- country_code
- service_type
- intent
- source_surface
- smartlink_id
- consent_status
- created_at
- status
- outcome_at

Do not put unnecessary personal or financial data in the referral identifier.

## Status lifecycle

`created → consented → sent → received → qualified → accepted → completed`

Terminal/exception states may include `rejected`, `expired`, `cancelled` and `failed`.

## Partner outcome

Partners may return a minimal outcome event containing the referral identifier, event type, timestamp and contractual attribution data. WASSAFRICA should not require broad partner access to its database.

## Commercial attribution

Commission is a **contractual business rule**, not a UI assumption. Possible models include qualified lead, activation, completed service, transaction or subscription. The platform must record the event that supports the agreed commission calculation.

Never invent conversions, commissions, partners or volume.

## Security and privacy

- least-privilege partner scopes
- tenant isolation
- consent before personal-data handoff where required
- data minimization
- signed/authenticated server-to-server events
- idempotency for callbacks and outcome events
- audit trail for referral lifecycle changes
- secrets only on trusted server infrastructure
- no service-role key in browser code
- no partner-wide database access

Recommended future scopes:

- `referral.write`
- `referral.read`
- `outcome.write`
- `analytics.read`
- `smartlink.read`

## Regulated services rule

For regulated financial, insurance, telecom or similar services, WASSAFRICA must not imply that it is the licensed provider unless the applicable legal entity, authorization and contractual structure actually support that statement.

The partner remains authoritative for:

- identity/KYC
- eligibility
- regulatory disclosures
- transaction authorization
- pricing and fees
- settlement/custody
- service execution
- dispute and regulatory obligations

## Pilot rule

Start with **one country + one partner + one business line + one measurable outcome**. Prove the complete journey before adding additional partners or countries.

## Product acceptance criteria

A partner service is considered integrated only when:

1. the partner is contractually identified;
2. the service and countries are explicitly configured;
3. the user-facing provider identity is clear;
4. consent/handoff behavior is tested;
5. the partner API or referral path is tested end-to-end;
6. outcome attribution is reproducible;
7. failure and retry behavior are defined;
8. audit evidence exists;
9. no unsupported availability claim is displayed.

**UI present ≠ service integrated.**
