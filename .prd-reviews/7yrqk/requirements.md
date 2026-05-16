# Requirements Completeness

## Summary

The PRD has strong foundations: a clear problem statement, one concrete measurable goal (30-second generation), well-scoped non-goals, and three realistic user scenarios. The constraints section is unusually honest about what is not yet decided. However, the PRD carries 9 open questions — several of which are design-time decisions that must be resolved before implementation can start. Roughly 40% of what's needed to write executable acceptance tests is still unresolved. The feature is directionally clear but not yet build-ready.

The gap pattern is consistent: the PRD specifies the happy path well and leaves error states, output schema details, and quality thresholds almost entirely unaddressed. A QA engineer reading this today could not write a test suite; they would need answers to at minimum four of the nine open questions before beginning.

---

## Findings

### Critical Gaps / Questions

**1. Error states are undefined**

Open question #5 asks "what does the user see if the API key is missing, the provider is down, or the model returns an error?" — but this is not an optional detail. It is a functional requirement. The backend `POST /api/clauses/generate` endpoint must return something in every failure mode; the frontend must render something. Without this, two implementers will make incompatible choices.

Failure modes to specify:
- API key missing or invalid (startup error vs. per-request error)
- Provider returns 5xx / is unreachable
- Provider rate-limits the request
- Model returns malformed or non-JSON response
- Model declines to generate (content policy refusal)
- Network timeout (who sets the timeout? what value?)

*Why this matters:* Every unspecified failure mode becomes a product decision made by an engineer under time pressure, with no review.

*Suggested question:* For each failure mode above, what does the user see? A generic "something went wrong" toast? A specific message? A retry button?

---

**2. Output schema is underspecified**

The rough approach names `{ text, explanation, risks[] }` but stops there. Without a schema, implementers will make divergent choices:

- What is the type of `risks[]`? Array of strings? Objects with `{ severity, description }`?
- Are there minimum/maximum lengths for `text` and `explanation`?
- Is an empty `risks[]` valid, or does generation always include at least one risk note?
- What happens if the model returns only `text` and omits `explanation`? Is that a failure or acceptable?

*Why this matters:* The frontend must render this structure. If schema is undefined, the rendering logic will be guesswork, and any future provider swap risks breaking the display.

*Suggested question:* Can we commit to a concrete response schema now — e.g., `{ text: string, explanation: string, risks: string[] }` — and specify that any deviation from this schema is treated as a generation error?

---

**3. "Under 30 seconds" is a goal without a failure condition**

The 30-second target is the only quantified goal in the PRD, which is good. But the PRD doesn't specify:
- How it is measured (client-side render complete? server response time? time-to-first-byte?)
- What happens if generation exceeds 30 seconds (timeout? spinner continues? error?)
- Whether this is P50, P95, or average
- Whether it applies to a cold backend or warm

*Why this matters:* Without a failure condition, the goal is decorative — there is no behavior to implement when the threshold is breached.

*Suggested question:* Should the backend enforce a hard timeout on the provider call? If so, at what value, and what does the user see when it fires?

---

**4. Testing strategy is unresolved (open question #9)**

The PRD acknowledges the tension: mock the AI provider in tests (fast, cheap, unreliable as a quality gate) vs. real key in CI (costly, slow, but honest). This must be decided before any test infrastructure is built. If the team decides on mocks, someone must own the mock contract and keep it aligned with provider behavior. If real keys, someone must own secret rotation and cost budgeting.

*Why this matters:* This is not an implementation detail — it is an architecture decision that determines whether CI is meaningful. A feature with untested AI calls ships with unknown reliability.

*Suggested question:* Will CI use mocked provider responses or real API calls? If mocked, who owns the mock fixture and reviews it for accuracy?

---

**5. Clause type list is undefined (open question #2)**

The UI requires a dropdown or free-text input for clause type. Open question #2 asks whether this is a fixed dropdown or free-text — but even if the decision is "dropdown," the list of clause types is not provided. The backend prompt is built around clause type, so the prompt author needs the type list. The frontend needs it to render the control. QA needs it to write tests.

*Why this matters:* This is a content decision masquerading as a UX decision. The clause types are inputs to the AI prompt — unreviewed or unprompted clause types could generate poor output.

*Suggested question:* What is the v1 clause type list? Is it fixed (hard-coded) or admin-configurable?

---

### Important Considerations

**A. Input validation and prompt injection are unaddressed**

The `context` field (`context?: string`) is user-supplied text that goes directly into the AI prompt. The PRD does not specify:
- Maximum length for `context`
- Server-side validation or sanitization before inclusion in the prompt
- Whether the clause type field is validated against an allowlist server-side

A user submitting a very long `context` or a crafted string that manipulates prompt structure is a realistic attack surface. This is not paranoia for v1 — it is the minimum due diligence for any user-facing AI feature.

*Suggested question:* What are the length limits and sanitization rules for `clause_type` and `context` before they are embedded in the AI prompt?

---

**B. No legal disclaimer requirement is stated**

The PRD describes output that includes "risk notes" — implying the feature is surfacing legally relevant information to non-lawyers. The user scenarios explicitly mention legal review scenarios (Bob follows up with counsel because of a risk note). There is no mention of a disclaimer that generated output is not legal advice.

This is an implicit requirement with real liability implications. Absence of a disclaimer in a legal-adjacent product is a decision, not an oversight — but it should be a deliberate one.

*Suggested question:* Should generated output include a disclaimer (e.g., "AI-generated — not legal advice")? Who owns this decision?

---

**C. Observability is entirely absent**

There is no mention of logging, metrics, or alerting for the AI call layer. At minimum, the following should be logged:
- Per-request latency (to validate the 30-second goal in production)
- Provider errors (to detect outages)
- Request volume (for cost tracking)

Without any observability, the team has no signal when the feature breaks or costs spike.

*Suggested question:* What gets logged per AI call? Is there a cost or latency alert?

---

**D. Provider abstraction is underspecified**

The constraint says the backend should be "provider-agnostic enough to swap." This is a design goal, not a requirement. Without a concrete definition — an interface, a module boundary, a contract — different engineers will interpret this differently.

*Suggested question:* What does "provider-agnostic" mean concretely? An interface with `generate(clause_type, context) => ClauseResult`? A config-driven factory? This should be specified before the first implementation.

---

**E. "Establishes a reusable AI call pattern" is untestable as written**

One of the four goals is to establish a reusable pattern for subsequent use cases. There is no acceptance criterion for this goal — it cannot be tested or verified at handoff. This goal belongs in an architecture decision record, not a product acceptance criterion.

*Suggested question:* Can this goal be expressed as a concrete deliverable? E.g., "A documented AI provider interface that use case #2 can import without modification."

---

### Observations

- The non-goals section is well-written and reduces scope creep risk effectively. The explicit exclusions (streaming, persistence, jurisdiction-specific requirements, multi-turn) are good.
- The open questions section is honest and useful — the authors know what they don't know. The concern is that the questions need answers, not just enumeration.
- All three user scenarios show successful generation. None of them show what Alice, Bob, or Carol see when something goes wrong. Adding one failure scenario would significantly strengthen this section.
- The "no database schema changes" constraint is correctly stated for v1, but no mention of request logging or audit trail. If an audit trail is needed later (e.g., for compliance), retrofitting schema will be more disruptive. Flagging this now is low-cost.
- Rate limiting (open question #8) should be explicitly deferred to v2 in the PRD body rather than left as a question. "No rate limiting in v1 — defer to v2" is a product decision, and the PRD should make it.

---

## Confidence Assessment

**Medium**

The PRD provides enough context to begin architecture and design discussions, and to spike the provider integration. It is not complete enough to hand to an engineer and say "build this." Specifically:

- 5 of 9 open questions are design-time decisions (UI placement, clause types, provider choice, error UX, testing strategy) — these must be answered before implementation begins
- The output schema needs a concrete definition before frontend and backend can work in parallel
- Error states need a spec before any meaningful test can be written

A team that resolves the 5 critical-gap items above could reach "build-ready" status. The remaining important considerations (input validation, disclaimer, observability) should be addressed in implementation but are not blockers to starting.
