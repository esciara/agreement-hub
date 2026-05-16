# Technical Feasibility

## Summary

The AI Clause Generator is technically buildable on the existing stack. The core
pattern — a new Express route that calls an AI provider SDK, structures the response
as JSON, and returns it to a React modal — is well-understood and low-risk in
isolation. Nothing in the PRD requires capabilities the stack fundamentally lacks.

However, two categories of risk make this harder than the surface area suggests.
First, the existing codebase has never handled an async, long-running HTTP call from
Express — all current routes are synchronous SQLite operations. Adding an AI route
exposes gaps in error propagation, request timeout, and frontend cancellation that the
current patterns don't demonstrate. These are solvable but are not free. Second, the
hardest single technical problem — getting the AI model to reliably return parseable
structured JSON — is provider-dependent, and the provider hasn't been chosen. That
decision gates the JSON strategy, the prompt design, and the testability of the
backend. Everything else is straightforward once those two issues are resolved.

---

## Findings

### Critical Gaps / Questions

**1. Express 4 does not automatically catch errors from async route handlers**

All existing route handlers in `backend/src/routes/contracts.ts` are synchronous.
`better-sqlite3` is a synchronous SQLite driver; every DB call completes inline
with no `await`. The global error handler (`app.use((err, req, res, next) => ...)`)
only catches errors that are passed to `next(err)` — it does NOT catch unhandled
promise rejections from async routes.

The AI call will be async. If an async route handler throws without an explicit
`try/catch` and a `next(err)` call, Express 4 silently swallows the error and the
client connection hangs. This is a well-documented Express 4 limitation that Express 5
resolves automatically (Express 5 is in beta; the project uses 4.18.3).

The new `/api/clauses/generate` route must wrap all async operations in `try/catch`
and call `next(err)` on failure — a pattern that does not exist in the current
codebase and is easy to get wrong under time pressure.

- **Why this matters:** A missing `try/catch` in the AI route causes silent failure:
  the client hangs, the user sees nothing, and the error is invisible in logs.
- **Clarifying question:** Should the team adopt an async wrapper utility
  (e.g., `express-async-errors` or a local `asyncHandler` wrapper) as part of this
  feature, so the pattern is established correctly for use cases 2-5?

---

**2. Structured JSON output from the LLM is not guaranteed without provider-specific features**

The PRD's rough approach calls for a JSON response with shape `{ text, explanation, risks[] }`.
Achieving this reliably requires one of:

- **JSON mode** (Anthropic: structured tool use or `claude-3` + system prompt enforcement;
  OpenAI: `response_format: { type: 'json_object' }`): more reliable but provider-specific
- **Prompt-instructed JSON + response parsing + validation**: works across providers but
  malformed output (truncated, trailing prose, invalid escaping) will cause `JSON.parse()`
  to throw

The provider is undecided (Open Question 3). Without knowing whether JSON mode is
available, the backend cannot be designed. If JSON mode is not used, the implementation
must handle malformed JSON responses — which requires a fallback strategy (retry?
degrade to plain-text display? return an error?) that the PRD doesn't specify.

- **Why this matters:** Malformed JSON from the model crashes the backend response
  handler. There's no retry logic or fallback in the current codebase. This is the
  hardest single implementation problem in the feature.
- **Clarifying question:** Has a provider been selected? If Anthropic is the default
  choice, can we use tool use / structured output to enforce the response schema, and
  what is the fallback if the model doesn't comply?

---

**3. No request timeout is configured on the Express server**

Node.js's default HTTP server has no request timeout (timeout = 0). Express 4 doesn't
add one. A hanging AI provider connection will hold the connection open indefinitely —
the user sees no response and the server resources are consumed until the provider
eventually times out on its side (which may be minutes).

The AI endpoint needs an explicit timeout (e.g., `server.timeout = 35000`) or a
per-route timeout middleware to fail fast and return a clean error to the user.

- **Why this matters:** Without a timeout, a single slow or hung provider call degrades
  the entire server. Under the 30-second latency goal, the server timeout should be set
  slightly above 30 seconds to avoid false timeouts while still protecting the server.
- **Clarifying question:** Should the timeout be set globally on the server (simpler)
  or per-route via middleware (more surgical)? Is there a maximum wait time the product
  wants to impose independently of the provider's timeout?

---

**4. The frontend API client has no fetch timeout or cancellation support**

`frontend/src/api.ts` uses bare `fetch()` with no `AbortController`. Existing calls
complete in milliseconds (SQLite reads). For a 30-second AI call, there's no mechanism
to:

- Cancel the request if the user closes the modal mid-generation
- Time out the client side independently of the server
- Unblock the React component on navigation away from the page

A dangling in-flight fetch against a component that has unmounted will trigger a React
state update on an unmounted component warning and may cause subtle bugs in React 19.

- **Why this matters:** The existing API pattern is sufficient for fast DB calls but
  breaks down for long-running requests. Adding `AbortController` support to the API
  client is straightforward but must be done before the AI endpoint is built.
- **Clarifying question:** Should `AbortController` support be added to the existing
  `api.ts` as part of this feature, or built as a one-off for the AI call only?

---

**5. No test infrastructure exists for either frontend or backend**

Neither `backend/package.json` nor `frontend/package.json` includes a test runner
(no `vitest`, `jest`, `mocha`). There are no test files, no test scripts, and no CI
configuration. The backend's `package.json` has no `test` script.

The AI endpoint needs tests for: provider success, missing API key, provider timeout,
malformed JSON response, and rate limit rejection (HTTP 429). Without a test runner,
none of these cases can be verified automatically, and CI cannot gate on them.

The PRD lists provider testing strategy as Open Question 9 ("mock or real key in CI?")
but framing it as open understates the dependency: the mock strategy affects how the
provider abstraction is implemented (dependency injection vs. module-level singleton),
which in turn affects the testability of every future AI use case.

- **Why this matters:** The "AI integration pattern" designation means this feature's
  architecture will be copied for use cases 2-5. A non-injectable, non-testable
  pattern compounds across the roadmap.
- **Clarifying question:** Is adding a test runner (vitest is the natural choice for
  this stack) in scope for this feature, or will it be a separate prerequisite task?

---

### Important Considerations

**6. Provider abstraction cannot be designed before provider selection**

The PRD says the backend should be "provider-agnostic enough to swap." Anthropic and
OpenAI differ in: message format, JSON mode invocation, error shapes, and token limit
enforcement. A meaningful abstraction requires knowing what it must abstract over.

The practical engineering approach is: choose a provider, build the integration
directly, then define the interface based on what you built — making swap a
well-defined constraint ("replace only this interface implementation"). Designing an
abstraction before knowing either provider leads to leaky abstractions or premature
generality.

- **Recommended approach:** Treat provider selection as a prerequisite. Implement
  against the chosen provider, define an interface (`AIProvider`) that captures only
  what the route handler needs, then verify the interface could be satisfied by a
  second provider. This is more tractable than designing for two providers in parallel.

---

**7. Prompt injection via the `context` field is unmitigated**

`context` is a free-form user-supplied string that will be embedded directly in an LLM
prompt. A user can enter text that attempts to override system instructions, extract
the system prompt, or change the output format in ways that break JSON parsing. This
is a realistic threat for a legal content generation tool where the output may be
acted upon.

The existing backend validates input length for other fields (`MAX_TEXT_LEN = 200`,
`MAX_CONTENT_LEN = 100_000`) but the PRD specifies no limit for `context`, and no
sanitization strategy.

- **Recommended approach:** Set a hard `context` length limit (500 characters is
  reasonable for v1) enforced on both frontend (UI counter) and backend (400 error).
  Additionally, isolate user input from system instructions in the prompt structure
  (use the model's system prompt for instructions, a user turn for the clause type,
  and a separate labeled section for the user-provided context) to reduce injection
  surface.

---

**8. `better-sqlite3` blocks the event loop; this becomes visible under concurrent AI requests**

The current SQLite driver is synchronous and blocks Node.js's event loop on every
query. For fast local SQLite reads this is acceptable. Under concurrent load during
an AI call (where the event loop is otherwise free during the await), any incoming
SQLite-touching request will still block. This is an existing architectural choice,
not something the AI feature introduces — but the AI feature makes it observable
for the first time because the server will now have long-lived async operations.

This is not a blocker for v1 (traffic is low) but should be documented as a known
constraint in the provider abstraction so it's not overlooked when use cases 2-5 add
volume.

---

**9. The 30-second latency goal will vary by provider, model, and output length**

The goal "generate a ready-to-use clause draft in under 30 seconds" is achievable
with current LLM APIs for typical clause lengths, but is not guaranteed. Factors
that affect it:

- Clause type: a boilerplate limitation of liability is faster than a detailed
  indemnification clause with extensive risk notes
- Provider load and geographic routing
- JSON mode overhead (structured output may add latency on some providers)
- Token output size (longer explanations and more risk notes = slower)

30 seconds should be achievable at p50 for typical clause types. p95 is less
certain without empirical testing. A hard frontend timeout at 30 seconds will cause
some requests to show an error even when the provider would have succeeded moments later.

---

**10. The feature sets a precedent as the "AI integration pattern" — architectural debt is expensive here**

The PRD explicitly states this feature "establishes the AI integration pattern (API key
management, prompt structure, streaming/non-streaming response) the rest of the roadmap
depends on." This is a consequential framing: design decisions made here (async error
handling, provider interface, prompt structure, response parsing) will be copied into
use cases 2-5.

The main risk is that time pressure on this feature produces a working but
non-composable implementation — one that handles the happy path but doesn't generalize
cleanly. The async error propagation gap (Finding 1) and the absence of a testable
provider interface (Finding 5) are the two patterns most likely to create future debt
if not addressed now.

---

### Observations

**11. The stack itself presents no fundamental obstacles**

React 19 + Vite 8, Express 4 + TypeScript, and SQLite are all capable of supporting
this feature. The AI SDK installation (e.g., `@anthropic-ai/sdk`) is a straightforward
`npm install`. The Vite dev proxy (`/api` → `http://localhost:3001`) is already
configured and will route AI calls correctly. WAL mode is already enabled on SQLite,
which is the right default. The existing routing and component patterns in the frontend
are clean and easily extended.

**12. Non-streaming is the right call for v1, but makes loading UX more important**

Without streaming, the user waits up to 30 seconds for the response to appear all at
once. This makes the loading state experience more critical than it would be for a
streaming implementation where users see progressive output. A spinner is the minimum;
a progress indicator or estimated wait time is better. The existing frontend loading
patterns (simple `setLoading(true)`) are adequate for fast operations and need
deliberate design for a 30-second wait.

**13. No mechanism exists to detect a missing API key at startup**

The PRD says "error early if missing" for the API key. The backend currently reads
configuration from environment variables only at runtime (no startup validation). A
missing `ANTHROPIC_API_KEY` (or equivalent) won't be discovered until the first AI
request is made — potentially by a user, not during deployment. An explicit startup
check (`if (!process.env.ANTHROPIC_API_KEY) { console.error(...); process.exit(1); }`)
should be considered, or at minimum the endpoint should return a 503 (service
unavailable) rather than a 500 when the key is absent.

**14. Privacy: contract content may be sent to a third-party provider**

Scenario 2 describes a user generating a clause based on context from an existing
contract. If the `context` field can contain contract text (excerpts, party names,
deal terms), that content is sent to the AI provider. For legal-sensitive customers
or enterprise deployments, this may violate data residency requirements or create
confidentiality concerns. The PRD doesn't address this. A one-sentence position
("we accept this risk for v1" or "users should not include confidential contract
text in the context field") would prevent a last-minute escalation at launch.

---

## Confidence Assessment

**Medium-High.** The feature is technically feasible on this stack with no architectural
changes. The implementation path is clear: new backend route, SDK integration, structured
JSON response, React modal component. Nothing in the PRD requires capabilities the stack
lacks.

The rating is not High because three unresolved gaps require decisions before
implementation can begin in earnest:

1. **Provider choice** (gates JSON mode strategy, error shape handling, and
   testability decisions)
2. **Async error handling pattern** (must be established before the AI route is
   written, or it becomes a silent failure source)
3. **Test infrastructure** (required before the AI endpoint can be validated and
   will affect how the provider interface is designed)

Resolving these three would bring confidence to High. The remaining findings are
implementation details that a competent engineer can address during the build.
