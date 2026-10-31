---
name: app-stabilization
description: Diagnose production defects, regressions, flaky builds, runtime failures, degraded UX and release-readiness issues. Use to stabilize existing applications without destructive rewrites or correction loops.
---

# Application Stabilization

## Objective
Restore predictable behavior and protect working functionality. Fix root causes, not symptoms. A stable known-good app is more valuable than a broad refactor with unverified benefits.

## Baseline before changes
- Identify production deployment, commit, branch, environment, recent releases and relevant runtime/build logs.
- Reproduce the issue on the exact route/device/state where possible.
- Compare current behavior with the last known-good release or commit.
- Inspect route rewrites, environment configuration, API contracts, database schema/RLS, assets, browser console and network failures.
- Determine blast radius and whether the issue is isolated, systemic or provider-dependent.

## Root-cause workflow
1. Write a concise failure statement with observable evidence.
2. Enumerate plausible causes and rank them by evidence, not intuition.
3. Trace the complete path: UI → route → API/function → auth → database/provider → response/render.
4. Identify the earliest failing boundary and verify it.
5. Create the smallest reversible fix on a dedicated branch.
6. Add a regression test that reproduces the original failure.
7. Run focused tests, then the broader release gates.
8. Inspect the full diff and verify unaffected neighboring journeys.
9. Preview and exercise the actual route at desktop/mobile sizes where browser tooling is available.
10. Deploy only after required gates and explicit release authorization; verify the deployment maps to the intended commit and observe the live flow.

## Stability gates
- Build, lint, typecheck and test outcomes are recorded with actual logs.
- Critical user journeys cover authenticated, anonymous, expired-session and permission-denied states as applicable.
- Network errors, slow providers, quota exhaustion, retries and partial failures have deterministic UI states.
- No newly introduced console errors, broken routes, missing assets, duplicate IDs or accessibility regressions.
- No unbounded requests, retry storms, duplicate mutations or avoidable cost spikes.
- Rollback target and steps are known for risky changes.

## Regression containment
If the change worsens production:
- stop further rollout;
- preserve logs and exact deployment/commit identifiers;
- roll back to the last verified known-good deployment when authorized and safe;
- isolate the first bad change;
- fix and test root cause before retrying.
Do not layer speculative patches or change unrelated surfaces.

## Release language
Use exact states: source changed, committed, checks running/passed/failed, preview available, preview tested, production READY, production route verified. Never collapse these into “done”.
