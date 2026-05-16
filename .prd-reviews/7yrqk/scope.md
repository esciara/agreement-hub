# Scope Analysis

## Summary

The PRD has a solid Non-Goals section that explicitly excludes clause persistence, multi-turn conversation, streaming, fine-tuning, and automated insertion into contracts. These are the right calls and will hold — provided they're communicated to stakeholders before launch. The scope problem is not what's excluded but what's left undefined inside the included scope: the provider choice, the clause type list, the structured-output decision, and the "reusable AI call pattern" goal are all open in ways that will generate significant scope during implementation rather than before it.

The secondary risk is the "establishes a reusable AI call pattern" goal. It's listed alongside user-facing goals but is actually an engineering infrastructure goal. Left unspecified, it gives implementers permission to build an abstraction layer that the PRD doesn't actually require — scope creep wearing the costume of a stated goal.

---

## Findings

### Critical Gaps / Questions

**1. No AI provider decision — but it blocks everything**
- The PRD lists provider choice as an open question. It's not: it's a hard prerequisite for picking an SDK, writing the prompt, estimating token costs, and sizing the API error surface. Implementation cannot begin without this decision.
- Why this matters: Choosing Anthropic vs. OpenAI affects SDK installation, prompt format (system/user structure, JSON mode support), response parsing, and error handling. A "provider-agnostic abstraction" built before a provider is chosen will be speculative and likely wrong.
- Clarifying question: Can the team pick a provider now and treat swappability as a future concern? If not, what is the actual timeline constraint forcing the abstraction?

**2. Clause type list is not defined**
- The PRD gives 7 examples (NDA, limitation of liability, IP assignment, force majeure, indemnification, payment terms, termination) but does not commit to a list. "Dropdown of common types or free-text entry" is presented as an open question, not a decision.
- Why this matters: The clause type list determines the dropdown values, prompt variants (if any), and the test surface. Leaving it open means it will be negotiated during implementation. The 7 examples look complete enough for v1 — they should be declared the list.
- Clarifying question: Are the 7 examples in Open Question #2 the intended v1 list? If yes, commit to them. If free-text is preferred, what's the validation rule?

**3. "Reusable AI call pattern" goal is underspecified**
- Goals include "Establishes a reusable AI call pattern... the rest of the roadmap depends on." This is different from "we'll write good code." It implies an explicit interface that use cases 2–5 must conform to.
- Why this matters: If it means a TypeScript interface + factory pattern that future use cases import, that's a significant design task beyond the clause generator itself. If it means "well-structured code with clear separation of concerns," it's just normal engineering. The difference is days of scope.
- Clarifying question: Is the "reusable pattern" an explicit code contract (interface, adapter class) that use cases 2–5 will be required to implement, or is it just the convention established by doing v1 thoughtfully?

**4. Legal disclaimer not addressed**
- The PRD targets non-lawyers generating clause text for real contracts. There is no mention of a "not legal advice" disclaimer anywhere — on the UI, in the response, or in the constraints.
- Why this matters: Depending on jurisdiction and organization, generating contract text without a disclaimer could create legal exposure. This is a legal/compliance question, not a product question, but its answer could require UI scope (a required disclaimer, a terms-of-use gate, etc.).
- Clarifying question: Has legal reviewed whether generated clause output requires a disclaimer? If yes, where does it appear and is it a launch blocker?

**5. Structured output commitment is deferred**
- The PRD identifies "parse structured output vs. free-text" as a key decision but explicitly defers it. This decision determines backend implementation: whether to use JSON mode, how to handle parsing errors, and how fragile the response-to-UI pipeline is.
- Why this matters: Free-text parsing adds a fragile parsing step. JSON mode (where supported) is more reliable but provider-dependent. The decision should precede implementation, not be made during it.
- Clarifying question: Can the team commit to structured JSON output now? If the chosen provider supports JSON mode, that's the right call — it should be stated in the PRD.

---

### Important Considerations

**Rate limiting is implicitly required but not scoped**
- Open Question #8 asks "any throttle needed in v1?" The answer should default to yes: without rate limiting, a single user or a runaway client can exhaust API budget. The PRD lists no per-user metering, which makes a basic throttle (per-IP or per-session) more important, not less.
- Suggested action: Add a non-goal ("No per-user metering") and an explicit in-scope item ("Basic rate limiting: N requests per session per minute") or make a conscious decision to accept the risk.

**"Provider-agnostic enough to swap" is scope in disguise**
- The constraints say the backend abstraction "should be provider-agnostic enough to swap." This is an engineering requirement that could consume significant time. For v1 with one provider, "agnostic enough" should mean: the prompt construction and response parsing are isolated in one module, not mixed through the route handler. That's a style guideline, not an abstraction layer.
- Suggested action: Define "agnostic enough" concretely, e.g., "AI calls are isolated in a single service module with clear inputs/outputs. No provider-specific types leak into route handlers."

**Risk notes could be cut for a smaller MVP**
- The core value proposition is "generate ready-to-use clause text." Explanation and risk notes are additive. If implementation is complex or timelines are tight, risk notes are the first thing to cut without losing core value.
- Suggested action: Consider explicitly phasing: MVP = clause text + explanation; Phase 1.5 = risk notes added. This gives a natural fallback if the structured output decision or prompt engineering is harder than expected.

**Testing strategy affects CI scope and cost**
- Open Question #9 (real key vs. mock in CI) should be resolved before implementation. Real keys in CI add security considerations (key rotation, secret management in CI environment) and per-run cost. Mock strategy requires building a mock provider module — that's a non-trivial test infrastructure task.
- Suggested action: Decide now. Recommend mocking the AI provider in CI (returning a fixed structured response) and testing real AI calls in a local dev-only environment. The mock module scope should be estimated.

**Context field is unbounded**
- The backend accepts `context?: string` with no defined maximum length. Long context strings increase token cost and could push responses into error territory. This is a minor but real gap.
- Suggested action: Add a max length constraint (e.g., 500 characters) to the PRD as a constraint. This is trivial to implement and prevents abuse.

---

### Observations

**Day-one requests that conflict with non-goals**
The non-goals list is good, but stakeholders will ask for these the day after launch. Worth communicating now:
- "Can it insert the clause directly into my contract?" (no automated insertion)
- "Can I save a clause I liked?" (no persistence — Clause Library is use case #5)
- "Can I refine it by asking follow-up questions?" (no multi-turn)
- "Add a disclaimer that this isn't legal advice" (not mentioned anywhere)

**UI placement decision has real scope implications**
Open Question #1 (modal vs. route vs. sidebar) is not cosmetic: modal is simplest (no routing changes, no layout changes); standalone route requires routing and nav changes; sidebar panel requires layout restructuring. This should be decided before UI implementation starts, not during.

**"Reusable pattern" goal creates future retroactive scope**
If use cases 2–5 (including the AI Risk Reviewer) need capabilities not established in v1 (e.g., streaming, multi-turn), the "pattern" established here may need to be refactored when building use case #2. The PRD should either (a) briefly describe what the pattern covers and doesn't cover, or (b) remove the goal and replace it with "use case #2 will adopt the integration structure from v1."

**The 7 example clause types are probably the right v1 list**
NDA, limitation of liability, IP assignment, force majeure, indemnification, payment terms, termination — this covers the most common commercial contract clauses. Declaring this the v1 list eliminates a debate. Defer "all clause types" or "free-text" to Phase 2.

**Prompt ownership gap**
Open Question #4 asks "who owns the prompts?" This is a governance question: if the generated clause quality degrades (model update, prompt regression), who is responsible for fixing it? This isn't blocking implementation but will matter when something goes wrong post-launch.

---

## Confidence Assessment

**Medium**

The PRD's non-goals section is clear and well-considered, and the user stories are grounded. The scope of the UI and the backend endpoint is understandable from the description. However, five critical questions (provider choice, clause type list, "reusable pattern" definition, legal disclaimer, structured output commitment) are left open in ways that will generate implementation-time scope debates. The "reusable AI call pattern" goal is the highest scope creep risk: it's vague enough to justify building an abstraction layer that v1 doesn't need. Resolving the critical gaps before implementation starts would raise this to High.
