---
name: wassafrica-safe-change
description: Use for any change to WASSAFRICA source code, homepage, images, routes, UI, API, Supabase integration, tests, or deployment. Enforces minimal diffs, anti-regression checks, canonical-surface protection, and evidence-based completion reports.
---

# WASSAFRICA Safe Change

## Mission

Deliver only the requested change while preserving known-good behavior. Optimize for correctness, reversibility, and verifiable production outcomes—not for the number of files changed.

## Skill routing

When available, apply these complementary engineering skills:
- `measure-dont-guess` for measurable acceptance criteria and evidence.
- `poteto-principles` for root-cause analysis, minimal changes, and proof of behavior.
- `dont-it-yourself` before adding new packages, helpers, or parallel implementations.
- `host-workspace-operator` for safe repository inspection and mutations.

Read `AGENTS.md` and `.claude/rules/wassafrica-cto.md` as project-level constraints. This skill does not claim to install or activate external plugins; it records the project's required workflow for compatible agents.

## Required workflow

### 1. Inspect and baseline
- Read the current implementation and the relevant route mapping in `vercel.json`.
- Read `CANONICAL-SURFACE-FREEZE-2026-10-07.md` before changing a public surface.
- Search the entire affected page for existing image URLs and assets.
- Record the requested behavior and explicit non-goals.
- If the current state or deployment cannot be inspected, state that limitation instead of guessing.

### 2. Plan the smallest change
- Change only files needed for the request.
- Preserve copy, links, analytics hooks, ARIA relationships, responsive rules, and canonical asset mappings unless explicitly in scope.
- Never replace real/canonical imagery with generated, generic, placeholder, or already-reused images without authorization.
- For image requests, compare normalized source URLs across the whole homepage before choosing new assets; confirm each requested section has its own intended image.

### 3. Implement on a branch
- Create a dedicated branch; do not make routine edits directly on `main`.
- Avoid new dependencies unless the existing repository cannot meet the requirement with its current tools.
- Never create a second route or implementation for a capability already mapped to a canonical production surface.
- Keep security controls, RLS, authorization, payment confirmation, and privacy boundaries intact.

### 4. Verify before asking for merge
- Inspect the full diff for accidental changes and unrelated rewrites.
- Run the relevant workflow and tests; report only checks that actually ran.
- For HTML, check duplicate IDs, image alt text, non-empty image sources, and missing local assets. The regression gate compares against the base commit so existing legacy findings are not misreported as newly introduced regressions.
- For JavaScript, run syntax checks and focused behavior tests where available.
- For visual work, use a real browser at desktop and mobile sizes when available; do not substitute source inspection for browser verification.
- Test the public route, not only a versioned HTML file.
- Do not merge if a new regression is detected or required checks are still pending/failing.

### 5. Verify deployment and report
- Distinguish implementation, commit, CI pass, deployment created, deployment READY, and production behavior verified.
- Confirm the deployment corresponds to the intended commit before claiming the change is live.
- Report commit/PR, files changed, test output, deployment evidence, and any remaining gaps.

## Stop conditions

Stop and report the exact blocker if repository access, test execution, browser inspection, or deployment status is unavailable. Do not infer success from a tool call that only wrote source code.
