# WASSAFRICA CTO guardrails

`cto-guardrails.sh` is a preventive static gate for the repository.

It blocks common regressions in:
- public WASSAFRICA branding;
- accidental client-side secrets/private keys;
- unsafe `pg_temp` in `SECURITY DEFINER` migrations;
- `/inbox` shell/route drift;
- accidental `tel:` fallback in the Internet calling runtime.

These checks are necessary but are **not** a substitute for real A→B browser/device tests, database negative tests, deployment verification, or production certification.
