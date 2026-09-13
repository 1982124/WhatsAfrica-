#!/usr/bin/env bash
set -euo pipefail
fail(){ echo "CTO GUARDRAIL FAILED: $1" >&2; exit 1; }
if grep -RInE --include='*.html' --include='*.js' --include='*.css' --include='vercel.json' 'WhatsAfrica' . 2>/dev/null; then fail "legacy product name found in runtime/public assets"; fi
if grep -RInE --include='*.html' --include='*.js' --include='*.ts' --include='*.tsx' --include='*.jsx' '(service_role|SUPABASE_SERVICE_ROLE_KEY|sk_live_[A-Za-z0-9]|-----BEGIN (RSA |EC )?PRIVATE KEY-----)' . 2>/dev/null; then fail "possible client secret/private key"; fi
while IFS= read -r f; do if grep -nE 'search_path[^\n]*pg_temp' "$f" >/dev/null 2>&1; then fail "pg_temp in SECURITY DEFINER search_path: $f"; fi; done < <(grep -RIl --include='*.sql' 'SECURITY DEFINER' supabase/migrations 2>/dev/null || true)
test -f inbox-v30-shell.html || fail "missing inbox-v30-shell.html"
grep -Fq '"/inbox"' vercel.json || fail "missing /inbox route"
grep -Fq 'inbox-v30-shell.html' vercel.json || fail "/inbox route drift"
if grep -RInE --include='wa-direct-call.js' --include='wa-calls-v2.js' 'window\.location[^;]*tel:|location\.href[^;]*tel:' . 2>/dev/null; then fail "cellular tel fallback"; fi
echo "CTO GUARDRAILS: PASS"
