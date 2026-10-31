---
name: security-hardening
description: Threat-model, audit and harden application security across frontend, APIs, identity, databases, storage, AI agents, payments, webhooks and cloud deployment. Use for security work and before risky production changes.
---

# Security Hardening

## Threat-model first
Identify assets, trust boundaries, actors, entry points, sensitive data, abuse cases, blast radius and required controls. Prioritize exploitable risks and production exposure; do not inflate findings with theoretical low-impact issues.

## Required review domains
1. **Identity:** authentication lifecycle, MFA where appropriate, session rotation/expiry, OAuth state/PKCE, safe redirect allowlists and account recovery.
2. **Authorization:** server-side ownership checks, tenant isolation, role boundaries, object-level access and negative tests for other-user/anonymous access.
3. **Secrets:** least privilege, environment separation, rotation procedures, secret scanning, redacted logs; no service-role/provider secret in browser code.
4. **Input and output:** schema validation, parameterized SQL, output encoding, upload validation, file path safety and content-type enforcement.
5. **Web perimeter:** CSRF, CORS allowlists, CSP, security headers, cookies, open redirects, SSRF, request size/time limits and abuse/rate controls.
6. **Database/storage:** RLS, grants, policies, privileged functions, search_path, bucket visibility, signed URLs, retention and backup/restore.
7. **Payments:** authoritative server-side provider verification, signature validation, amount/currency/order matching, idempotency, replay defense and safe reconciliation.
8. **AI/agents:** prompt injection, untrusted retrieved content, tool authorization, data exfiltration, model output validation, cost/loop limits and audit logs.
9. **Supply chain:** dependency advisories, lockfile integrity, CI permissions, token scopes, build provenance and third-party scripts.
10. **Operations:** structured redacted logs, alerting, incident response, rollback and evidence preservation.

## Execution rules
- Inspect current implementation and official provider/platform docs before changing controls.
- Prefer defense-in-depth and minimal changes; never disable RLS, validation, signature checks or rate limits to make a test pass.
- Add negative tests for denied access, invalid signatures, replayed events, malformed payloads and cross-tenant access as applicable.
- Distinguish confirmed vulnerability from suspected risk and missing evidence.
- Do not run destructive scans, production exploit tests, credential rotation, firewall blocks or data changes without explicit authorization and a recovery plan.
- Do not expose secrets in reports; identify their location/category only.

## Severity
- Critical: active compromise, unauthenticated privileged access, payment forgery or broad sensitive-data exposure.
- High: exploitable authorization bypass, secret exposure, SSRF into privileged networks, webhook forgery or tenant escape.
- Medium: meaningful abuse, limited data exposure, weak controls requiring conditions.
- Low: defense-in-depth or low-impact hardening.
For each finding report evidence, affected route/component, impact, exploit preconditions, safe remediation and regression test.

## Done
A security fix is complete only when the root cause is corrected, relevant negative tests pass, adjacent controls remain intact, and deployment/runtime verification is stated separately from source-level review.
