# Data Model Design

## Summary

The AI Clause Generator requires **no new database tables for v1**. The PRD is explicit: generated output is ephemeral — clauses are discarded after the response is delivered, unless the user manually pastes the text into the contract body. The existing `contracts` table in `clm.db` remains untouched. The entire "data model" for v1 is a set of TypeScript interfaces that define the request/response schema for the `POST /api/clauses/generate` endpoint.

The most consequential data decisions are: (1) the `risks[]` item schema — the primary frontend/backend mismatch risk if left unspecified; (2) where TypeScript types are defined so that backend route, AI provider module, and frontend API client share a single source of truth; and (3) how the clause type list is represented in code so it is easily extensible for use case #5 (Clause Library). This document proposes concrete answers to each and explains the rationale for the "no persistence in v1" constraint.

## Analysis

### Key Considerations

- **No DB changes in v1 is a hard constraint**, not a soft guideline. The PRD states it explicitly. This eliminates the question of schema design for generated clauses — that belongs to use case #5 (Clause Library).
- **Ephemeral by design has UX consequences**: users cannot retrieve prior generations. This is an acceptable v1 trade-off but must be documented as a known limitation for use case #5 planning.
- **The existing `contracts.content` field is plain text**: when a user pastes a generated clause into the contract body, it lands as unstructured text. No tagging, no lineage. The contract model does not need to know a clause was AI-generated.
- **TypeScript interfaces are the schema**: for a stateless, ephemeral API, types serve the same contract-enforcement role that a migration-backed schema serves for persistent data.
- **`risks[]` item shape is the only high-stakes schema decision in v1**: everything else (request shape, top-level response fields) is straightforward.
- **Clause type list must be typed as a union or const array** to enable exhaustiveness checking. A bare `string` loses the ability to validate inputs and make the dropdown type-safe.
- **No caching layer needed in v1**: AI responses are not expensive enough to cache, generation inputs vary enough that cache hit rate would be low, and the PRD does not mention latency SLAs beyond "under 30s."

### Options Explored

#### Option 1: Pure TypeScript interfaces, no persistence (Recommended)

- **Description**: Define `ClauseType`, `ClauseRequest`, `RiskItem`, and `ClauseResult` as TypeScript interfaces/types in `backend/src/ai/types.ts` (or extend `backend/src/types.ts`). Frontend mirrors these in `frontend/src/types.ts`. No DB changes, no migration, no new tables.
- **Pros**: Zero migration risk. Satisfies the hard v1 constraint. Types are the only artifact that needs review. Consistent with the existing pattern (`Contract`, `ContractInput` in `types.ts`). Fast to implement.
- **Cons**: No audit trail of what was generated. No analytics on clause type usage. No way to surface "your 10 most recent generations" in a future UI without a schema change.
- **Effort**: Low

#### Option 2: Persist to SQLite with a `generated_clauses` table

- **Description**: Add a new table to `clm.db` tracking each generation: `id`, `contract_id` (nullable FK), `clause_type`, `context_input`, `generated_text`, `explanation`, `risks_json`, `created_at`. Add this to `db.ts`'s `CREATE TABLE IF NOT EXISTS` block.
- **Pros**: Enables history, analytics, and future Clause Library (use case #5). Audit trail for compliance. Users can retrieve their last N generations without re-generating.
- **Cons**: Violates the explicit v1 PRD constraint ("Must not require database schema changes for v1"). Adds scope risk. Persisting `context_input` creates a new data retention obligation — user contract context (which may contain PII/confidential terms) would be stored indefinitely without a defined TTL or deletion policy. Compliance risk flagged by the synthesis review escalates significantly.
- **Effort**: Medium (table schema + migration + route changes + lifecycle management)

#### Option 3: Client-side ephemeral state with `sessionStorage`

- **Description**: Frontend stores the last generation result in `sessionStorage`. On page reload, the data is gone; on session close, it's gone. Backend remains stateless.
- **Pros**: Gives users a "within-session" history without any backend persistence or compliance exposure.
- **Cons**: Inconsistent behavior (refreshing the page loses results). Does not help future use case #5. Not a data model — just a UX patch.
- **Effort**: Low (but does not address the underlying question)

---

#### Option A: `risks: string[]` — flat risk list

- **Description**: The `risks` field in `ClauseResult` is a plain array of strings, each a single risk statement.
- **Pros**: Simplest possible schema. Frontend renders a `<ul>`. Model prompt can instruct "return an array of strings."
- **Cons**: No severity signal. UI cannot highlight high-severity risks. Future Clause Library cannot filter by risk level. Synthesis review and API design leg both flagged severity as likely needed.
- **Effort**: Low

#### Option B: `risks: RiskItem[]` with severity (Recommended)

- **Description**: Each risk item is a typed object:
  ```typescript
  export interface RiskItem {
    text: string;
    severity: 'low' | 'medium' | 'high';
  }
  ```
  The model prompt instructs it to return JSON with this shape. The backend validates the array elements and rejects (or normalizes) any element that does not conform.
- **Pros**: Enables severity-based UI treatment (e.g., red for high, yellow for medium). Consistent with what downstream use case #2 (AI Risk Reviewer) will likely need. Adds ~10 lines to the schema. The API design leg already recommended this shape.
- **Cons**: Adds a validation step for model output. Model may return inconsistent severity labels — prompt engineering needed to keep severity values stable. `severity` values require explicit enumeration in the system prompt.
- **Effort**: Low–Medium (the added effort is prompt design, not code)

#### Option C: `risks: RiskItem[]` with severity and optional category

- **Description**: Extends Option B with an optional `category` field (e.g., `'jurisdiction'`, `'liability'`, `'compliance'`):
  ```typescript
  export interface RiskItem {
    text: string;
    severity: 'low' | 'medium' | 'high';
    category?: string;
  }
  ```
- **Pros**: Richer filtering. Clause Library can group risks by category.
- **Cons**: Category enumeration is hard to constrain without a predefined list. Free-form categories will be inconsistent across generations. Premature for v1.
- **Effort**: Medium (primarily prompt design complexity)

---

#### Clause type representation

**Option I: String literal union (Recommended)**
```typescript
export const CLAUSE_TYPES = [
  'nda',
  'limitation_of_liability',
  'ip_assignment',
  'force_majeure',
  'indemnification',
  'payment_terms',
  'termination',
] as const;

export type ClauseType = typeof CLAUSE_TYPES[number];
```
- **Pros**: Single source of truth. TypeScript exhaustiveness checking. The array is directly usable by the frontend to render the dropdown. Adding a new type is a one-line change. No DB migration.
- **Effort**: Low

**Option II: Enum**
```typescript
export enum ClauseType {
  NDA = 'nda',
  LIMITATION_OF_LIABILITY = 'limitation_of_liability',
  ...
}
```
- **Pros**: Familiar pattern.
- **Cons**: TypeScript enums have known serialization quirks. `as const` array is idiomatic for this use case in modern TypeScript.
- **Effort**: Low

**Option III: Plain string with runtime validation**
```typescript
clause_type: string  // validated against an allowlist at runtime
```
- **Cons**: No compile-time safety. Two sources of truth (the type definition and the runtime allowlist).
- **Effort**: Low (but wrong)

### Recommendation

**Use Option 1 + Option B + Option I:**

No database changes. TypeScript types as schema. `RiskItem` with `text` and `severity`. Clause types as a `const` array/union.

**Canonical type definitions (`backend/src/ai/types.ts`):**
```typescript
export const CLAUSE_TYPES = [
  'nda',
  'limitation_of_liability',
  'ip_assignment',
  'force_majeure',
  'indemnification',
  'payment_terms',
  'termination',
] as const;

export type ClauseType = typeof CLAUSE_TYPES[number];

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

The frontend mirrors `ClauseType`, `ClauseRequest`, and `ClauseResult` in `frontend/src/types.ts` (or imports from a shared package, if the monorepo ever adds one). For v1, duplication is acceptable — the shapes are stable and small.

The backend route validates:
- `clause_type` is a member of `CLAUSE_TYPES` (reject 400 if not)
- `context`, if present, is a non-empty string ≤ 2,000 characters (prevent prompt injection via oversized context)
- The model response conforms to `ClauseResult` (validate `risks` array items have `text: string` and `severity` in `['low','medium','high']`; strip or reject non-conforming items)

## Constraints Identified

- **No new SQLite tables in v1** — hard constraint from PRD. Any persistence (audit log, history) requires a separate decision and deferred to use case #5.
- **`context` field must be length-bounded at the API layer** — unbounded user input fed directly into a prompt is both a cost risk (large token counts) and a prompt injection surface. Recommended limit: 2,000 characters.
- **Model output validation is mandatory** — structured JSON from a language model can and does deviate from the expected schema. The route must handle: missing fields, `severity` values outside the enum, `risks` being null/undefined, empty `text`. Fail with a 502 and a user-visible error rather than silently returning malformed data.
- **No PII in persisted logs** — if request logging is added (recommended by synthesis review), the `context` field must be excluded or redacted, as it may contain counterparty names, financial terms, or other confidential information.
- **Clause type list is hardcoded for v1** — the synthesis review and PRD both point to the seven types listed above as the right v1 set. Making the list configurable (env var, config file) is a v2 consideration.

## Open Questions

1. **Who owns the type definitions when use cases 2–5 arrive?** The `ClauseType` union and `RiskItem` interface will be imported by the AI Risk Reviewer (use case #2). At that point, a shared types package or monorepo-level `types/` directory becomes worth creating. Is that in scope for use case #2 or deferred further?

2. **Should `context` be renamed to reflect its structured vs. free-text nature?** The API design leg notes that the PRD says "structured inputs" but the Rough Approach shows `context?: string` (free text). If the decision is free text, `context` is fine. If structured fields are chosen, the type definition changes materially. This decision is upstream of this document.

3. **What is the maximum `context` length?** 2,000 characters is proposed here as a reasonable limit (roughly 500 tokens), but the right value depends on provider/model context window costs and the expected verbosity of user-provided context. Needs a product decision.

4. **Does the Clause Library (use case #5) retroactively need a migration path for clauses generated in v1?** If the answer is "yes," then even in v1 we may want to generate and return a `generation_id` UUID (not persisted, just returned in the response) so that future persistence can reference it. This is low-cost to include in v1 and prevents "we have no IDs for past generations" pain later.

5. **Should `risks: RiskItem[]` be nullable or always an empty array on error?** If the model cannot generate risk notes, should the response be `{ text, explanation, risks: [] }` or `{ text, explanation, risks: null }`? Recommendation: always an array (empty on model failure), never null, to simplify frontend rendering logic.

## Integration Points

- **API & Interface design leg**: The `ClauseRequest` and `ClauseResult` types are the contract between the backend route and the AI provider module. The API design leg has already proposed this split (`src/routes/clauses.ts` + `src/ai/provider.ts`); the types defined here populate that contract.
- **Frontend component design**: The `ClauseType` `as const` array is directly usable as the dropdown's option list. The `RiskItem.severity` field drives UI treatment (color coding, ordering). Frontend needs to import or mirror these types.
- **AI provider / prompt design**: `RiskItem.severity` requires explicit instruction in the system prompt ("return severity as one of: low, medium, high"). The prompt design must match this schema exactly.
- **Observability**: If per-request logging is added, the log schema (request `clause_type`, response `risks` count, latency, provider error code) is derived from these types. The `context` field must be excluded from logs.
- **Use case #5 (Clause Library)**: When this ships, the recommended SQLite schema for stored generations is:
  ```sql
  CREATE TABLE generated_clauses (
    id          TEXT PRIMARY KEY,
    contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    clause_type TEXT NOT NULL,
    context     TEXT,
    text        TEXT NOT NULL,
    explanation TEXT NOT NULL,
    risks_json  TEXT NOT NULL,  -- JSON-serialized RiskItem[]
    created_at  TEXT NOT NULL
  );
  CREATE INDEX idx_generated_clauses_contract ON generated_clauses(contract_id);
  CREATE INDEX idx_generated_clauses_created  ON generated_clauses(created_at DESC);
  ```
  Documenting this now means the v1 type definitions are designed with the future schema in mind. No migration needed in v1; this is forward-compatible.
