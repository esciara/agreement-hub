# Stakeholder Analysis

## Summary

The PRD identifies two actors — a "contract drafter" (primary) and a "legal reviewer" (secondary) — but a much larger set of stakeholders is implicated. Operators who configure and pay for the AI provider, the security/compliance team whose policies govern data sent to third-party APIs, the support team who field complaints about AI-generated legal content, and future engineering teams who inherit the "reusable AI pattern" are all materially affected and entirely absent from the PRD.

Several of these omissions create real conflicts. Operators bear cost and liability risk the PRD defers to post-v1. Users want jurisdiction-appropriate, accurate clauses; the PRD explicitly excludes jurisdiction-specific output with no user-visible warning. The "risk notes" feature edges into legal advice territory that legal/compliance should have reviewed but apparently haven't. These are not hypothetical concerns — they are structural gaps that will generate friction at launch or shortly after.

---

## Findings

### Critical Gaps / Questions

**1. No liability or disclaimer strategy for AI-generated legal content**
- The PRD offers "risk notes" as an output, which is substantively legal risk analysis. Providing risk analysis to non-lawyers, without a disclaimer that this is not legal advice, exposes the product to UPL (unauthorized practice of law) concerns in some jurisdictions.
- Why this matters: A user relying on an AI-generated clause that turns out to be inadequate or jurisdiction-inappropriate has no warning it was AI-generated, and no disclaimer was shown. The product operator becomes the implicit guarantor of quality.
- Suggested question: Has legal reviewed whether the "risk notes" output, presented to non-lawyers, constitutes legal advice under applicable law? What disclaimer language is required at the point of generation?

**2. Data privacy: contract content sent to a third-party AI provider**
- The clause "context" field allows users to describe contract specifics (e.g., "SaaS vendor, B2B, capped at 12 months of fees"). This can include commercially sensitive terms, counterparty names, or deal structure. That content will be transmitted to a third-party AI provider.
- Why this matters: Agreement Hub users' contracts may be governed by NDAs or contain trade secrets. Sending them to a third-party LLM without disclosure or consent may violate those agreements or applicable privacy law (GDPR, CCPA). The PRD says nothing about what data goes to the provider, provider data retention, or user disclosure.
- Suggested question: What is the data handling policy for content transmitted to the AI provider? Does the provider's terms allow sending user contract content? Does this require a privacy policy update or user consent disclosure?

**3. Operator cost accountability with no metering or alerting**
- The PRD explicitly defers "no per-user metering in v1" but acknowledges "cost per call unknown until provider is chosen." There is no mention of cost monitoring, budget caps, or alerting.
- Why this matters: A single power user generating dozens of clauses per day could drive unexpected API spend. Operators have no visibility into this until a bill arrives. Without at minimum a server-side call log, there is no way to audit or recover from cost spikes.
- Suggested question: Who is responsible for monitoring API costs post-launch? Is there any cap, alert threshold, or per-period budget? If a cost spike occurs, who is notified and how?

**4. No support escalation path for AI errors or harmful output**
- The PRD describes error cases (API key missing, provider down) at the UX level but does not describe what happens when the AI generates something legally wrong, culturally inappropriate, or actively harmful.
- Why this matters: Support teams will inevitably receive "the AI told me X and it was wrong" tickets. Without a feedback mechanism, escalation path, or even internal documentation of the AI provider and prompts in use, support has no tools to investigate or respond.
- Suggested question: What is the expected support volume for AI-output complaints? Is there a feedback mechanism (e.g., "flag this output") or is all post-generation recourse informal?

---

### Important Considerations

**5. Operators are an unstated but central stakeholder**
- "Operator-configured via env var" implies a distinct administrator role who installs, configures, and maintains the API key. The PRD does not describe who operators are, what their technical sophistication is, or what operational tooling they have.
- This matters for: key rotation (is there downtime? a health check endpoint?), multi-environment management (dev/staging/prod keys?), and monitoring. A missing or expired key silently breaks the feature for all users.
- Suggested question: Who are the operators in practice — IT, DevOps, the founding team? What does key rotation look like, and does that need a documented runbook?

**6. Future engineering teams inherit the AI abstraction pattern**
- The PRD explicitly positions this feature as establishing "the AI integration pattern... the rest of the roadmap depends on." The 4 downstream AI use cases (Risk Reviewer, and 3 others) will be built on whatever pattern is established here.
- If the pattern is under-designed (no provider abstraction, no structured error taxonomy, no prompt versioning), all subsequent features inherit that debt. Conversely, over-engineering delays v1 unnecessarily.
- Suggested question: What is the minimum viable abstraction layer that future use cases need? Who owns the AI client module going forward — is there a tech lead designated for AI infrastructure?

**7. Legal reviewers as consumers of AI output, not just secondary actors**
- The PRD positions "legal reviewer" as a secondary actor who consumes the drafter's output. But legal reviewers seeing AI-generated clauses that mimic attorney-crafted text without visible provenance may not recognize them as AI-generated.
- This is a trust and process concern: legal workflows often assume human authorship. An AI-generated clause that looks "polished" may receive less scrutiny than a rough draft.
- Suggested question: Should generated clauses be watermarked or labeled as AI-generated when pasted into the contract body? How does the current workflow distinguish AI-assisted from human-written text?

**8. Prompt ownership and versioning is unassigned**
- The PRD asks "who owns the prompts?" as open question #4 but does not resolve it. Prompts directly determine output quality for legal content — they are product artifacts as much as code.
- If prompts are not version-controlled and owned, they will drift without audit trail, which matters for reproducibility ("why did the generator produce X last week vs. today?") and quality regression detection.
- Suggested question: Who owns prompt authorship — product, engineering, or legal review? How are prompts versioned and tested for quality regression?

---

### Observations

**9. Contract counterparties are indirectly affected**
- The people who sign contracts drafted with AI-generated clauses have no awareness that AI was involved. This is not necessarily a problem, but it's worth noting as a future disclosure question if AI-drafted legal agreements attract regulatory attention.

**10. Third-party integrators are not currently relevant but may become so**
- Agreement Hub's future roadmap isn't described, but if it ever exposes an API, the AI generation endpoint could become part of that surface. The v1 design (no auth, operator-key-only) would be inappropriate for a multi-tenant API product. This is low priority for v1 but worth flagging as a constraint on the API design.

**11. Rate limiting deferred but not fully dismissed**
- Open question #8 asks about rate limiting. The implicit answer from the non-goals ("no per-user metering") is "not in v1." This is reasonable, but the decision should be documented so it's not re-litigated at every sprint review.

---

## Confidence Assessment

**Medium.** The PRD is clear about what it builds and what's out of scope for v1. The gaps identified here (liability, data privacy, operator accountability) are real and likely known to the team, but they've been left for post-v1 resolution. The risk is that "post-v1" never arrives and these gaps become permanent. The data privacy concern (contract content to third-party LLM) is the one item that may require action before launch, not after — it is a legal compliance question, not an engineering one.
