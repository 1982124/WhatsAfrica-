# WASSAFRICA — Design system 2026

## Product decision

WASSAFRICA should feel like a confident African digital-commerce network: warm, grounded, contemporary, readable on low-cost Android phones, and trustworthy enough for business. It must not look like a generic SaaS dashboard or imitate one competitor.

The design system is a shared foundation across the public home, Market, business vitrine, Smart Link builder, and design settings. A creator's own brand may vary inside their storefront; WASSAFRICA's product chrome remains recognizable.

## Brand palette

| Role | Token | Value | Use |
|---|---|---|---|
| Primary | Forest | `#173D2D` | Brand, primary navigation, strong hero surfaces |
| Secondary | Leaf | `#245941` | Hover, secondary hero surface, supporting actions |
| Action / highlight | Savanna gold | `#E9A825` | Primary CTA on dark surfaces, focus indicator, important highlights |
| Warm accent | Terracotta | `#C85A32` | Occasional editorial accent, not for every button |
| Main background | Shea cream | `#FBF7EF` | Public pages and light workspaces |
| Surface | White | `#FFFFFF` | Forms, product surfaces, cards |
| Text | Ink | `#18231E` | Main copy |
| Muted text | Moss grey | `#65726B` | Secondary labels and helper text |
| Border | Mist green | `#DFE6E1` | Quiet dividers and input borders |

### Rules

- Green is the identity colour; gold is the action colour. Do not use bright green as a second competing primary.
- Cream is a background, not a card colour for every element. Keep product imagery visually dominant.
- Terracotta is a restrained editorial accent. Avoid pan-African flag clichés and avoid using every colour in every viewport.
- Do not use purple-blue gradients, decorative blobs, or glass effects as a default.
- Dark product workspaces may stay dark, but must use the same forest/gold identity and readable contrast.
- Product owners can select storefront themes. A theme changes the storefront's expression, not the WASSAFRICA navigation, trust cues, or interaction conventions.

## Typography and layout

- Use the system sans-serif stack for interface controls and dense product information; use a restrained editorial serif for selected marketing headlines.
- Keep long copy at a readable line length. Use sentence case and concrete labels.
- Establish one primary action per screen; secondary actions must be visually quieter.
- Use an 8px spacing rhythm, 12–16px control radii, and larger radii only for hero/feature surfaces.
- Product cards must prioritize the real image/video, title, price, availability, and next action. Avoid decorative badges that repeat information.

## Interaction and accessibility

- Every keyboard-focusable control has a visible `:focus-visible` outline using the gold token.
- Do not rely on colour alone for error, success, selected, or disabled states.
- Buttons and fields must have clear hover, focus, disabled, loading, empty, and error states where the flow needs them.
- Mobile first: no horizontal page overflow at 320px; targets are comfortable to tap; forms use at least 16px text on narrow screens.
- Respect reduced-motion preferences and preserve semantic headings, labels, and keyboard order.
- Prefer performance-friendly CSS over large animation packages, and optimize product media for mobile networks.

## Competitive lessons (not imitation)

- Selar's storefront work demonstrates that identity is more than recolouring the same template: page structure and personality should match the seller's work.
- Paystack Commerce demonstrates the importance of product media, variants, brand colours, and direct customer conversation.
- Flutterwave Store emphasizes a fast setup and practical mobile order management.
- WASSAFRICA's differentiator should be the connected journey: Smart Link → discovery → conversation → lead/order → payment/service, with one consistent visual language.

## Rollout and verification

This first pass aligns the shared brand tokens on the public home, Market, vitrine, Smart Link builder, and design settings. It is a foundation, not a claim that every route is fully redesigned or accessibility-certified.

Before production promotion:
1. Review all five pages at 320px, 360px, tablet, and desktop widths.
2. Check contrast for all button/text combinations and all theme variants.
3. Exercise loading, empty, error, and success states for forms and product lists.
4. Verify product photos/videos and existing create/share flows still work.
5. Confirm preview and production deployments separately; never treat a successful preview build as a production release.


## Contrast notes for implementation

Calculated WCAG contrast ratios for the core tokens:
- White on forest: 12.06:1 (passes WCAG AA and AAA for normal text).
- Savanna gold on forest: 5.79:1 (passes WCAG AA for normal text).
- Ink on cream: 15.14:1 (passes WCAG AA and AAA for normal text).
- Muted moss on cream: 4.71:1 (passes WCAG AA for normal text, with limited margin).
- Muted moss on white: 5.03:1 (passes WCAG AA for normal text).
- White on terracotta: 4.23:1 (does not meet 4.5:1 for normal text). Do not use white normal-sized text on terracotta; use ink text on terracotta or reserve terracotta for non-text accents until a darker accessible variant is selected.

These token-level calculations do not certify every component or theme combination. Audit the actual foreground/background pair used by every interactive state before release.
