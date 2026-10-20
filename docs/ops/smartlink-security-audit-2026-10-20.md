# Smart Link security audit — 2026-10-20

Branch: cto/audit-smartlink-dep0169-2026-10-20
Scope: read-only review of API handlers; no production changes.

## Findings
- Inspected api/smartlink-import.js (559 lines; blob 4dff66e68a75281e9a4eb2bb1802d39e7ae6e57f) and api/demand-report.js (803 lines; blob 5017c0e6fe11be13c9d37f0c823adebc3113de90) from main.
- No direct `url.parse(` call, `require('url')`, or `from 'url'` import was found in either handler. This does not identify the source of the historical DEP0169 warning; a transitive dependency or another runtime path remains possible.
- In fetchSourcePage, redirects are followed manually and the target hostname is checked against a string-based denylist, but DNS A/AAAA resolution is not validated against private/reserved address ranges. Treat this as an SSRF hardening gap requiring a vetted IP/DNS validation approach and tests.
- fetchImportedImage rejects redirects but also relies on hostname string checks instead of validating resolved addresses.
- The AI import error response includes the raw exception message in a client-facing detail field. Review and replace with a stable public error code if compatibility tests confirm it is safe; preserve useful sanitized server-side diagnostics.

## Safe follow-up
1. Capture a current warning log with stack/metadata, or reproduce in a preview; do not infer the source from the route alone.
2. Inspect dependency manifests/lockfiles and search the full repository for deprecated URL parsing.
3. Prepare a minimal SSRF patch validating IPv4/IPv6 literal addresses and every resolved A/AAAA address, including each redirect target; reject loopback, private, link-local, multicast, unspecified and other non-public ranges. Use a vetted IP/CIDR library rather than an ad hoc partial matcher.
4. Add regression tests for public URLs, private IPv4/IPv6, IPv4-mapped IPv6, DNS resolving to private addresses, redirect-to-private, redirect loops, timeouts, content type and byte limits.
5. Ensure client responses do not expose raw internal exception details.
6. Run targeted tests/build and inspect preview before any merge.

## Safety status
No source code changed, no merge/deployment, no secret or payment operations, and no spend. This audit is not a claim that the warning or SSRF issue is fixed.