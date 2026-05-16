# PRD Review: AI Clause Generator for Agreement Hub

> Users composing contracts need AI assistance generating ready-to-use clause text with explanation and risk notes. They currently write from scratch with no guidance on clause quality or risk.

---

## Executive Summary

The PRD is directionally solid: the problem is real, the personas are grounded, the non-goals are admirably specific, and the implementation path is technically tractable. However, six critical decisions are currently unresolved — not open questions to discover during implementation, but blockers that will cause two engineers to build incompatible features if left unanswered. The most urgent is a potential ship blocker: sending contract context (which may contain confidential terms, counterparty names, financial data) to a third-party AI provider without documented legal/compliance review. The second cluster of blockers — error UX, output schema, provider choice, authorization, and structured-vs-free-text context — must be resolved before sprint commitment. The PRD is a strong first draft that needs a focused half-day design session to reach build-ready status.

---

## Before You Build: Critical Questions

*These must be answered before implementation starts. Two engineers cannot independently produce the same feature without resolving them.*

---

### Compliance & Legal

**Q1: Has legal/compliance reviewed the data flow from user contract context to a third-party AI provider?**
- Why this matters: The `context` field will contain confidential contract terms, counterparty names, and financial figures. Under GDPR, CCPA, and typical B2B SaaS DPAs, routing customer data to an AI sub-processor requires disclosure, a DPA with the provider, and potentially customer consent. Enterprise customers may contractually prohibit this. This is the one question whose answer could block the entire feature.
- Found by: gaps (missing requirements), stakeholders
- Suggested answer options: (a) Legal has reviewed — DPA with provider exists, user consent/ToS updated; (b) Legal review is a prerequisite gate before implementation; (c) Feature is internal-only, outside regulated scope — document this explicitly

**Q2: Does the UI need to warn users that context they provide — including third-party information — will be sent to an external AI provider?**
- Why this matters: Counterparties whose information appears in the context field have not consented to AI processing of their data. Even if Agreement Hub users consent, third-party data subjects have rights in many jurisdictions. A brief disclosure notice before submission is low-cost and may be legally required.
- Found by: stakeholders, gaps (missing requirements)
- Suggested answer options: (a) Yes — add a "your input will be processed by [Provider]" disclosure; (b) No — covered by existing ToS; (c) Include a UI guidance note advising users not to include counterparty-identifying information

---

### Provider & Architecture

**Q3: Which AI provider is selected for v1?**
- Why this matters: Provider choice is a hard prerequisite. It determines which SDK to install, which auth format to use, how structured JSON output is achieved (Anthropic tool use vs. OpenAI `response_format`), and what error codes need handling. The "provider-agnostic abstraction" the PRD wants is harder to design correctly before knowing what is being abstracted. Implementation cannot meaningfully begin without this.
- Found by: feasibility, scope
- Suggested answer options: (a) Anthropic Claude (mentioned as likely — confirm); (b) OpenAI; (c) Defer — but then pick a concrete fallback and design the abstraction speculatively

**Q4: What does "provider-agnostic enough to swap" mean concretely — and is it a v1 hard requirement or a soft goal?**
- Why this matters: If it means a formal TypeScript interface + factory that use cases 2–5 must import, that is 1–2 extra days of design work beyond the endpoint itself. If it means "AI calls isolated in one module with clear inputs/outputs," it is a style guideline. Both interpretations claim compliance with the spec. Resolving this eliminates the most significant scope-creep vector in the PRD.
- Found by: ambiguity, feasibility, scope, requirements completeness, stakeholders
- Suggested answer options: (a) Formal interface: `AIProvider.generateClause(clause_type, context) => ClauseResult` that future use cases import; (b) Module isolation only — no formal interface, just clean separation; (c) Document in an ADR after v1 ships

---

### Functional Requirements

**Q5: What is the error UX for each failure mode?**
- Why this matters: Error states are not optional. Every failure path needs a defined user-visible behavior before implementation. Without this, each engineer invents their own error UX independently. Failure modes to specify: (1) API key missing or invalid, (2) Provider 5xx / unreachable, (3) Rate limit hit, (4) Model returns malformed JSON, (5) Model declines (content policy), (6) Network timeout.
- Found by: ambiguity, feasibility, requirements completeness, gaps (missing requirements) — **all four analysis legs flagged this**
- Suggested answer options per mode: generic "Something went wrong" toast / specific actionable message / inline callout / retry button. Also: is the Generate button hidden/disabled when no API key is configured?

**Q6: What is the complete output schema for `risks[]`?**
- Why this matters: The PRD specifies `{ text, explanation, risks[] }` but not the schema of array items. Without this, frontend and backend will make incompatible choices. Open question #7 in the PRD asks about severity tagging without resolution.
- Found by: ambiguity, requirements completeness, feasibility
- Suggested answer options: (a) `risks: string[]` — flat list, no severity; (b) `risks: { text: string, severity: "low" | "medium" | "high" }[]` — severity in v1; (c) Define a concrete schema now and treat any deviation as a generation error

**Q7: Is the `context` field a single free-text textarea or structured form fields?**
- Why this matters: The Goals say "user provides structured inputs," but the Rough Approach shows `context?: string` (free text). These produce entirely different UIs and prompt engineering approaches. A textarea means one implementation; structured fields (party type, deal type, liability cap) means another. Both cannot be called correct based on the current spec.
- Found by: ambiguity, scope
- Suggested answer options: (a) Single free-text textarea; (b) Named structured fields assembled into a context string before sending; (c) Start with free text — structured fields are v2

**Q8: What is the v1 clause type list, and is it fixed or configurable?**
- Why this matters: The UI needs the list to render the control; the backend prompt is built around clause type; QA needs it to write tests. The seven examples in Open Question #2 (NDA, limitation of liability, IP assignment, force majeure, indemnification, payment terms, termination) look complete for v1 — declaring them the list eliminates a negotiation during implementation.
- Found by: ambiguity, requirements completeness, scope
- Suggested answer options: (a) The seven PRD examples are the v1 list — hardcoded; (b) Free-text input, no fixed list; (c) Dropdown with seven examples, extensible via config file

**Q9: What auth middleware protects `/api/clauses/generate`, and which user roles can invoke it?**
- Why this matters: Without explicit auth protection, this endpoint is a publicly callable API that costs money per request. The PRD does not specify authentication requirements or role-based access. This is a security gap and a financial risk.
- Found by: gaps (missing requirements), stakeholders
- Suggested answer options: (a) Same session auth as all other `/api/` routes — all authenticated users can access; (b) All authenticated users plus explicit middleware verification; (c) Role-gated — specify which roles

---

## Important But Non-Blocking

*Implementation can start, but these need resolution before the feature ships to real users.*

- **Timeout behavior**: The "under 30 seconds" goal has no failure condition. Define: (a) backend timeout value, (b) what the user sees if it fires, (c) whether there is a cancel button. Without this, a slow provider holds connections open indefinitely. *(flagged by: ambiguity, requirements completeness, gaps)*

- **Rate limiting decision**: Open Question #8 is unresolved and creates live financial risk. Recommended: explicitly choose between (a) defer entirely to v2 with documented risk, or (b) add a simple per-session throttle (e.g., N requests/min). "No per-user metering" and "no rate limiting" are different decisions. *(flagged by: ambiguity, feasibility, scope, gaps)*

- **Legal disclaimer**: The PRD targets non-lawyers generating clause text for real contracts with no "not legal advice" disclaimer. In some jurisdictions, this may create operator liability. Decision required: where does the disclaimer appear, and is it dismissable? *(flagged by: scope, gaps, requirements completeness)*

- **Clause text format**: The Rough Approach says "formatted clause text (copyable)" but does not specify Markdown, plain text, or HTML. Copy-to-clipboard behavior depends on this. Markdown that renders in the UI but copies as raw source creates a frustrating paste experience. *(flagged by: ambiguity, feasibility)*

- **Testing strategy**: No test framework is installed in either package. CI cannot be meaningful for an AI endpoint without deciding between (a) mock the provider (fast, cheap, must maintain mock contract) or (b) real key in CI (costly, honest). Recommendation: mock in CI, real calls in local dev only. *(flagged by: feasibility, requirements completeness, scope)*

- **Model version pinning**: Using a mutable alias (e.g., `claude-3-5-sonnet-latest`) means provider-side model updates can silently break the JSON output schema. Pin to a specific version. *(flagged by: gaps)*

- **Operator/support story**: Who receives a cost spike alert? Who can disable the feature without a code deployment? Who has audit log access to debug a bad generation? The PRD positions these as out of scope but doesn't name the operator at all. *(flagged by: stakeholders, gaps)*

- **Contradiction — Non-Goal vs. Scenario 2**: Non-Goals state no jurisdiction-specific content, but Scenario 2 shows risk notes flagging jurisdictional variation. Resolution: should the model be instructed to avoid jurisdiction-specific content, or is jurisdiction-flagging at the "consult counsel" level acceptable? *(flagged by: ambiguity)*

---

## Observations and Suggestions

- **The seven PRD example clause types are almost certainly the right v1 list.** Declaring them the list eliminates a negotiation during implementation. NDA, limitation of liability, IP assignment, force majeure, indemnification, payment terms, termination — this covers most common commercial contract clauses.

- **Copy-to-clipboard is not mentioned but is near-certain to be needed.** The PRD says "user pastes manually" but does not specify a copy button. Without one, users must manually select generated text in a modal — awkward for a multi-paragraph clause. Easy to add, easy to miss.

- **The "reusable AI call pattern" goal should be expressed as a concrete deliverable**, not a product acceptance criterion. Suggestion: an ADR or interface definition (`AIProvider.generateClause(...)`) that use cases 2–5 must import — something that can be reviewed at handoff.

- **Legal reviewer persona has no user story.** Listed as "secondary/consumer of output" but no scenario shows a legal reviewer using the feature. If they only consume output, they aren't an actor — which is fine, but should be stated explicitly to avoid legal teams feeling overlooked.

- **The Clause Library design dependency should be flagged explicitly.** v1's ephemeral-by-design constraint means users will learn to generate clauses they cannot retrieve later. When use case #5 (Clause Library) ships, either the design is retrofitted or users have lost all prior generations. Flagging this now is low-cost.

- **Add one failure user scenario.** All three current scenarios (Alice, Bob, Carol) show successful generation. A single "Alice sees a provider timeout" or "Bob hits a missing API key" scenario would significantly strengthen the error UX requirements.

- **Observability baseline should be in scope.** No logging, metrics, or alerting means the first sign of a feature break or cost spike is a user complaint or invoice. Minimum: log per-request latency, provider errors, and request volume. This is 1-2 hours of work and prevents the first production incident from being invisible.

---

## Confidence Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirements completeness | M | Happy path well-specified; error states, auth, and input schema unaddressed |
| Technical feasibility | M-H | Stack is well-suited; three decisions (provider, error UX, output schema) block start |
| Scope clarity | M | Non-goals are strong; "reusable pattern" goal is the primary scope-creep risk |
| Ambiguity level | M | Core concept clear; 6 implementation-blocking ambiguities unresolved |
| Overall readiness | M | Strong foundations; not build-ready until Q1–Q9 above are answered |

---

## Next Steps

- [ ] Human answers critical questions Q1–Q9 above
- [ ] Legal/compliance review of AI data flow (Q1–Q2) — potential ship blocker, start immediately
- [ ] Updated PRD with answers to Q1–Q9 committed as bead notes
- [ ] Pour `design` convoy to generate implementation plan once critical questions resolved

---

*Synthesized from 6 leg analyses: ambiguity, feasibility, gaps (missing requirements), requirements completeness, scope, stakeholders.*
*Review date: 2026-05-16*
