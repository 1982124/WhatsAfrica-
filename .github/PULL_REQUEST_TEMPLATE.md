## Change summary
- [ ] The change is limited to the requested scope.
- [ ] Canonical routes and existing assets are preserved unless explicitly in scope.
- [ ] Homepage image sources were checked against the rest of the homepage; no unintended reuse was introduced.
- [ ] The full diff was reviewed for unrelated changes.

## Verification
- [ ] Run the existing regression, fallback, and release gates.
- [ ] For HTML changes, run `python3 scripts/wassafrica-regression-diff.py <base-sha> <head-sha>`.
- [ ] For JavaScript changes, run the applicable `node --check` and behavior tests.
- [ ] For visual changes, inspect the rendered public route at desktop and mobile sizes when browser tooling is available.
- [ ] Production deployment state is reported separately from source/CI status.

## Evidence and remaining risks
- Checks run and results:
- Browser / production checks:
- Known unverified items:
