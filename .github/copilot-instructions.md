# WASSAFRICA Copilot Instructions

Before making repository changes, read `/AGENTS.md`, `/.claude/rules/wassafrica-cto.md`, `/.claude/skills/wassafrica-safe-change/SKILL.md`, and the relevant `.agents/skills/*/SKILL.md` specialist guide.

Mandatory:
- Work in a branch and propose a Pull Request; do not routinely write directly to `main`.
- Inspect the canonical route and current implementation before editing.
- Make the smallest change that satisfies the request; preserve unrelated code, copy, routes, styles, and canonical assets.
- Search homepage image URLs before choosing photos; avoid repeating an image in another section unless explicitly requested.
- Review the complete diff and run applicable checks before merge.
- Do not claim browser verification or production deployment unless the corresponding evidence exists.
- Route work through the full-stack, security, stabilization, and payment skills when relevant; use only skills actually available in the environment.
- Never weaken security, authorization, RLS, payment verification, or privacy controls to make tests pass.
