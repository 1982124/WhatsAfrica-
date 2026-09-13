# WASSAFRICA — CTO guardrails

## Non-negotiable gates

1. **Truth gate** — never mark production certified without deployment evidence and real end-to-end proof.
2. **Identity gate** — public/runtime assets use WASSAFRICA, not the legacy product name.
3. **Secret gate** — no service-role keys, private keys, or server credentials in client assets.
4. **Database gate** — RLS remains the security boundary; `SECURITY DEFINER` functions require controlled execution privileges and a hardened `search_path`.
5. **Route gate** — `/inbox` remains aligned with the v30 shell and its runtime contract.
6. **Calling gate** — Internet calling must not silently fall back to the cellular `tel:` dialer.
7. **Ownership gate** — client-provided IDs never replace database-side authorization/ownership checks.
8. **Isolation gate** — A user must not read/write another user's private conversations, call signaling, commerce records, or private media merely by knowing an ID.
9. **Payment gate** — browser/UI state never proves payment success; only trusted server/partner confirmation does.
10. **Subscription gate** — expired businesses disappear from public Marketplace visibility without destructive deletion; renewal restores visibility.
11. **Abuse gate** — rate limits, upload limits, enumeration resistance and negative authorization tests are required before certification.
12. **Release gate** — CI green is necessary, never sufficient. Vercel deployment and browser/device tests remain separate gates.

## Certification boundary

**Code → CI → Deployment → route réelle → action réelle → données persistées → sécurité → résultat → reconnexion → absence de régression → preuve documentée.**

A static guardrail pass does not certify messaging, calls, payments, commerce, or production.
