# Scope Analysis

## Summary

The AI Clause Generator PRD has a disciplined Non-Goals section that explicitly rules out the most dangerous scope magnets: persistence, iterative refinement, streaming, and automated insertion. This is the PRD's greatest strength. However, several in-scope requirements carry embedded scope-creep risk that the Non-Goals section does not address: the "reusable AI call pattern" goal turns a user feature into an architectural deliverable, the "provider-agnostic" constraint is a v2 concern in v1 clothing, and the `risks[]` output component will generate immediate demand for the AI Risk Reviewer (use case #2) before it launches. The feature as scoped is buildable and appropriately lean, but three requirements should be examined for demotion to Phase 2 before a sprint begins.

The MVP is well-identified: generate clause text from structured inputs. Everything else — explanation, risk notes, provider abstraction, and JSON output structure — is enhancement layered on top of that core. The PRD would benefit from explicitly stating which output components are v1 requirements versus v1 additions that could be deferred without losing core value.

---

## Findings

### Critical Gaps / Questions

**1. "Reusable AI call pattern" is an architectural goal masquerading as a user feature**

The PRD's Why Now states: "Establishes a reusable AI call pattern (API key management, prompt structure, streaming/non-streaming response) the rest of the roadmap depends on." This goal appears alongside user-facing goals (generate a clause in 30 seconds, include explanation and risk notes) but it is not a user goal — it is an implementation quality target.

This framing creates a scope problem: any implementation decision that makes the pattern more reusable can be justified as fulfilling a stated goal, even if it delivers no incremental user value in v1. A developer reading this will feel pressure to design an abstraction layer, define interfaces, and document the pattern — work that is legitimate for v2 but unnecessary to ship a working clause generator.

*Suggested clarifying question:* "Should the AI call pattern goal appear in the PRD's Goals section, or should it be moved to the Architecture/Rough Approach section as an implementation constraint? Keeping it in Goals implies it's a first-class deliverable that stakeholders will evaluate at launch."

---

**2. The "provider-agnostic" constraint is unscoped and open-ended**

The Constraints section states: "the backend abstraction should be provider-agnostic enough to swap." This constraint has no defined ceiling. "Agnostic enough to swap" could mean: (a) one config file change, (b) one module swap, (c) a full provider interface with injectable clients, or (d) a complete adapter pattern with test doubles for each provider.

Option (a) is one afternoon of work. Option (d) is a week. The ambiguity will cause engineers to over-build, particularly given that the "reusable pattern" goal reinforces the incentive. For v1 with a single known provider (likely Anthropic), this constraint should either be scoped concretely or deferred to v2 when a second provider actually needs to be supported.

*Suggested clarifying question:* "Is provider swap a v1 requirement or a v2 concern? If v1, what is the minimum viable abstraction — changing one file, or something more? If v2, can the constraint be noted as future work rather than a current acceptance criterion?"

---

**3. Risk notes create out-of-order demand for the AI Risk Reviewer (use case #2)**

The generated output includes `risks[]` — risk notes on the clause the AI just wrote. Use case #2 on the roadmap is an AI Risk Reviewer that analyzes existing contract clauses for risk. Users who see risk notes on AI-generated clauses will immediately ask: "Why can't you do this for clauses I didn't generate?" The features are adjacent enough that users will not experience them as separate use cases.

This is not a reason to cut risk notes from v1 — they are explicitly required and add real value. But the launch communications and UI should set expectations clearly, or the support queue for use case #2 will fill before it ships. More importantly, the PRD should acknowledge that `risks[]` creates a natural migration path: the same risk analysis that runs on generated text should eventually run on arbitrary clause text. If the v1 implementation hard-codes risk analysis as part of generation rather than as a separable component, use case #2 will require more rework.

*Suggested clarifying question:* "Should the risk analysis component of generation be designed as a separable call (generate clause → separately analyze risk) so use case #2 can reuse it, or is tight coupling acceptable in v1 with a planned refactor before use case #2?"

---

### Important Considerations

**The `context?: string` field is scope-uncontrolled**

The optional context field allows users to provide arbitrary background for clause generation. The PRD does not cap its length or define what "context" means for different clause types. In practice, users will paste entire contract sections, prior clause text, deal summaries, or party descriptions into this field — uses the PRD doesn't anticipate.

An unconstrained context field also makes the 30-second latency goal harder to guarantee: longer context means larger prompts, which means slower and more expensive calls. This is not a scope-creep risk in itself, but without a defined ceiling, it becomes one — every new way users try to use the field becomes an implicit feature request.

The Non-Goals section does not address this. A one-line input constraint ("context is limited to N characters; it is intended for brief deal-specific parameters, not full document content") would prevent the field from becoming an unbounded feature surface.

---

**The clause type list is an ongoing scope commitment**

Whether clause types are a fixed dropdown or free-text, maintaining the clause type list is an ongoing editorial commitment the PRD does not acknowledge. A fixed list of 7 types (NDA, limitation of liability, IP assignment, force majeure, indemnification, payment terms, termination) will generate immediate requests for additional types post-launch. Industry-specific clauses (non-compete, arbitration, data processing agreements, SLAs) are predictable first requests.

The PRD should state explicitly whether clause type expansion is a v1 backlog item, a v2 feature, or self-serve (free-text). If it's a managed list, someone owns it and that ownership should be named. An unowned list is a scope risk because each addition looks like "just one more row in a dropdown" until there are 50 of them requiring prompt tuning and QA.

---

**The "no automated insertion" non-goal creates a UX gap that will be immediately requested**

The Non-Goals section explicitly rules out automated insertion into the contract body — the user must paste manually. This is a reasonable v1 constraint. However, users generating clauses within the contract edit view will immediately experience the friction of switching from a modal back to the editor, finding the right place, and pasting. "Just add an Insert button" will be the first post-launch request.

The PRD correctly defers this, but it should acknowledge this gap explicitly in the Non-Goals with a rationale ("Manual paste is sufficient for v1; one-click insertion will be addressed when the editor's clause model is better defined"). Without the rationale, the non-goal reads as an oversight and stakeholders will push to add it mid-sprint.

---

**Observability and cost monitoring are missing from scope entirely**

The feature makes paid AI API calls on behalf of users with no per-user metering, no rate limiting (deferred), and no cost visibility. The PRD does not scope any observability tooling: no request logging, no latency tracking, no cost dashboard. "Cost per call unknown" is listed under Open Constraints, which means the team will discover actual costs only after launch.

This is not a reason to block launch, but it is a scope gap: the team will either need to add monitoring reactively (a post-launch firefight) or accept operating blind on a cost-accruing integration. At minimum, a log line per API call (timestamp, clause type, latency, provider response status) should be in scope. Everything more sophisticated can be deferred.

---

**The "no save" constraint creates an implicit session-dependency the PRD doesn't acknowledge**

Non-Goal: "generated clauses are ephemeral unless the user copies them." This means if a user generates a good clause, closes the modal without copying, and reopens the modal, it is gone. The PRD doesn't acknowledge this as a deliberate user experience decision or specify whether the modal should warn users before closing if output is present.

Users who lose generated output will report it as a bug, not as expected behavior. "The modal should warn me if I'm about to discard my generated clause" is a predictable support ticket. A one-sentence UX spec ("the modal provides no persistence and no discard warning in v1") would set expectations and prevent this from being reopened as a bug mid-sprint.

---

### Observations

**The Non-Goals section is correctly structured and should be preserved**

The Non-Goals section successfully rules out the six most dangerous expansion paths: persistence, multi-turn, streaming, fine-tuning, jurisdiction-specific requirements, and automated insertion. These are exactly the right things to exclude from v1. The scope boundary is well-drawn — the risk is from within the in-scope requirements, not from outside.

**The MVP is the clause text field alone**

If the team needed to cut scope to ship faster, the minimum deliverable is: `{ clause_type } → { text }`. The explanation and risk notes add substantial user value but are enhancements on top of raw clause generation. A staged delivery (clause text first, explanation + risks in v1.1) would be smaller and faster. The PRD does not acknowledge this option; it treats all three output fields as a single atomic requirement. Stating explicitly whether the three output components are jointly required or independently shippable would make tradeoff conversations easier.

**The "it establishes the AI pattern" framing adds implicit coupling to subsequent roadmap items**

The PRD frames the clause generator as unblocking use cases #2-#5 by "establishing the AI integration pattern." This framing is useful for prioritization but creates implicit coupling: if use cases #2-#5 depend on this pattern, then architectural decisions in this feature are constrained by what those future use cases will need. The PRD does not describe what those future use cases need from the pattern, which means the pattern cannot actually be designed to serve them. The "establishes a pattern" goal is actionable only if the future requirements are known. Otherwise it's aspirational language that will add unscoped work.

**Natural seams for future phases**

- **Phase 2**: One-click insert into contract body (requires editor clause model)
- **Phase 2**: Clause persistence / saved clause library (use case #5)
- **Phase 2**: Re-analyze existing clause text for risk (use case #2) — reuses `risks[]` component
- **Phase 2**: Iterative refinement ("make this more favorable to the vendor") — explicitly deferred
- **Phase 3**: Jurisdiction-specific variants — explicitly deferred, high complexity

The seams are clean and well-identified. The risk is that the risk notes component (Phase 2 reuse) is not implemented with reuse in mind.

---

## Confidence Assessment

**Medium-High**

The scope boundary is well-drawn and the Non-Goals section is strong. The feature is appropriately small for a v1. The primary scope risks are internal: two in-scope requirements (the "reusable pattern" goal and the "provider-agnostic" constraint) are open-ended and will drive over-building if not explicitly bounded. Resolving those two constraints — either scoping them concretely or demoting them to v2 — would move this to High confidence that the scope is implementable without expansion.

The most likely post-launch scope pressure: (1) clause library/saving (deferred to use case #5 but will be requested immediately), (2) one-click insert (explicitly deferred, will be the top support request), (3) risk analysis on existing clauses (logical extension users will ask for before use case #2 ships). All three are correctly deferred; the risk is that one gets added mid-sprint without a formal scope decision.
