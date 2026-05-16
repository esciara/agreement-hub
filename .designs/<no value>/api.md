# API & Interface Design

## Summary

The AI Clause Generator adds a single new REST endpoint to an otherwise standard Express/TypeScript CRUD backend, plus a modal trigger in the React/Vite frontend. The backend surface is deliberately minimal: one `POST /api/clauses/generate` route, one environment variable for the provider key, and one TypeScript module that isolates all AI provider coupling. The frontend adds one exported async function to the existing `api.ts` module and one modal component triggered from the contract detail/edit views — no new routes, no new pages.

The most consequential interface decisions are: (1) the `risks[]` item schema, which is the primary disagreement surface between frontend and backend if left unresolved; (2) the AI provider abstraction boundary — whether it is a formal TypeScript interface or simple module isolation; and (3) the error UX contract, which all four prior analysis legs identified as unspecified. This document proposes concrete answers to each.

## Analysis

### Key Considerations

- **Consistency with existing patterns.** The contracts router (`src/routes/contracts.ts`) validates inputs at the route level, returns `{ error: string }` on 400s, and uses plain `res.status(N).json(...)`. The clause generator must follow the same pattern — no new response envelope, no custom error shapes.
- **API key must never reach the browser.** All AI calls go through the backend. The frontend's `api.ts` calls `/api/clauses/generate`; that route calls the AI provider. The key is read from `process.env.ANTHROPIC_API_KEY` (or equivalent) and never serialized into a response.
- **Provider choice is a hard prerequisite for implementation, not for interface design.** The interface can be designed now as provider-agnostic; the provider fills the implementation. Anthropic Claude is the assumed default (consistent with the stack context), but the interface is written so that swapping providers requires changing one module.
- **Output schema must be fully specified before any code is written.** The `risks[]` array item shape is the most likely cause of frontend/backend mismatch. This document proposes a concrete schema.
- **No streaming in v1.** The response is a single JSON body. No `text/event-stream`, no chunked transfer. This simplifies both the backend route and the frontend call significantly.
- **No new database schema.** Generated output is ephemeral — no `INSERT`, no `SELECT`. The route is stateless.
- **Context window (60%).** This analysis will be the deliverable. No code is being implemented in this session.

### Options Explored

#### Option 1: Standalone `/clauses/generate` route module (Recommended)

- **Description**: Add `src/routes/clauses.ts` (mirrors `contracts.ts` structure). Register it in `index.ts` as `app.use('/api/clauses', clausesRouter)`. The AI provider call lives in `src/ai/provider.ts` — a module with one exported async function (`generateClause`). The route imports from `src/ai/provider.ts` and handles HTTP concerns; `provider.ts` handles AI concerns.
- **Pros**: Follows the existing file layout. Provider swap requires changing one file (`provider.ts`). Route unit tests mock `provider.ts`; provider integration tests mock the SDK. Clear separation of concerns.
- **Cons**: Adds two new files; slightly more boilerplate than inlining the provider call in the route.
- **Effort**: Low

#### Option 2: Inline AI call in existing contracts router

- **Description**: Add a nested route `POST /api/contracts/:id/clauses/generate` in `contracts.ts` so generated clauses are scoped to a contract.
- **Pros**: Conceptually, clauses belong to contracts.
- **Cons**: The PRD explicitly says no database changes and the generator is ephemeral. Scoping to a contract ID adds coupling without benefit. Bloats `contracts.ts`. Harder to test in isolation.
- **Effort**: Low (but wrong architecture)

#### Option 3: Single flat function in index.ts with no module separation

- **Description**: Add the route and AI call directly in `index.ts`.
- **Pros**: Fewest files.
- **Cons**: `index.ts` already has a clean separation (middleware, routes, health check). Embedding AI logic there breaks that pattern. Untestable in isolation.
- **Effort**: Low (but wrong)

---

#### Option A: Formal TypeScript `AIProvider` interface (Recommended for v2, acceptable for v1)

- **Description**: Define a TypeScript interface:
  ```typescript
  export interface AIProvider {
    generateClause(input: ClauseRequest): Promise<ClauseResult>;
  }
  ```
  `src/ai/provider.ts` exports a concrete implementation and a factory. Future use cases (AI Risk Reviewer, etc.) import the interface, not the concrete class.
- **Pros**: Enables provider swap without changing call sites. Makes the "reusable AI call pattern" goal a concrete, reviewable deliverable. Aligns with the synthesis review's recommendation for an ADR or interface definition.
- **Cons**: Adds ~30 lines of interface + factory boilerplate for a v1 feature. May feel over-engineered if use cases 2–5 are years away.
- **Effort**: Low–Medium

#### Option B: Module isolation only — no formal interface

- **Description**: `src/ai/provider.ts` exports `generateClause(input: ClauseRequest): Promise<ClauseResult>` as a plain async function. No interface, no factory, no DI. Provider swap requires editing `provider.ts` and re-exporting the same function signature.
- **Pros**: Simpler. Achieves the "calls isolated in one module" goal with zero abstraction overhead. The interface can be extracted if use cases 2–5 actually materialize.
- **Cons**: Call sites import a concrete function, not an interface. Harder to unit-test without a mocking boundary (though Jest module mocks work fine for plain functions).
- **Effort**: Low

**Recommendation for v1**: Option B (module isolation). The formal interface (Option A) should be introduced as part of use case #2 (AI Risk Reviewer), when there are two consumers and the abstraction has clear value. Document this decision in an ADR committed alongside the implementation.

---

#### Option X: Single free-text `context` textarea

- **Description**: The frontend sends `{ clause_type: string, context?: string }`. The `context` is an optional free-text string. The prompt template interpolates it as-is.
- **Pros**: Simplest possible input UX. Lowest implementation cost. Handles unforeseen clause context naturally.
- **Cons**: Unguided input may produce lower-quality generations (users don't know what context helps). No structural validation possible.
- **Effort**: Low

#### Option Y: Named structured fields assembled client-side (v2 candidate)

- **Description**: Frontend shows fields like "Party type" (dropdown: vendor / customer / contractor), "Deal type" (dropdown: SaaS / services / NDA), "Liability cap" (text). Assembled into a context string before sending.
- **Pros**: Guided input → higher-quality generation. Discoverable for non-lawyers.
- **Cons**: Requires designing the field set per clause type. Significant frontend scope increase. Prompt engineering more complex.
- **Effort**: High

**Recommendation**: Option X for v1. Structured fields are v2. Document in non-goals to prevent scope creep.

---

#### Option I: Modal dialog triggered from contract detail/edit view (Recommended)

- **Description**: A "Generate Clause" button appears in the contract detail/edit action bar. Clicking it opens a full-screen modal overlay. The modal contains: clause type dropdown, optional context textarea, Generate button, and result display area (clause text + explanation + risks). No new route.
- **Pros**: No navigation disruption. Result is visible alongside the contract (if using split or overlay). Consistent with existing UX: the delete action uses `window.confirm`; a modal is the upgrade. No new URL = no back-button issues with ephemeral state.
- **Cons**: Modal must handle its own loading/error states. Result display in a modal may feel cramped for multi-paragraph clauses.
- **Effort**: Medium

#### Option II: Standalone route `/contracts/:id/generate-clause`

- **Description**: A dedicated page for clause generation, reachable from the contract detail view. Result is displayed on the page with a "Copy to clipboard" button.
- **Pros**: More room for result display. Browser history works naturally.
- **Cons**: Navigation disrupts the contract editing flow. For ephemeral output, a page feels heavy. Users may expect the result to persist if it has its own URL.
- **Effort**: Medium

#### Option III: Slide-over / side panel

- **Description**: A panel slides in from the right, overlapping the contract content 30–40%. Contract stays visible on the left.
- **Pros**: Clause text and contract content visible simultaneously — useful for pasting.
- **Cons**: More complex layout management. Tailwind CSS alone may not support this without custom work. Higher implementation risk.
- **Effort**: High

**Recommendation**: Option I (modal). Matches the existing app's interaction patterns and scope.

---

### Recommendation

**Backend endpoint:**
```
POST /api/clauses/generate
Content-Type: application/json
Authorization: [same session auth as /api/contracts — all authenticated users]

Request body:
{
  "clause_type": "limitation_of_liability",  // enum value (see below)
  "context": "SaaS vendor, B2B, capped at 12 months fees"  // optional free text, max 2000 chars
}

Success response (200):
{
  "text": "...",         // clause text, plain text (not Markdown), ready to paste
  "explanation": "...", // 1–2 paragraph plain-language explanation
  "risks": [
    {
      "text": "...",               // description of the risk
      "severity": "medium"         // "low" | "medium" | "high"
    }
  ]
}

Error responses:
400 { "error": "clause_type is required" }
400 { "error": "clause_type must be one of: ..." }
400 { "error": "context must be at most 2000 characters" }
503 { "error": "AI provider unavailable. Please try again." }
503 { "error": "AI provider rate limit reached. Please wait a moment." }
500 { "error": "Failed to generate clause. The AI response was malformed." }
500 { "error": "Internal server error" }
```

**Clause type enum (v1 fixed list — hardcoded, not configurable):**
```typescript
export const CLAUSE_TYPES = [
  'limitation_of_liability',
  'indemnification',
  'ip_assignment',
  'nda_confidentiality',
  'force_majeure',
  'payment_terms',
  'termination',
] as const;

export type ClauseType = typeof CLAUSE_TYPES[number];
```

**Shared TypeScript types (backend `src/types.ts`, duplicated or shared with frontend):**
```typescript
export interface ClauseRequest {
  clause_type: ClauseType;
  context?: string;
}

export interface RiskItem {
  text: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ClauseResult {
  text: string;
  explanation: string;
  risks: RiskItem[];
}
```

**Frontend `api.ts` addition:**
```typescript
const CLAUSES_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api/clauses`
  : '/api/clauses';

export async function generateClause(input: ClauseRequest): Promise<ClauseResult> {
  const res = await fetch(`${CLAUSES_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<ClauseResult>(res);
}
```
(Reuses the existing `handleResponse<T>` helper — errors surface as `Error` with the provider's message.)

**Provider module (`src/ai/provider.ts`):**
```typescript
// Reads ANTHROPIC_API_KEY from env. Throws on startup if key is missing
// and the generate function is called (not at module load — lazy validation).
export async function generateClause(input: ClauseRequest): Promise<ClauseResult> { ... }
```

**Environment variable contract:**
```
ANTHROPIC_API_KEY=sk-ant-...   # Required. Missing key → 503 on first generate call.
AI_MODEL=claude-sonnet-4-6     # Optional. Defaults to a pinned model version (not mutable alias).
AI_TIMEOUT_MS=25000            # Optional. Default 25000 (25s). Backend timeout before returning 503.
```

**UI entry point:**
- Button label: "Generate Clause" (not "AI Generate" — keep it action-oriented)
- Placement: action bar on `ContractDetail` and `ContractEdit`, styled like the existing "Edit Contract" button
- Modal trigger: button click opens `<ClauseGeneratorModal>` component
- Modal anatomy:
  1. Dropdown: "Clause Type" — renders human-readable labels from `CLAUSE_TYPES` enum
  2. Textarea: "Context (optional)" — placeholder: "e.g., SaaS vendor, B2B, liability cap 12 months fees"
  3. Disclosure: "Your input will be sent to an AI provider for processing." (1 line, below textarea)
  4. Generate button + spinner during loading
  5. Result area (hidden until first successful generation): clause text (monospace, copyable), explanation, risks list with severity badges
  6. "Copy clause text" button (clipboard API)
  7. Close button / ESC to dismiss

**Error display (in-modal):**
```
Missing API key:    Inline error callout — "Clause generation is not available. Contact your administrator."
Provider 5xx:       Inline error callout — "AI provider unavailable. Please try again." + Retry button
Rate limit:         Inline error callout — "Too many requests. Please wait a moment." + Retry button
Timeout (>25s):     Inline error callout — "Generation timed out. Please try again." + Retry button
Malformed response: Inline error callout — "Unexpected response from AI. Please try again." + Retry button
Content declined:   Inline error callout — "The AI declined to generate this clause type." (no retry)
```

All errors are inline within the modal, not toast notifications. The Generate button is re-enabled after an error (stateless retry — no backoff in v1).

## Constraints Identified

- **`ANTHROPIC_API_KEY` must be checked at call time, not at server startup.** This avoids breaking the server if the key is temporarily missing during a deploy window. On missing key: return 503 with `"AI provider unavailable"` — do NOT expose the specific reason ("key missing") to the client.
- **`clause_type` must be validated against the `CLAUSE_TYPES` enum on the backend.** Do not trust client-supplied strings as-is to the prompt — an attacker could inject arbitrary clause type text into the prompt. Validate against the fixed list before constructing the prompt.
- **`context` max length: 2000 characters.** This caps prompt injection surface and keeps the request/response within reasonable AI latency bounds. Matching client-side validation (textarea `maxLength` attribute) and server-side validation (400 on exceed).
- **Clause text format: plain text, not Markdown.** The existing contract content area uses `whitespace-pre-wrap font-mono` rendering (see `ContractDetail.tsx:73`). Generating Markdown would render as raw asterisks when pasted into the contract body. Plain text pastes correctly.
- **No streaming.** `fetch()` + `res.json()` is sufficient. No `ReadableStream`, no `EventSource`.
- **Model version must be pinned.** `AI_MODEL` env var defaults to a specific model version string (e.g., `claude-sonnet-4-6`), not a mutable alias like `claude-3-5-sonnet-latest`. Provider-side model updates should not silently change generation behavior.
- **The generate endpoint must be protected by the same session auth middleware as `/api/contracts`.** If no auth middleware exists today, the endpoint is currently open — this must be flagged as a pre-ship security requirement. (See Open Questions.)
- **No CORS changes needed.** The frontend proxies `/api` through Vite in dev and uses the same origin in production. The existing CORS config covers the new route.

## Open Questions

1. **Auth middleware**: Does `/api/contracts` currently enforce session authentication? The codebase does not show any `req.session` or JWT verification in `index.ts` or `contracts.ts`. If there is no auth middleware, `POST /api/clauses/generate` would be an open, money-burning endpoint. This must be resolved before shipping — either confirm existing auth or add middleware.

2. **Legal/compliance review of context data flow**: The `context` field will contain confidential contract terms routed to a third-party AI provider. This must be reviewed before launch (flagged as potential ship blocker by the synthesis review). The UI disclosure line is a minimum; the legal team must confirm it is sufficient.

3. **Copy-to-clipboard behavior**: The `navigator.clipboard.writeText()` API requires a secure context (HTTPS or localhost). Is the production deployment HTTPS? If not, the clipboard button needs a fallback (e.g., `document.execCommand('copy')` or a "Select all" affordance).

4. **Rate limiting**: The PRD does not specify a rate limit. A simple per-session or per-IP throttle (e.g., 10 requests/minute) would prevent runaway spend. Defer to v2 only if the operator accepts the financial risk explicitly.

5. **Backend timeout propagation**: The AI provider SDK call must be wrapped with a timeout. If the provider takes >25s, the backend should abort the call and return 503. Express's default timeout is longer; an explicit `AbortController` or `Promise.race` is needed.

6. **Explanation length**: Not specified in the PRD. Proposed: the prompt instructs the model to produce a 1–3 sentence explanation. Longer explanations require more modal real estate; shorter ones may not be useful for Scenario 3 (Carol learning what a clause does). Open to product decision.

7. **`risks[]` minimum count**: Should the model always return at least one risk? What does the UI show if `risks` is an empty array? Proposed: the UI shows "No specific risks identified" — do not hide the section.

## Integration Points

- **Data Model dimension**: The `ClauseResult` schema (`text`, `explanation`, `risks: RiskItem[]`) proposed here is the contract between backend and frontend. If the data model dimension proposes a different `RiskItem` shape, this document's schema takes precedence for the API surface; internal model representation can differ.
- **Implementation**: The `src/ai/provider.ts` module is the primary implementation target. The route handler in `src/routes/clauses.ts` is boilerplate around it. The `ClauseGeneratorModal` React component is the frontend primary target. Both depend on the `ClauseRequest` / `ClauseResult` types being agreed and stable.
- **UX analysis**: The modal anatomy described above is a proposal. If a UX dimension exists or a designer reviews, the layout should be confirmed — particularly the disclosure placement, the result display hierarchy (clause text first vs. explanation first), and the risk severity badge colors.
- **Auth middleware**: If auth is added as part of this feature (to protect the generate endpoint), it will likely need to be applied to `/api/contracts` as well for consistency. That is a broader scope change — flag to the Witness if the auth decision expands scope beyond the clause generator.
- **Future use cases**: Use cases #2–#5 will import `generateClause` (or a similarly-structured function) from `src/ai/provider.ts`. The `ClauseType` enum and `ClauseResult` shape should be considered the v1 contract. Changing them in v2 is a breaking change for consumers — version carefully or extract to a shared types package.
