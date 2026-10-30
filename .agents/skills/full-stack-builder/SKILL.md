---
name: full-stack-builder
description: Orchestrate full-stack application design, implementation, integration, testing, security review, deployment and maintenance across the repository's actual stack. Use for new features, app construction, architecture decisions, API/database work and cross-layer changes.
---

# Full-Stack Builder

## Mission
Operate as a senior full-stack engineering team, not a code generator. Deliver maintainable, accessible, secure and observable product behavior from UI to database and deployment. Prefer the existing stack and verified project conventions over fashionable rewrites.

## Mandatory first pass
1. Read `AGENTS.md`, project CTO rules, safe-change skill, architecture docs, route map, package manifests, lockfiles, CI and deployment configuration.
2. Inspect the current implementation and the exact user journey before proposing a new route, table, provider or dependency.
3. Establish a baseline: current production/preview state, tests, known defects, canonical UI/assets, data contracts and affected users.
4. State acceptance criteria, non-goals, adjacent behaviors to preserve, risk level and rollback path.
5. Search for existing capabilities and reusable primitives. Do not build a second version of something already implemented.

## Stack routing
Select specialist guidance only when it matches the actual stack:
- Frontend and UX: React/Next.js, TypeScript, accessibility, responsive behavior, design system, browser verification. Use installed frontend/design skills where available.
- Backend/API: contracts, authorization, validation, idempotency, rate limits, retries, timeouts, observability and error semantics.
- Database: schema ownership, migrations, indexes, transactions, RLS/grants, backup and recovery. For Supabase, read the installed Supabase skill and Postgres best practices.
- Hosting/DevOps: CI, preview, environment configuration, build/runtime logs, quotas, caching, rollback and production verification. For Vercel, use installed Vercel deployment, functions and verification skills as applicable.
- AI/agents: model/provider routing, prompt and tool boundaries, structured outputs, evaluations, privacy, latency and cost controls. Use Vercel AI SDK/Gateway or agent-building skills only when they fit the existing implementation.
- Mobile: use Flutter/React Native/native platform guidance only if the repository actually contains or plans that client.
- Automation: use n8n/Zapier/workflow skills only when the system uses them; keep secrets and retries server-side.
- Payments: route to `payment-integrations`; never infer provider API/webhook behavior.
- Security: route to `security-hardening`.
- Existing app defects and release readiness: route to `app-stabilization`.

A listed technology is not automatically installed, connected, licensed or suitable. Do not claim otherwise. Confirm current official documentation and project compatibility before adding dependencies or integrations.

## Engineering loop
Discover → baseline → threat/risk review → plan → smallest reversible implementation → static checks → unit/integration/E2E tests → complete diff review → preview → browser/API/data verification → production release only with approval and gates → post-deploy observation.

## Implementation contracts
- Separate presentation, domain rules, persistence and external-provider adapters.
- Validate all untrusted input at boundaries; use explicit schemas/types.
- Enforce authorization server-side for every object and action; never rely on hidden UI controls.
- Make retried mutations and event handlers idempotent.
- Bound pagination, query sizes, upload sizes, execution time and AI spend.
- Handle loading, empty, success, partial failure, retry and permission-denied states.
- Preserve localization, accessibility, keyboard behavior, responsive layout and existing analytics.
- Add only necessary dependencies; pin versions and update the lockfile.
- Keep secrets out of source, browser bundles, logs, prompts and client-visible errors.

## Quality bar
- Tests reproduce the bug or prove the new acceptance criteria.
- Security tests include unauthorized, cross-user and malformed-input cases.
- Integration tests cover failure/retry paths, not just happy paths.
- UI changes are inspected at mobile and desktop widths with a real browser where available.
- Review the entire diff and compare it with the baseline.
- Never treat a successful build as proof of a working product journey.

## Completion report
Separate: implemented, committed, CI-passed, preview-deployed, browser-verified, production-deployed and end-to-end verified. Include exact evidence and remaining gaps. If a check cannot run, say why; never manufacture a pass.
