# Smart Link V3 — test gate

- Parallel presentation page: `smartlink-free-v3.html`
- Adaptive Brand Engine: `wa-smartlink-brand-engine-v1.js`
- Production routing unchanged: `/smartlink` still points to `smartlink-free-v2.html`.
- Public slug routing unchanged: `/:slug` still points to `smartlink-public-v4.html`.
- No database, schema or RLS changes.

## Manual test matrix
1. Open `smartlink-free-v3.html`.
2. Verify hero, responsive layout and CTA links.
3. Test Bordeaux, Terracotta, Bleu profond, Indigo, Olive and Terre cuite.
4. Verify palette, hero and contrast values update without console errors.
5. Verify `/smartlink` remains unchanged before any production routing decision.
