# WASSAFRICA — Rollback & Recovery Runbook

## Production invariant
A release is not complete unless the previous READY deployment is identified, the database migration is committed, the rollback path is known, and critical journeys are re-tested after recovery.

## Rollback order
1. Contain the affected feature.
2. Return the Vercel production alias to the last known-good READY deployment, or redeploy the last known-good commit.
3. Do not blindly reverse a database migration. Prefer a forward corrective migration when data may have been written under the new schema.
4. Restore data only from an appropriate backup/snapshot after impact analysis.
5. Verify auth, Smart Links, messaging, AI credits, storage, and public routes.
6. Reopen only after smoke tests pass.

## AI Studio recovery invariant
- exactly one generation debit is allowed for a generation id;
- the debit amount is derived server-side from the stored generation configuration;
- the plan is resolved server-side;
- failed generations can be refunded once;
- the client cannot choose the credit amount;
- concurrent calls cannot create a second debit for the same generation id.

## Recovery procedure
P0/security: CONTAIN -> ROLLBACK APP -> FREEZE AFFECTED WRITE PATH -> RECONCILE DATA -> PATCH -> PREVIEW -> E2E -> PRODUCTION.

AI credit incident:
1. Stop new AI generation requests.
2. Inspect ai_generations and ai_credit_transactions.
3. Reconcile every generation debit with its generation row.
4. Reconcile every refund with a failed/error generation.
5. Restore only unjustified debits.
6. Re-enable generation after atomic debit/refund tests pass.

## Last-known-good
Record after every production release:
- Commit SHA
- Vercel deployment ID
- Supabase migration version
- UTC timestamp
- Smoke-test result

## Recovery verification
- unauthenticated AI request => 401
- free plan => premium gate
- premium/pro/business with zero credits => exhausted
- sufficient credits => exactly one debit
- n=3 => exactly 3 credits deducted
- failed generation => exactly 3 credits restored
- repeated refund => no additional credit
- concurrent debit attempts => no double-spend
- Smart Link publication remains functional

## Evidence required for PASS
ROLLBACK_READY=YES
RECOVERY_PATH=VERIFIED
DATA_RECONCILIATION=PASS
POST_ROLLBACK_SMOKE=PASS
