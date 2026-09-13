#!/usr/bin/env bash
set -euo pipefail

fail() { echo "CTO GUARDRAIL FAILED: $1" >&2; exit 1; }

# 1) Canonical product/domain guard: legacy product naming must not leak into production-facing source.
if grep -RInE --exclude-dir=.git --exclude='cto-guardrails.sh' 'WhatsAfrica' . >/tmp/wassa_legacy_hits 2>/dev/null; then
  # Repository/history can legitimately contain the old repository name in metadata/docs.
  # Block only runtime/public HTML/JS/CSS and Vercel configuration.
  if grep -RInE --include='*.html' --include='*.js' --include='*.css' --include='vercel.json' 'WhatsAfrica' .; then
    fail "legacy product name found in runtime/public assets"
  fi
fi

# 2) No obvious client-side secret material.
if grep -RInE --include='*.html' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.jsx' \
  '(service_role|SUPABASE_SERVICE_ROLE_KEY|sk_live_[A-Za-z0-9]|-----BEGIN (RSA |EC )?PRIVATE KEY-----)' .; then
  fail "possible server secret/private key exposed in client source"
fi

# 3) SECURITY DEFINER SQL must not use pg_temp in search_path.
if grep -RInE --include='*.sql' 'SECURITY DEFINER' supabase/migrations 2>/dev/null | cut -d: -f1 | sort -u | while read -r f; do
  if grep -nE 'search_path[^\n]*pg_temp' "$f"; then
    echo "$f"; exit 1
  fi
done; then
  fail "SECURITY DEFINER migration contains pg_temp in search_path"
fi

# 4) Keep the inbox shell and route contract aligned.
test -f inbox-v30-shell.html || fail "missing inbox-v30-shell.html"
grep -Fq '"/inbox"' vercel.json || fail "missing /inbox route"
grep -Fq 'inbox-v30-shell.html' vercel.json || fail "/inbox is not wired to inbox-v30-shell.html"

# 5) Prevent accidental cellular dialer fallback in the direct-call runtime.
if grep -RInE --include='wa-direct-call.js' --include='wa-calls-v2.js' "window\.location[^;]*tel:|location\.href[^;]*tel:" .; then
  fail "cellular tel: fallback detected in WASSAFRICA calling runtime"
fi

echo "CTO GUARDRAILS: PASS"
