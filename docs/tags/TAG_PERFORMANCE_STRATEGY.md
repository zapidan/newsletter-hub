# Tag Performance Strategy

> **Document status:** Phase 1 & 2 implemented — Phase 3 rollout prepared (dev/prod flags)  
> **Author:** Engineering  
> **Scope:** Tag querying, tag-filtered newsletter fetching, tags page load  
> **Does NOT cover:** source groups, reading queue, search

---

## Executive Summary

The tag system has three independent performance bottlenecks, each with a clear root cause in
the application code. They are ranked here by observed user impact:

| # | Bottleneck | Location | Symptom | Status |
|---|-----------|----------|---------|--------|
| 1 | N+1 × 2 in tag usage stats | tagApi.getTagUsageStats() | Tags page times out with ≥10 tags | ✅ Fixed in Phase 1 |
| 2 | Client-side tag intersection | newsletterApi.getByTags() | Tag filtering returns slowly or incorrectly paginates | ✅ Fixed in Phase 1 |
| 3 | PostgREST LATERAL join per row | buildNewsletterQuery + includeTags | Every inbox load pays 75–165 ms for tag embedding | ✅ Fixed in Phase 2; Phase 3 adds server-side paging and gating |

**The fix does not require a schema change.** The N:M relational model (tags / newsletter_tags)
is correct and already has appropriate base indexes. Every bottleneck is a query pattern
problem — not a data model problem.

**Estimated total effort:** 6–9 working days across three phases.  
**Expected outcome:** Tags page < 300 ms, tag-filtered inbox < 200 ms, newsletter list < 20 ms.

---

## Phase 3 rollout (Phase 3 – Keyset pagination, counts, and rollout gating)

Phase 3 introduces cursor-based, keyset-like pagination on tag-filtered newsletter lists and a pathway for approximate per-user unread counts, all behind a controlled feature-flag rollout. Rollout is designed to be safe in development and easily rollbackable in production.

- Dev flag: VITE_PHASE3_DEV_ENABLED
- Prod flag: VITE_PHASE3_PROD_ENABLED (global for production)
- Rollback mechanism: flip off the prod flag to revert to Phase 2 instantly
- Note: No database schema changes are required for rollback. Phase 3 gates are implemented at the API layer; turning off the flags reverts behavior to Phase 2.

How it works at a glance
- Phase 3 gating is evaluated at runtime by the API layer.
- When Phase 3 is active, get_newsletters RPC is called with a cursor (p_cursor) and returns next_cursor for client paging.
- When Phase 3 is not active, the system behaves as Phase 2, with no cursor-based paging or next_cursor surface.

Dev/Prod gating details
- Development:
  - Enable Phase 3 by setting VITE_PHASE3_DEV_ENABLED=true.
  - All dev workflows can exercise cursor-based paging (pass cursor values and read next_cursor).
- Production:
  - Enable Phase 3 globally by setting VITE_PHASE3_PROD_ENABLED=true (and NODE_ENV=production).
  - Rollback is a simple toggle off: VITE_PHASE3_PROD_ENABLED=false.

DB considerations and rollback
- The core database function get_newsletters already supports p_cursor and returns next_cursor. Phase 3 gating does not require a rollback of the function when turning the flag off; the API will simply stop passing p_cursor and rely on the Phase 2 path.
- If you ever need to revert the function itself (extremely rare in a flag-based rollout), you can revert the migration that introduced the Phase 3 changes or restore the previous function signature, but it’s not necessary for flag-based rollback.

---

## Phase 3: What’s in scope for this PR

- Introduce feature flags for Phase 3 as dev/prod toggles and a runtime gate.
- Gate Phase 3 at the Newsletter API layer (getAll and getByTags) so Phase 3 is opt-in.
- Extend the Newsletter API to pass p_cursor when Phase 3 is active and surface nextCursor in the API response.
- Ensure Phase 2 behavior remains the fallback when Phase 3 is disabled.
- Update documentation to reflect the rollout strategy and rollback steps.
- Add tests to exercise Phase 3 gating in dev and prod, and ensure proper fallback when gates are off.

Files touched (overview)
- Code:
  - newsletterHub/src/common/config/featureFlags.ts
  - newsletterHub/src/common/api/newsletterApi.ts
  - newsletterHub/src/common/api/newsletterApi.ts (getAll path wiring)
  - newsletterHub/docs/tags/TAG_PERFORMANCE_STRATEGY.md
- Documentation:
  - docs/tags/TAG_PERFORMANCE_STRATEGY.md (Phase 3 rollout section)
- Tests:
  - newsletterHub/src/common/api/__tests__/newsletterApi.test.ts (Phase 3 gating tests and RPC expectations)

Notes
- Caching remains skipped per your instruction.
- Phase 3 gating is implemented in a minimal, safe way to allow quick rollback in prod without needing to redeploy code.

---

## Rollout and Operations Guidance

- Local development
  - Set VITE_PHASE3_DEV_ENABLED=true in your .env.local or your dev environment.
  - Run dev server and exercise Phase 3 paging endpoints.
- Production deployment
  - Deploy with VITE_PHASE3_PROD_ENABLED=true in the production environment and NODE_ENV=production to enable Phase 3 globally.
  - To rollback, flip VITE_PHASE3_PROD_ENABLED to false (or remove it) and redeploy if necessary or simply restart services with the flag off.
- Monitoring
  - Observe latency for tag-filtered list endpoints under Phase 3.
  - Validate nextCursor is being produced and consumed by the client.
  - Ensure that turning off the prod flag immediately reverts to Phase 2 behavior without side effects.

If you want me to tighten tests further (e.g., a dedicated Phase 3 gating test that toggles the prod/dev flags in CI), I can add those in a follow-up patch.
