# WASSAFRICA — ECC CTO Rules

## Mission
Treat WASSAFRICA as a production-critical marketplace platform. Optimize for correctness, security, reversibility, observability, and real end-to-end functionality—not merely code that builds.

## Non-negotiable invariants
1. NEVER modify the public Home, its canonical imagery, asset mapping, or visual structure unless the user explicitly authorizes a Home change.
2. Preserve existing canonical assets and URLs. Never replace them with generated, generic, duplicate, placeholder, map, or stock imagery unless explicitly requested.
3. Before changing production behavior, inspect the existing implementation, database schema, RLS policies, triggers, Edge Functions/API routes, and deployment state.
4. Never claim a feature is complete because source code was changed. Distinguish: implemented, committed, deployed, READY, browser-verified, and real transaction-verified.
5. Never invent provider APIs, webhook contracts, secrets, SDK methods, or database columns. Use official provider documentation or the existing verified integration.
6. Never expose service-role keys, provider secrets, webhook secrets, or privileged database credentials to browser code.
7. Payment state must be confirmed server-side. A redirect, button click, external payment URL, or client callback is NOT proof of payment.
8. Digital entitlement/access must only be granted after authoritative server-side payment confirmation.
9. Keep payment processing idempotent. Provider events and retries must not create duplicate orders, transactions, or entitlements.
10. Preserve RLS and least privilege. Prefer SECURITY DEFINER functions with a tightly controlled search_path only where justified.
11. Do not create parallel implementations of the same critical path. Identify and retire/disable obsolete download, checkout, webhook, or entitlement paths when replacing them.
12. For database changes, provide safe migrations and verify the resulting schema/functions/triggers in the target environment.
13. For production fixes, prefer the smallest reversible change that solves the verified root cause.
14. Never silently weaken validation, authorization, rate limits, or auditability to make a test pass.
15. If a required external dependency cannot be verified, stop short of claiming end-to-end success and state the exact missing verification.

## WASSAFRICA architecture priorities
- Frontend: preserve stable public surfaces and canonical assets.
- Supabase: source of truth for authorization, orders, payments, entitlements, and protected digital content.
- Vercel: deployment/runtime surface; production must be READY.
- GitHub: source of truth; changes must be reviewable and reversible.
- Digital products: secure storage + signed/authorized delivery; no public storage bypass.
- Payments: Money Fusion and external providers such as Maketou/Chariow are separate provider paths. Do not assume external payment links automatically issue WASSAFRICA entitlements.
- External payment links: if a provider has no verified webhook/API bridge, label the flow accordingly and do not falsely promise automatic access.

## Required workflow for substantial changes
Plan -> inspect dependencies -> implement -> static review -> security review -> tests -> browser/E2E verification -> deploy -> verify deployment READY -> verify production behavior -> report exact status.

## Definition of done
A change is DONE only when:
- source is committed;
- relevant automated/static tests pass;
- security/RLS implications are checked;
- production deployment is READY when applicable;
- affected production UI/API is actually exercised;
- critical payment/access paths have server-side verification;
- no regression is detected on protected surfaces;
- the final report separates facts from assumptions.

## Production reporting
Always report:
- commit SHA;
- deployment ID/state when applicable;
- exact production URL only after READY;
- tests actually run;
- browser/E2E checks actually run;
- known remaining risks;
- anything not verified.

## Regression discipline
If a change causes a regression:
1. identify the first known-good commit/deployment;
2. compare the regression against that baseline;
3. restore the smallest known-good behavior;
4. reapply only the necessary fix;
5. verify again before moving forward.

## Performance
Do not add heavy dependencies, unnecessary MCPs, or large client-side payloads merely for convenience. Prefer server-side operations, lazy loading, caching where safe, and existing project primitives.

## User instruction hierarchy
"Feu vert" authorizes execution, but does not authorize destructive changes, secret exposure, bypassing security controls, or changing protected Home assets. Ask only when authorization is genuinely required; otherwise execute safely and report evidence.
