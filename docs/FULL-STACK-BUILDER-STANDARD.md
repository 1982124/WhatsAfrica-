# Full-Stack Builder — Quality, Security & Stabilization Standard

**Purpose:** Make every compatible coding agent work like a careful full-stack engineering team: inspect before editing, build the smallest safe change, prove behavior, prevent regressions, and leave a recoverable deployment.

This standard is stack-aware, not stack-prescriptive. Use the repository's existing framework and tools unless evidence supports a migration.

## 1. Mandatory engineering loop

1. **Discover:** read `AGENTS.md`, local agent rules, architecture, route map, package manifests and lockfiles, CI, deployment config, and the actual implementation.
2. **Baseline:** record current behavior, relevant tests, production health, and known-good UI/assets. Separate observed facts from assumptions.
3. **Plan:** define acceptance criteria, likely failure modes, scope boundaries, and adjacent behavior that must not change.
4. **Implement:** use a dedicated branch and minimal reversible diff. Reuse established project primitives; avoid unnecessary dependencies and parallel implementations.
5. **Test:** add or update tests for the behavior and the defect. Run the narrowest relevant tests first, then broader checks.
6. **Review:** inspect the entire diff for unrelated edits, security regressions, broken contracts, duplicated assets, and missing error states.
7. **Deploy safely:** use preview/staging when available; require appropriate checks before production. Keep rollback instructions for risky changes.
8. **Verify:** test the deployed route/API and the end-to-end flow, not just the build. Compare results against acceptance criteria.
9. **Report:** list changed files, evidence and commands/checks actually run, branch/PR/commit, deployment state if confirmed, remaining risks, and unverified paths.

Never claim a feature is fixed, secure, tested, certified, or deployed without evidence for that exact claim.

## 2. Architecture and implementation

- Follow the existing stack and conventions; don't migrate frameworks merely to match a preferred skill.
- Keep UI, domain logic, data access, and provider integrations separated at the project's appropriate level.
- Define and validate API input/output contracts; handle timeouts, retries, partial failures, and user-visible error states.
- Prefer explicit types and schemas at trust boundaries.
- Use pagination and bounded queries for potentially large collections; avoid N+1 requests and unbounded payloads.
- Make state-changing operations idempotent where retries or webhooks are possible.
- Add dependencies only when existing tools cannot meet the need. Pin versions and commit the lockfile.
- Preserve accessibility semantics, responsive behavior, canonical routes, analytics hooks, and approved visual assets.

## 3. Security baseline

Use OWASP guidance appropriate to the application and threat model. For every change, consider:

- **Identity and authorization:** enforce permissions server-side for every resource/action; test cross-user and cross-tenant access; authentication alone is not authorization.
- **Sessions and OAuth:** validate callback/redirect destinations; protect state/PKCE where applicable; handle expiry, revocation and sign-out.
- **Secrets:** never commit secrets or expose service-role/private keys to browsers; use platform environment variables and least privilege.
- **Input/output:** schema validation, safe output encoding, parameterized SQL, upload type/size limits, and safe file names.
- **Abuse controls:** rate limits and quotas for login, OTP, password reset, AI, uploads, and costly endpoints; avoid account-enumeration leaks.
- **Web security:** review CORS, CSRF where relevant, CSP/security headers, cookie flags, SSRF and open-redirect risks.
- **Data privacy:** minimize collection, restrict logs, redact tokens/PII, define retention and deletion behavior.
- **Dependencies and supply chain:** run available dependency/security audits; investigate high/critical findings rather than blindly upgrading.
- **Payments/webhooks:** verify provider signatures server-side, validate amounts/currency against trusted records, and enforce idempotency.
- **AI features:** treat user content and retrieved documents as untrusted; enforce tool permissions server-side; limit spend/output; protect secrets and private context; evaluate prompt injection and data leakage.
- **Database:** review grants, migrations, indexes, backups, and row-level access policies. Never disable access controls just to make a query work.

Security changes must include negative tests, not only successful-path tests.

## 4. Testing and anti-regression gates

Use the test layers that fit the repository:

- **Static:** formatter, linter, type checks, build, dependency/security scan.
- **Unit:** deterministic domain logic, validation, permissions and error handling.
- **Integration:** database/API/provider boundaries, transactions, retries and webhooks.
- **End-to-end:** critical user journeys from UI to backend/data/provider and visible result.
- **Regression:** reproduce the original defect and retain a test that fails before the fix when practical.
- **Visual/content integrity:** duplicate IDs, missing alt text, empty image sources, broken local assets, accidental repeated images, mobile/desktop layout where browser tooling is available.
- **Resilience:** timeouts, unavailable providers, invalid sessions, rate limits, network loss, retries and recovery.
- **AI evaluation:** representative success/failure cases, groundedness, refusal boundaries, tool-call correctness, latency and cost.

Do not invent a green test result when the required tool or environment is unavailable. State the blocker explicitly.

## 5. Data and migration safety

- Inspect schema, migrations, policies, triggers, functions, and consumers before changing a contract.
- Make migrations reviewable and reversible when feasible; document any irreversible step and backup/restore plan.
- Test authorization for owner, other user, anonymous, and privileged roles where relevant.
- Use transactions for multi-step invariants and unique constraints for concurrency-sensitive guarantees.
- Do not run destructive production changes without explicit authorization and a tested recovery plan.

## 6. Observability and incident recovery

- Emit structured, actionable logs without credentials, tokens, or unnecessary personal data.
- Track error rate, latency, saturation/cost, and important business-flow outcomes where available.
- Add health checks that distinguish dependency availability from full product readiness.
- Provide correlation IDs and safe diagnostic details without leaking internal secrets.
- For a regression: identify blast radius, stop/rollback safely, preserve evidence, fix root cause, add regression coverage, and verify recovery.

## 7. Definition of done

A change is done only when all applicable items are satisfied:

- [ ] Acceptance criteria are observable and met.
- [ ] Scope is minimal and the full diff has been reviewed.
- [ ] Relevant automated tests pass, or blockers are recorded.
- [ ] Security and authorization impact has been reviewed.
- [ ] Error and empty states are handled.
- [ ] No unrelated route, asset, business rule, or canonical surface regressed.
- [ ] Preview/production verification matches the change's risk.
- [ ] Rollback/recovery path is known for risky changes.
- [ ] The report separates verified behavior from assumptions and remaining gaps.

## 8. Skill and tool routing

Use specialist instructions when the corresponding capability is actually available in the current environment. Examples:

- Planning, test-driven development and systematic debugging: use an available Superpowers workflow or the equivalent plan/test/debug discipline.
- Supabase: read the installed Supabase skill and current documentation; review RLS, grants, auth claims, storage policies and privileged functions.
- Vercel: use the installed deployment/verification skills for builds, runtime logs, preview and production checks.
- AI on Vercel: use the AI SDK / AI Gateway skill only when it matches the application's existing architecture.
- Repository distribution: use repository-crafting skills only when publishing or distributing reusable agent instructions is in scope.
- Framework, database, payment, analytics and automation skills: select based on actual stack and requirement.

A skill is guidance, not proof of correctness. Validate its recommendations against the repository, current official documentation, tests, and observed runtime behavior. Never claim a plugin or skill is connected unless the environment confirms it.
