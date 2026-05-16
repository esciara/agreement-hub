# Stakeholder Analysis

## Summary

The PRD explicitly names two actor types — contract drafters (primary) and legal reviewers (secondary) — but the feature affects at least eight additional stakeholder groups that are entirely unmentioned. The most significant omissions are the compliance/legal team (contract content flowing to a third-party AI provider is a data processing decision requiring legal sign-off), the operator/support team (they own the API key, the cost exposure, and the post-launch debugging surface), and the engineering team working on use cases #2–5 (who depend on the AI pattern this feature establishes). Several of these groups have directly conflicting needs: what's best for end-user experience (rich free-text context, no friction) conflicts with what operators, security, and compliance require (input constraints, disclaimers, cost controls, data processing agreements). These conflicts are currently invisible in the PRD and will surface as implementation decisions made by engineers rather than product decisions made deliberately.

---

## Findings

### Critical Gaps / Questions

**1. The compliance/legal team is entirely absent — and they are likely a blocker**

The PRD describes sending user-provided `context` — which may contain confidential contract terms, counterparty names, financial figures, or personal data — to a third-party AI provider. No compliance or legal review is mentioned anywhere. This omission is load-bearing:

- Under GDPR, CCPA, and typical B2B SaaS Data Processing Agreements (DPAs), routing customer data to a sub-processor requires disclosure, a DPA with the provider, and potentially customer consent or notification.
- Enterprise customers frequently prohibit sending contract content to external AI systems. If Agreement Hub has enterprise customers today, some of them may contractually prohibit this use.
- A legal disclaimer for AI-generated clause text (covered in the gaps and missing requirements reviews) is also a legal team decision, not a UX decision.

The compliance/legal team needs to be involved before implementation begins — not at launch, not afterward. This is the one stakeholder group whose absence is a potential ship-blocker.

*Suggested question:* Has the legal/compliance team been consulted on the data flow from user contract context to a third-party AI provider? Are there existing DPAs with prospective providers (Anthropic, OpenAI)? What is the user-facing disclosure requirement?

---

**2. End-users' counterparties are an invisible third party**

Contract drafters frequently include information about the other party to the contract in the context field: "NDA for XYZ Corp, they're a competitor in the payment processing space." The counterparty has no relationship with Agreement Hub, has not consented to their information being sent to an AI provider, and is completely invisible in the PRD.

This is distinct from the general data privacy concern above. It means:
- Even if Agreement Hub's own users consent to AI processing, the counterparty has not.
- This is especially acute in jurisdictions with strong data subject rights (EU).

*Suggested question:* Does the UI need to warn users that context they provide — including information about third parties — will be sent to an external AI provider? Is there a guidance note advising users not to include counterparty-identifying information in the context field?

---

**3. The operator/support team has no story — and owns the cost exposure**

The PRD positions the API key as "operator-configured via env var." This makes someone an operator with financial exposure and zero tooling:

- Who receives the alert when costs spike?
- Who is the support contact when a user says "the clause it generated was wrong"?
- Who can disable the feature if the AI provider has an outage without triggering a full code deployment?
- Who handles the "API key missing" error path before the product ships?

Support teams for legal SaaS products receive complaints about output quality. If a user copies an AI-generated clause into a contract and something goes wrong, the support team needs a debugging path: what inputs were provided, what was returned, what model version was used. Without audit logging (absent from the PRD), they have nothing.

*Suggested question:* Who is the operator for this feature? What does their operational interface look like: cost visibility, error alerting, kill switch, and audit log access?

---

**4. The engineering team for use cases #2–5 is an implicit stakeholder with unresolved dependencies**

One of the four stated goals is to "establish a reusable AI call pattern (provider client, error handling, key config) for subsequent use cases." This goal makes internal engineers a stakeholder in how this feature is designed — specifically, the engineers who will build the AI Risk Reviewer (#2), AI Contract Summary (#3 or similar), and Clause Library (#5).

The PRD does not:
- Identify who those downstream engineers are or whether they've been consulted
- Define what "reusable" means concretely (interface contract, module boundary, documentation)
- Describe how the pattern will be communicated to future implementers

If use case #2 (AI Risk Reviewer) begins before the pattern from #1 is finalized, or if the #1 implementation takes shortcuts "for v1" that are later baked in, the reusability goal fails silently.

*Suggested question:* Who owns use case #2 (AI Risk Reviewer), and have they reviewed the proposed backend pattern in this PRD? What is the concrete deliverable that satisfies the "reusable pattern" goal — an interface definition, an SDK wrapper, an architecture decision record?

---

**5. The finance/procurement team has no visibility into cost exposure**

The PRD acknowledges "cost per call unknown until provider is chosen" and explicitly defers per-user metering. But this creates a stakeholder gap: whoever owns the engineering budget or vendor invoices will receive an AI provider bill with no prior baseline, no alert threshold, and no mechanism to attribute cost to the feature.

This is distinct from rate limiting (a user-facing concern). It is a finance/procurement concern: who approved the ongoing cost, what is the budget, and how will the team know if actual spend exceeds it?

*Suggested question:* What is the approved monthly budget for AI provider spend for this feature? Who receives and reviews the bill? Is there a threshold above which the feature should be automatically disabled?

---

### Important Considerations

**6. Security team is not mentioned — and there is a real attack surface**

The missing requirements review (already filed) covers prompt injection in detail, but from a stakeholder lens: the security team should be a named reviewer for any feature that (a) accepts free-text user input, (b) embeds it in AI prompts, and (c) calls an external paid API. These are exactly the conditions where security review is expected.

Security team needs to see: input validation approach, prompt construction, auth protection on the endpoint, API key storage, and the data flow to the AI provider. None of this has been assigned to them.

*Suggested question:* Has the security team been identified as a reviewer for this feature? Is there a security review checkpoint in the launch process?

---

**7. Enterprise customer procurement teams — an indirect but high-stakes stakeholder**

If Agreement Hub has enterprise customers or aspires to them, procurement teams at those customers will conduct vendor security reviews. A feature that sends contract content to an AI provider will surface questions:
- Which AI provider is used?
- Is there a DPA with that provider?
- Can we opt out of AI features?
- Are generated clauses logged? Where? For how long?

The PRD makes no provision for per-tenant AI feature flags or opt-outs. If a single enterprise customer prohibits AI processing of their data, there is no mechanism to disable the feature for that tenant.

*Suggested question:* Does Agreement Hub have enterprise customers who may require AI feature opt-outs? Should the feature include a configuration flag to disable it per-tenant?

---

**8. The Clause Library team (use case #5) inherits a design decision they didn't make**

The PRD makes generation ephemeral ("no clause library persistence"). This is a reasonable v1 scoping decision. But use case #5 is explicitly a Clause Library — meaning the team building #5 will need to either retrofit persistence onto generated clauses or accept that generated clauses were never part of the library.

The v1 design creates a fork: users learn to generate clauses ephemerally in v1, then discover persistence in v5 but may have no way to recover past generations. This is a downstream user experience problem created now.

*Suggested question:* Has the use case #5 team (or its owner) reviewed the v1 ephemeral design decision? Is there a plan for how generated clauses will integrate with the Clause Library when it ships?

---

### Conflicting Needs Assessment

| Stakeholder A | Stakeholder B | Conflict |
|---------------|---------------|----------|
| End users (rich, unconstrained context input) | Security team (input sanitization, length limits) | More context = better AI output; more context = larger attack surface and cost exposure |
| End users (frictionless UX) | Legal/compliance (disclaimer, consent notice) | Disclaimers and consent prompts add friction to the generation flow |
| Product team (fast v1 delivery) | Engineering team for use cases #2–5 (clean, reusable pattern) | Cutting corners on the abstraction for v1 speed creates rework debt for downstream use cases |
| Finance/operator (cost control) | End users (unlimited, unmetered generation) | Every generation costs money; no throttle means unlimited operator exposure |
| Enterprise customers (data residency / AI opt-out) | Product team (simple, single-configuration deployment) | Per-tenant AI feature flags require infrastructure that adds complexity to v1 |
| Counterparties (privacy of their information) | Contract drafters (want to provide rich context) | Counterparty data in the context field goes to a third-party AI provider without their knowledge or consent |
| Ops/support (observability, kill switch, debugging) | Product team (quick launch, no extra infra) | Logging, alerting, and a feature kill switch add scope that isn't in the PRD |
| Legal reviewer consumers of AI output (accuracy) | Primary non-lawyer drafters (ease of use) | Legal reviewers need jurisdiction-aware, precise text; non-lawyers need simplified, accessible output. The same generated clause serves both, but at different quality bars. |

---

### Observations

- The three user scenarios (Alice, Bob, Carol) are entirely internal — they show Agreement Hub users using the tool. There is no scenario from the perspective of a counterparty whose data appeared in the context, a support agent debugging a bad generation, or an ops engineer waking up to an unexpected AI spend spike. Adding one scenario from each of these perspectives would significantly strengthen stakeholder coverage.
- The PRD uses "operator" to mean "the person who sets the env var" (infrastructure-level), but "operator" in a legal SaaS context also often means "the company that deploys Agreement Hub for their own users." If Agreement Hub is multi-tenant SaaS, these two definitions of "operator" are different stakeholders with different concerns, and conflating them creates ambiguity.
- The legal reviewer is listed as "secondary/consumer of output" — but legal reviewers may actively object to AI-generated clauses being presented as ready-to-use. Some legal teams will want a stronger disclaimer or will push back on the feature entirely. Their buy-in is worth explicitly seeking before launch.
- Launch coordination is entirely absent from the PRD. A feature that introduces AI capabilities, third-party API calls, and legal-adjacent generated content typically requires at minimum a heads-up to legal, support, and (if applicable) enterprise account managers before going live.

---

## Confidence Assessment

**Medium-Low.** The stakeholder picture in the PRD is significantly incomplete. Two stakeholder groups (compliance/legal and operator/support) have needs that intersect with the feature's most critical unresolved questions (data privacy, cost exposure, observability). Their absence means the open questions in the PRD are currently being scoped as engineering decisions when they are actually compliance decisions, financial decisions, and operational decisions. The feature could be built as described — but the risk is that it ships and then needs to be pulled back or retrofitted when compliance or enterprise procurement raises concerns that were answerable before implementation began.
