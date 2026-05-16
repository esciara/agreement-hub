# Requirements Completeness

## Summary

The AI Clause Generator PRD has a well-framed problem statement and a disciplined Non-Goals
section that protects scope effectively. The technical constraints are specific and reasonable,
and the three user scenarios (Alice, Bob, Carol) provide useful concrete context. However, nine
open questions remain entirely unanswered, and the majority of them are implementation-blocking
rather than aspirational. A developer starting today would be blocked before writing a single
line of production code: UI placement, clause type enumeration, and AI provider choice all
cascade into nearly every other decision. More fundamentally, the PRD contains almost no
testable acceptance criteria beyond the 30-second latency goal. Terms like "ready-to-use,"
"integrates without redesigning," and "short plain-language explanation" are stated as goals but
left undefined — a QA engineer cannot write passing tests against them.

The PRD is appropriate for early architecture discussions, provider evaluation, and spike work.
It is not yet sufficient to begin a parallel frontend/backend implementation sprint without
resolving at minimum the five critical gaps identified below.

---

## Findings

### Critical Gaps / Questions

**1. UI placement is undefined — frontend implementation cannot start**

Open Question 1 (modal vs. standalone route vs. sidebar panel) has no provisional answer and no
decision process. These are meaningfully different amounts of work:

- A modal on the contract edit page requires no routing changes and minimal layout impact.
- A standalone `/clauses/generate` route requires a new page, navigation entry, and potentially
  a different entry-point UX.
- A sidebar panel requires layout restructuring of the contract editor.

Frontend and backend work can only run in parallel if the UI contract is settled. Without this,
any frontend work risks complete rework.

*Suggested question:* "Has the UI placement been sketched in any wireframe or design file?
Even a rough decision (e.g., 'modal for now, revisit for v2') would unblock frontend work."

**2. Clause type input is undefined — UX and backend validation are different paths**

Open Question 2 (fixed dropdown vs. free-text) has no answer. These diverge significantly:

- A fixed dropdown requires a curated list of clause types (not provided), validation against
  that list on the backend, and a simpler prompt (type is known and bounded).
- Free-text input requires prompt engineering to handle arbitrary input, sanitization against
  prompt injection, and no guarantees on output quality for unusual clause names.

The three user scenarios reference specific clause types (limitation of liability, IP assignment,
force majeure) but the PRD does not state whether these constitute the v1 list or are examples.

*Suggested question:* "Is the clause type list the set from the scenarios (NDA, limitation of
liability, IP assignment, force majeure, indemnification, payment terms, termination) or should
users be able to type any clause name?"

**3. AI provider is undecided — no implementation can start**

Open Question 3 has no answer. SDK choice, prompt format, JSON mode availability, token limits,
cost per call, and error codes all depend on provider selection. The backend abstraction cannot
be designed without knowing what it must abstract over — an abstraction for "maybe Anthropic,
maybe OpenAI" that works for both is not trivial and cannot be designed in a vacuum.

*Suggested question:* "Can Anthropic Claude be treated as the v1 provider decision, with the
abstraction designed after? Or is there a requirement to support multiple providers at launch?"

**4. Output quality acceptance criteria are absent**

The primary product goal — "a ready-to-use clause draft" — has no testable definition:

- "Ready-to-use" is undefined. Does it mean: (a) contains required legal structural elements for
  the clause type, (b) includes bracketed placeholders for party names/amounts, (c) is a certain
  minimum length, or (d) passes some internal review by a non-lawyer?
- Explanation length (Q6): "short" is not a spec. 1 sentence, 1 paragraph, and 100 words are
  all "short" and produce very different UI layout needs.
- Risk notes format (Q7): bulleted list vs. severity-tagged risks requires different frontend
  rendering and different prompt construction.
- Output format is unspecified: is the clause text markdown, plain text, or HTML? This affects
  both the prompt design and the frontend display component.

Without any of this, a developer will make these choices ad hoc, stakeholders cannot evaluate
whether the feature meets its goal, and QA cannot write acceptance tests.

*Suggested question:* "Can we define a concrete example of good output for one clause type
(e.g., limitation of liability)? A single worked example would serve as the acceptance baseline
for the entire feature."

**5. Error handling contract is unspecified on both sides**

Open Question 5 (error UX) has no answer, and the PRD describes three distinct failure modes
with meaningfully different UX implications:

- **Missing API key**: An operator configuration error. The user cannot fix it. The UX should
  probably suppress the Generate button or show a persistent configuration error, not a
  per-request toast.
- **Provider temporarily down**: A transient infrastructure failure. A retry might help. The UX
  could show a "try again" affordance.
- **Model error / refusal**: A content or parameter issue. Retry will not help. The UX should
  communicate that the specific request failed.

The backend error response format (HTTP status codes, error body shape, error codes) is
undefined. Frontend and backend will be implemented independently and will not align without a
contract.

*Suggested question:* "Should the backend return structured error codes (e.g., `PROVIDER_DOWN`,
`KEY_MISSING`, `MODEL_ERROR`) so the frontend can differentiate, or is a generic error message
acceptable for v1?"

---

### Important Considerations

**Input validation is unspecified**

The rough approach shows `{ clause_type: string, context?: string }` with no validation rules:

- No maximum length for `context`. AI providers have token limits; an unbounded textarea can
  cause unexpected truncation, inflated cost, or failed requests. Even a generous limit (e.g.,
  2,000 characters) should be specified.
- `clause_type` validation: if using a fixed dropdown, the backend should validate against the
  list. If free-text, sanitization is required.
- Prompt injection via `context` is a real risk. A user who enters carefully crafted text in
  the context field can potentially manipulate the model's output. This should be acknowledged
  and a mitigation strategy noted (e.g., system prompt isolation, input length limits).

**Loading state UX is missing**

The 30-second latency goal implies users may wait up to 30 seconds for a response. The PRD
does not specify what the user sees during generation. A blank screen or unresponsive button
for up to 30 seconds is a poor experience and will generate support tickets. At minimum, a
spinner and some indication of expected wait time should be required.

**No observability requirements**

The feature makes paid API calls on behalf of users. There is no mention of:

- Request-level logging (what was requested, what provider returned, latency, error codes)
- Cost visibility (API calls per day, cost per call)
- Error rate monitoring (are calls failing? Is the API key valid?)
- Latency percentile tracking (is the 30-second goal being met in production?)

Without minimum observability, the team will not know if the feature is working in production.
For a v1 API integration, this is typically discovered post-incident.

**Rate limiting is unresolved with accepted risk not stated**

Open Question 8 (rate limiting) is listed without resolution or accepted risk. "None in v1 —
we accept the risk" is a valid answer. "Unknown" is not. A single misconfigured test loop or
a shared demo environment can generate significant unexpected API spend without throttling.

**Provider abstraction scope is undefined**

The PRD states the backend should be "provider-agnostic enough to swap" but does not define
what that means in practice. Without an interface spec, different developers will interpret
"agnostic" differently. This requirement should be stated as a concrete constraint: "The AI
call must go through an interface that can be implemented by both Anthropic and OpenAI SDKs
with no changes to the caller."

---

### Observations

- The problem statement is strong. The pain is real, the users are named and specific, and
  the "why now" is grounded in roadmap sequencing rather than vague priority.

- The Non-Goals section is the strongest part of this PRD. Explicitly ruling out persistence,
  multi-turn conversation, streaming, jurisdiction-specific requirements, and a Clause Library
  protects scope effectively and will prevent gold-plating.

- The 30-second goal is the only metric in the PRD and should be treated as a hard acceptance
  threshold. Consider specifying it as a p95 latency (95% of requests complete within 30s) to
  allow for occasional provider slowdowns while maintaining a verifiable standard.

- The three user scenarios (Alice, Bob, Carol) cover meaningfully different use cases: blank-
  slate drafting, risk awareness, and education. These are useful QA anchors and should be
  preserved as acceptance scenarios, not discarded once the PRD is finalized.

- The rough approach's preference for structured JSON output from the model is sound and should
  be made explicit in the output spec once format is defined. JSON mode is more reliable than
  free-text parsing for structured data.

- The feature is described as the "AI integration pattern" for subsequent roadmap use cases.
  This makes architecture decisions (provider abstraction, error handling, key management) more
  consequential than they appear in isolation — the patterns set here will be copied for use
  cases 2 through 5.

- Privacy implications of sending contract content to a third-party provider are not addressed.
  For enterprise or legal-sensitive customers, this could be a deployment blocker discovered
  after implementation. A one-paragraph position statement (even "we accept this risk for v1")
  would prevent a last-minute escalation.

---

## Confidence Assessment

**Low-Medium**

The PRD establishes clear scope and problem framing but is not buildable in a production sprint:

- **UI placement and AI provider** (Q1, Q3) must be resolved before any production
  implementation begins — they cascade into frontend component scope, routing, SDK choice, and
  prompt design.
- **Output quality criteria** are absent, making acceptance testing impossible.
- **Error handling** (Q5) is listed as an open question rather than a specification.
- **Input validation and prompt injection risk** are not addressed.

A developer could productively run a spike (stand up the backend skeleton, evaluate SDKs,
prototype a modal component) but would be blocked before writing mergeable production code.
Resolving the five critical gaps identified above would likely bring this to **Medium-High**
and make a full sprint feasible.
