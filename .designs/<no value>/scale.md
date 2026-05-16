# Scalability Analysis

## Summary

The AI Clause Generator is architecturally well-suited for growth: the feature is entirely
stateless (no DB writes, ephemeral responses), I/O-bound (work happens at the Anthropic API,
not the Express process), and isolated from existing contracts CRUD (a provider outage
cannot take down the contracts list). The current Express/SQLite/Node.js stack can serve
this feature to hundreds of concurrent users without structural changes.

The one hard scaling constraint is external: **Anthropic API rate limits and cost**. At
10x current scale these are a mild inconvenience; at 100x they are a financial risk
requiring an explicit rate-limit decision; at 1000x they require queuing and tier upgrades.
Everything else — memory, CPU, disk, network, the Express event loop — is well within
comfortable margins until the Anthropic cost and rate-limit wall is reached. The PRD's
decision to defer rate limiting to v2 is the single most important scalability risk to flag.

---

## Analysis

### Key Considerations

- **No DB involvement in the hot path.** The generate endpoint does not read or write
  SQLite. The only DB activity is the existing contracts CRUD. AI requests are completely
  isolated: a slow Anthropic response does not block contract reads; a contracts DB issue
  does not affect clause generation.
- **Node.js async I/O absorbs concurrency well for I/O-bound workloads.** Each pending
  AI request is a suspended `await` on an Anthropic SDK promise — zero CPU, ~5–10 KB RAM.
  The event loop is free for other requests while waiting. A single Express process can
  hold hundreds of concurrent in-flight AI requests without CPU saturation.
- **Input is bounded.** `clause_type` is an enum (7 values); `context` is capped at 2,000
  characters (~500 tokens). Per-request token usage is predictable: ~800–1,500 input
  tokens + ~500–1,000 output tokens. No unbounded inputs that could cause cost spikes.
- **No session state and no user identity on the generate endpoint.** This simplifies
  horizontal scaling (any instance can serve any request) but removes the ability to
  enforce per-user rate limits without a shared store (Redis, Dolt, or a counter in
  SQLite).
- **The Anthropic SDK should be a singleton.** Initializing a new client per request
  wastes memory and breaks connection reuse. One instance at module load time is correct.
- **Cost is the primary scaling risk, not capacity.** At low volume, the Anthropic API
  can absorb any realistic demand from this app. The danger is unchecked spend, not
  infrastructure saturation.

---

### Options Explored

#### Option 1: No rate limiting, no queuing (PRD v1 default)

- **Description**: Ship exactly as designed. Single Express process, Anthropic SDK
  singleton, no throttle, no request queue, no caching.
- **Pros**: Zero additional implementation cost. Sufficient for a small user base (<50
  active users). Matches the PRD's explicit "no rate limiting in v1" position.
- **Cons**: Runaway spend risk if the feature is popular. A single user with a script
  could exhaust the Anthropic monthly budget in hours. No visibility into spend until
  the invoice arrives. Synthesis review flagged this explicitly as a financial risk.
- **Effort**: None (status quo)
- **Suitable up to**: ~50 daily active users generating ~5 clauses each (250 calls/day,
  ~15 calls/peak-hour). Cost: <$1/day at Claude Sonnet pricing.

#### Option 2: Simple per-session token-bucket rate limit (Recommended for v1)

- **Description**: Track generation count per session (using `req.session` or a
  lightweight in-memory map keyed by session ID or IP). Allow N generations per window
  (e.g., 10/hour per session). No shared state required — in-memory is fine for a
  single-instance deployment.
- **Pros**: Prevents runaway spend from a single user. Low implementation cost (~50
  lines). No external dependencies. Consistent with the API design leg's recommendation
  to "add a simple per-session throttle." Fails safely: throttled users see a 429 with
  a retry-after message, which is already specified in the error UX.
- **Cons**: In-memory counter is not shared across multiple instances (irrelevant until
  horizontal scaling). Session-based counting requires session middleware (check whether
  `/api/contracts` uses sessions today — if not, IP-based counting is the fallback).
  Does not prevent distributed abuse.
- **Effort**: Low (1–2 hours)
- **Suitable up to**: ~500 daily active users. Beyond this, move to a shared counter.

#### Option 3: Shared rate limit with Redis or SQLite counter

- **Description**: Store generation counts in a shared store (Redis or a lightweight
  SQLite table with TTL via `created_at`) to enforce limits across multiple Express
  instances.
- **Pros**: Correct at any scale. Required for horizontal scaling.
- **Cons**: Adds a dependency (Redis) or a new SQLite table (violates v1 no-DB-changes
  constraint for the AI feature, though a separate `rate_limits` table is defensible).
  Significantly more complexity for a feature that currently has no auth and may not need
  multi-instance deployment for years.
- **Effort**: Medium
- **Suitable for**: 1,000+ daily active users or multi-instance deployments.

---

#### Option A: No caching (PRD v1 default)

- **Description**: Every generate request hits the Anthropic API. No response caching.
- **Pros**: Simplest. Correct. No cache invalidation. Always returns fresh generation.
- **Cons**: Misses an easy optimization for the most common zero-context requests. A user
  who clicks "force_majeure" with no context gets an identical generation to the previous
  user who did the same — but pays full token cost.
- **Effort**: None
- **Suitable for**: v1.

#### Option B: In-memory cache for zero-context requests (Recommended for future, not v1)

- **Description**: Cache `ClauseResult` in a process-local `Map<ClauseType, CachedEntry>`
  where `CachedEntry = { result: ClauseResult, expiresAt: number }`. Only cache requests
  where `context` is absent or empty. TTL: 1 hour (or until model version changes).
  Cache size: at most 7 entries (one per `ClauseType`). On a cache hit, return immediately
  without an Anthropic call.
- **Pros**: Trivial implementation (~30 lines). Zero new dependencies. Captures the
  "I don't know what context to provide" use case (Carol scenario). Reduces cost for
  this segment of requests by 100%. No staleness risk: TTL is short, model output for
  no-context requests is stable.
- **Cons**: Shared process state (not safe for multi-instance without a shared cache).
  Cached responses may not match user expectations if the model was recently updated
  (mitigated by TTL and model version pinning).
- **Effort**: Low (add when request volume makes the cost visible)

#### Option C: Semantic or fuzzy caching

- **Description**: Cache results by similarity of the `context` field (e.g., via
  embedding distance). Cache hits for "semantically similar" contexts.
- **Pros**: Would dramatically increase cache hit rate beyond zero-context-only.
- **Cons**: Requires an embedding model (another API call), a vector store, and
  significant prompt engineering to ensure similar-context results are safe to reuse.
  The benefit over Option B is marginal for this use case: user contract contexts are
  highly specific (party names, deal specifics) and unlikely to have high semantic
  similarity across users.
- **Effort**: High
- **Verdict**: Not recommended at any point in the near roadmap.

---

#### Option I: Single Express process, no horizontal scaling (PRD v1)

- **Description**: One Node.js process. All requests handled by this process.
- **Pros**: Trivially operable. No orchestration complexity. Correct for v1 scale.
- **Cons**: Single point of failure. Cannot scale beyond ~10K concurrent connections
  (practical limit of one Node.js process). In-memory rate limit counters are not
  shared.
- **Effort**: None
- **Suitable up to**: ~1,000 daily active users generating clauses concurrently.

#### Option II: Node.js cluster (multi-process, single machine)

- **Description**: Use Node.js `cluster` module or PM2 with `cluster` mode to fork
  one process per CPU core. Shared TCP port, OS distributes incoming connections.
- **Pros**: No infrastructure changes. Multiplies throughput by number of cores. In-memory
  rate limit counters would need to move to a shared store (Redis or SQLite).
- **Cons**: Requires a shared session/rate-limit store. Memory use multiplied by core
  count. Adds operational complexity.
- **Effort**: Low (1 day to add PM2 cluster config)
- **Suitable for**: ~10x traffic increase without changing hosting.

---

### Recommendation

**For v1**: Ship with Option 1 (no queuing) but upgrade to Option 2 (per-session rate
limit) immediately. The implementation cost is ~2 hours; the financial protection is
significant. Add Option A (no caching). Keep a single Express process.

**When 100x traffic arrives**: Add a shared rate limit counter (Option 3), evaluate
in-memory caching for zero-context requests (Option B), and consider PM2 cluster mode
(Option II).

**The two implementation actions to do in v1, not defer:**

1. **Rate limit**: 10 generations/hour per session or IP. 429 response already specified
   in error UX. Prevents the #1 financial risk.
2. **Spend observability**: Log per-request token counts and estimated cost. A single
   log line per request (`clause_type`, `input_tokens`, `output_tokens`, `latency_ms`,
   `error` if any) costs nothing and makes the first cost-spike incident survivable.

---

## Scale Projections

| Scale | Daily Users | Peak Gen/Hour | Approx Daily Cost | Risk | Action Needed |
|-------|-------------|---------------|-------------------|------|---------------|
| Baseline (v1) | 10–50 | ~5 | <$0.50 | Low | None |
| 10x | 100–500 | ~50 | <$5 | Low | Monitor spend |
| 100x | 1,000–5,000 | ~500 | $5–50 | Medium | Rate limit, tier upgrade |
| 1000x | 10,000+ | ~5,000 | $50–500+ | High | Queue, cache, horizontal scale |

*Cost estimate: Claude Sonnet 4.6, ~1,200 input tokens + ~800 output tokens per call,
at current Anthropic pricing. Actual cost depends on model version and tier.*

---

## Constraints Identified

- **Anthropic API rate limits are the primary hard constraint.** Tier-dependent. Default
  (Tier 1) limits: ~2,000 requests/day or ~40,000 input tokens/min depending on model.
  These limits can be hit by a single power user generating clauses in a loop. Rate
  limiting on the backend side is the correct mitigation — it makes the API limit
  unreachable in normal use.
- **SQLite is fine for this feature at any realistic scale.** The generate endpoint
  makes zero DB calls. SQLite's single-writer constraint is irrelevant. Contracts
  CRUD scalability is a separate question, unaffected by the AI feature.
- **The 2,000-character context cap is both a correctness and a cost constraint.** It
  caps prompt injection surface and keeps per-call token costs predictable. Do not
  remove this cap.
- **No streaming in v1 means a single HTTP connection is held open for up to 25 seconds.**
  At 100 concurrent users each generating a clause, that is 100 live connections held
  for ~10–25s each. Node.js handles this with zero blocking (async I/O), but upstream
  load balancers (if any) must be configured with timeouts >25s. This is a deployment
  constraint, not a code constraint.
- **The Anthropic SDK client must be a module-level singleton.** If instantiated per
  request, connection overhead alone would add ~200–500ms latency. Initialize once at
  module load (or lazily on first call with a module-level variable).
- **No horizontal scaling without a shared rate-limit store.** In-memory per-session
  counters work correctly only when all requests for a session hit the same process.
  This is true for a single-process deployment. Multi-instance deployments require
  moving rate-limit state to Redis or SQLite.

---

## Open Questions

1. **What Anthropic API tier is the operator on?** Tier 1 limits may be hit at 100x
   scale. If the operator is already on a higher tier, the financial risk window shifts
   outward. This should be confirmed before skipping rate limiting.

2. **Is there a monthly AI budget cap?** If so, document it. The rate limit N value
   (Option 2) should be calibrated against this budget. Example: budget $100/month →
   ~10,000 calls/month at current pricing → ~330 calls/day → rate limit to prevent
   exceeding this in a single day.

3. **Will the generate endpoint share auth middleware with `/api/contracts`?** The API
   design leg flagged that no auth middleware appears to exist today. Without auth, rate
   limiting by session ID is impossible — IP-based throttling is the fallback. An
   unauthenticated endpoint is also a financial risk (any internet user can generate
   clauses). This decision is upstream of the rate limit implementation.

4. **What is the acceptable latency under load?** The PRD specifies "<30 seconds" as a
   success criterion. At high concurrency, Anthropic API latency may increase (provider-
   side queuing). If 50 users simultaneously generate clauses, each may experience >30s
   latency even if the backend is healthy. Is there a "queue depth" at which the backend
   should return a 503 ("too busy, try again") instead of waiting for the Anthropic
   response? This behavior should be defined.

5. **Observability ownership**: Who receives cost-spike alerts? Who can disable the
   feature (flip an env var, toggle a flag) without a code deployment if costs spike?
   These are operational, not implementation, questions — but they must be answered
   before the feature is live for real users.

---

## Integration Points

- **API & Interface design leg** (`api.md`): The 2,000-character context cap, the 25s
  backend timeout (via `AbortController`), and the Anthropic SDK singleton are all
  scalability constraints that must be reflected in the implementation. The error codes
  (503 for rate limit, 503 for provider unavailable) are already specified and align with
  graceful degradation under load.
- **Data model leg** (`data.md`): The "no persistence" constraint is a scalability
  asset: the generate endpoint has no DB hot path. If persistence is added in use case #5
  (Clause Library), the write path will serialize in SQLite — a new scalability surface
  to analyze at that time.
- **Implementation**: Rate limiting (Option 2 above) should be implemented as a
  middleware applied specifically to `POST /api/clauses/generate`, not globally. This
  isolates the throttle logic and makes it easy to tune independently.
- **Use cases #2–#5**: Each subsequent AI use case will add request volume. The rate
  limit, caching strategy, and Anthropic tier decision made for use case #1 will be
  inherited or overridden by each subsequent use case. Designing the rate limit as a
  reusable middleware (configurable N per route) avoids duplicating throttle logic.
- **Frontend**: Streaming (not in scope for v1) would improve perceived latency
  significantly at scale — users see partial output instead of a blank spinner. Flagging
  this here for the use case #1 retrospective: if the "<30s" goal is missed under load,
  streaming is the right fix, not a higher backend timeout.
