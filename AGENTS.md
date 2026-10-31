# WASSAFRICA — Agent Operating Rules

These instructions apply to every coding agent working in this repository.

## Required engineering skills

When available in the active environment, apply these skills for engineering changes:
- `measure-dont-guess`: define observable acceptance criteria and verify claims with evidence.
- `poteto-principles`: prefer minimal reversible changes, root-cause fixes, and proof that behavior works.
- `dont-it-yourself`: inspect existing project primitives and dependencies before adding tools or code.
- `host-workspace-operator`: inspect first, use the narrowest safe file operation, and never claim unexecuted checks.
- Repository-specific workflow: `.claude/skills/wassafrica-safe-change/SKILL.md`.
- Full-stack quality/security/stabilization gates: `docs/FULL-STACK-BUILDER-STANDARD.md`.
- Portable specialist skill router: `.agents/skills/full-stack-builder/SKILL.md`.
- Security engineering and threat review: `.agents/skills/security-hardening/SKILL.md`.
- Production diagnosis, repair and anti-regression: `.agents/skills/app-stabilization/SKILL.md`.
- Payment provider and webhook safety: `.agents/skills/payment-integrations/SKILL.md`.

If a skill is unavailable, follow the equivalent rules below; do not claim that a missing skill was activated.

## Before editing

1. Read the relevant source, routing configuration, and applicable project rules.
2. Identify the canonical production surface from `CANONICAL-SURFACE-FREEZE-2026-10-07.md`; do not edit historical version files when a canonical implementation is routed.
3. State the exact intended change and list the adjacent behavior/assets that must remain unchanged.
4. Search for existing image URLs/assets before selecting or adding imagery. Do not reuse an image in a second homepage section unless explicitly requested.
5. Keep changes scoped. A request to change one component does not authorize redesigning unrelated sections.
6. Work on a dedicated branch and open a Pull Request. Do not push routine changes directly to `main`.

## Before merge

1. Review the complete diff, not only the intended lines.
2. Run relevant automated checks and inspect their actual output.
3. Treat new HTML integrity issues (duplicate IDs, missing image alt text, empty image sources, missing local image assets) as regressions.
4. Preserve existing canonical copy, route mappings, image assets, authentication boundaries, security headers, and business logic unless explicitly in scope.
5. For visual changes, verify the actual rendered page at desktop and mobile widths where browser tooling is available. If it is not available, say so.
6. Verify the production deployment separately. A commit, a successful CI run, a deployment URL, and a READY production deployment are different states.

## Definition of done

Report:
- changed files and why;
- branch / Pull Request / commit identifiers;
- checks actually run and their results;
- deployment status only when confirmed;
- any remaining unverified behavior.

Never say "fixed", "live", "tested", or "deployed" without evidence for that specific claim. If a check cannot run, name the blocker and leave the claim unverified.
