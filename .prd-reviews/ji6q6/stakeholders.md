# Stakeholder Analysis

## Summary

The PRD names two actors: a primary contract drafter (non-lawyer) and a secondary legal
reviewer who consumes the output. This is significantly undercomplete. The feature involves at
least seven stakeholder groups whose needs the PRD either ignores or acknowledges only as
technical constraints without surfacing their requirements: the operator who configures and
pays for the AI key, the engineering team who will reuse the patterns this feature establishes,
a security team with data-governance concerns, a finance function exposed to unbounded API
spend, a support team who will field failures they cannot diagnose, and the AI provider whose
terms of service govern legal content generation.

More importantly, the PRD contains latent conflicts between stakeholder needs that will surface
during build or post-launch. The most consequential: drafters want confident, ready-to-use
output, while legal reviewers need risk notes that undermine confidence. The feature resolves
this tension implicitly through UI layout (risk notes displayed alongside clause text), but
the layout decision is still open — meaning the conflict is unresolved. A second conflict
pits drafters who want context-rich generation (including contract excerpts) against a data
governance position the PRD has not taken: every context string is sent to a third-party
AI provider. For legal-sensitive customers, this conflict is a deployment blocker that has
not been surfaced to the right decision-makers.

---

## Findings

### Critical Gaps / Questions

**1. The operator role is described as a constraint, not a stakeholder with requirements**

The PRD states "API key configured via env var — no authentication or API key UI for end
users." This implicitly creates an operator role — whoever deploys and configures the
application — but never defines who that is, what they need to know, or what visibility they
have into the feature's behavior.

Operators need:
- Documentation of which env var to set and what happens if it's missing
- Deployment-time feedback (startup error vs. silent runtime failure) when the key is absent
- Cost visibility: each generation call costs money; operators have no way to see volume or
  spend in v1
- Key rotation UX: what happens mid-session when a key is rotated? Does the server need a
  restart?

The PRD delegates all of this to "env var" and moves on. If the operator is a self-hosting
customer or a technical admin at a business, these are real unmet needs that will produce
support escalations.

- **Why this matters:** An operator who can't detect a misconfigured or rotated key has no
  way to know the feature is silently broken until a user complains.
- **Clarifying question:** Who is the operator — an internal DevOps engineer, a
  self-hosting customer, or the product team itself? What observability does the operator
  need to know the feature is working?

---

**2. The legal reviewer is named as an actor but has zero specified requirements**

Scenario 2 (Bob) uses the generator himself. The actor definition ("legal reviewer —
secondary/consumer of output") implies a legal reviewer who receives output from a drafter
and uses it to evaluate or sign off on contracts. These are meaningfully different use cases.

If the legal reviewer is purely a downstream consumer of copy-pasted clause text, they have
no interaction with the system and don't need to be in the actor list. But if they use the
generator independently — to verify the drafter's output, or to generate alternative
formulations — they may have different needs:

- Higher tolerance for long explanations, lower tolerance for "ready-to-use" framing
- Preference for risk-note prominence over clause text prominence
- Possible need to compare generated text against a known template

The PRD's UI and output format decisions (explanation length, risk note prominence) will be
made without input from this actor because the actor's needs were never stated.

- **Why this matters:** If the legal reviewer is a genuine actor, the UI layout (which of
  clause text vs. risk notes is visually primary) is a decision they should influence. The
  drafter wants the clause text front and center; the legal reviewer wants the risks front
  and center. These conflict.
- **Clarifying question:** Does the legal reviewer use the generator themselves, or only
  consume output that drafters share with them? If they use it, what do they need differently?

---

**3. Security and data governance have no named stakeholder, creating a pre-launch risk**

The context field allows users to paste contract text (excerpts, party names, deal terms)
into a form that sends it to a third-party AI provider. The PRD does not state whether this
is acceptable, and no security or legal stakeholder has been named as having input into that
decision.

For enterprise customers in regulated industries (financial services, healthcare, legal),
sending contract content to an external provider may:
- Violate data residency requirements
- Create confidentiality obligations (attorney-client content in the context field)
- Conflict with vendor data processing agreements
- Trigger GDPR/CCPA concerns if contract content includes personal data (party names,
  addresses, deal terms)

The feasibility and requirements analyses both flag this, but flag it as an observation —
"a one-paragraph position statement would prevent a last-minute escalation." It is more than
an observation: there is currently no decision-maker identified who is accountable for taking
that position. If no one owns this, the default is "ship and handle when it comes up," which
is a higher-risk default for a legal content tool than for most features.

- **Why this matters:** A customer complaint or data governance audit post-launch is harder
  and more expensive to resolve than a pre-launch policy decision. The right stakeholders
  (security, legal counsel, or a designated product owner) need to explicitly take a position
  on what can and cannot go in the context field.
- **Clarifying question:** Who is accountable for the data governance decision about sending
  context content to an external AI provider? Has that person been consulted?

---

### Important Considerations

**4. Finance / cost ownership is unassigned — unbounded API spend is a known risk**

The PRD explicitly defers rate limiting ("Any throttle needed in v1? — Open Question 8") and
notes "Cost per call unknown until provider is chosen — no per-user metering in v1." This
means v1 has no mechanism to limit, track, or attribute API spend. The finance function (or
whoever owns the operational budget for AI API costs) is a stakeholder whose needs are unmet:

- No per-user or per-session metering
- No cost cap or circuit breaker
- No visibility into cost-per-call after provider is chosen
- No alerting if spend spikes

A single misconfigured test loop or a high-traffic demo period could generate significant
unexpected charges. "We accept the risk for v1" is a valid product decision, but it needs
to be a decision — not a default.

- **Suggested approach:** Identify who owns the AI API budget. Have them explicitly sign off
  on "no rate limiting, no metering in v1" rather than letting it be an implicit omission.

---

**5. Engineering team (use cases 2-5) is a stakeholder in architecture decisions being made now**

The PRD states this feature "establishes the AI integration pattern the rest of the roadmap
depends on." This makes the engineers who will build use cases 2 through 5 stakeholders in
the architectural decisions being made now — specifically:

- The provider abstraction interface (they'll implement it for their use cases)
- The async error handling pattern (they'll copy it or work around it)
- The prompt structure convention (they'll adapt it)
- The test mocking strategy (they'll inherit whatever was decided here)

None of the use case 2-5 owners are mentioned in the PRD, and their requirements for the
shared infrastructure are not captured. The feasibility analysis identifies the risk: time
pressure on this feature may produce a working but non-composable pattern that creates
compounding debt across use cases 2-5.

- **Suggested approach:** Before finalizing the provider abstraction design, document one
  or two requirements from use case 2 (AI Risk Reviewer) that the abstraction must satisfy.
  This validates that the pattern generalizes before it becomes the standard.

---

**6. Counterparties to contracts are an invisible downstream stakeholder**

The clauses generated by this feature will be incorporated into contracts signed by other
parties. Those counterparties have an indirect stake in the quality and accuracy of
AI-generated clauses — particularly the risk notes, which flag issues that may be
jurisdictionally incomplete or incorrect (as acknowledged in the Non-Goals section).

This is not a request to add a new feature, but a note that the feature's output reaches
beyond Agreement Hub's users. The lack of any disclaimer in the UI (flagged as Observation
16 in the ambiguity analysis) means the counterparty's interests are protected only by the
drafter's diligence in following up with counsel after seeing risk notes. For some clause
types (limitation of liability, IP assignment), that diligence is the only check on the
clause being included in a binding agreement.

- **Observation:** The UI should include a disclaimer that generated clauses are starting
  points, not legal advice, and are not jurisdiction-specific. This is already implied by
  the Non-Goals section but is not surfaced in the product requirements.

---

**7. Support team has no visibility into the feature's failure modes**

Post-launch, support staff will receive tickets from users who see errors, get blank
responses, or receive clauses they believe are wrong. The PRD provides no:

- Guidance on what error messages users will see (Open Question 5 is unanswered)
- Support runbook for diagnosing "AI generation failed" tickets
- Admin visibility into whether the API key is valid, the provider is reachable, or
  requests are failing

Support's ability to help users is limited to "check the API key" and "wait for the
provider to recover" — both of which require more technical access than typical support
staff have. Without logging or monitoring, support cannot even confirm a reported failure
is real.

- **Suggested approach:** Define at least the user-visible error messages before launch
  (resolving Open Question 5), and document what a support agent should check when a
  user reports the feature is not working.

---

### Observations

**8. The drafter's desire for "ready-to-use" output and the legal reviewer's role create a UI tension**

The drafter wants output they can paste directly into a contract. The legal reviewer's
implicit role is to catch what the drafter missed. The risk notes are the mechanism that
serves both needs simultaneously — but only if they're prominent enough that the drafter
reads them before pasting.

If the UI presents clause text first and risk notes below the fold, a time-pressured
drafter will paste the clause and skip the risks. This serves the drafter's immediate goal
but undermines the legal reviewer's ability to catch issues. The UI layout decision (which
Open Questions 1 and 7 together affect) determines whose needs are prioritized. This
should be an explicit product decision, not an implicit one made by whichever engineer
implements the modal.

**9. The "non-lawyer" framing may understate the actual user population**

The PRD defines the primary user as "non-lawyers (operations, sales, founders)." But in
many Agreement Hub use cases, the drafter may be an in-house legal coordinator or a
paralegal — someone with legal training who would evaluate AI output differently than a
sales person would. These users may want different output characteristics (more detail in
risk notes, more precise legal language) that the v1 prompt design doesn't account for.

This is not a v1 gap, but the user research framing should be confirmed before prompt
engineering decisions are finalized.

**10. AI provider terms of service for legal content generation have not been reviewed**

Major AI providers restrict or have terms around using their models to generate legal
advice or legal documents for third parties. The generated output is explicitly framed as
clause drafts for contracts, not legal advice — but the PRD should confirm that the chosen
provider's terms of service permit this use case, particularly for the commercial/B2B
context described. This is a pre-launch legal review item, not an implementation concern.

**11. Launch coordination stakeholders are unidentified**

The PRD identifies this as "use case #1 of 5" and says it "unblocks the downstream AI
Risk Reviewer." No launch plan, no communication plan, and no stakeholder notification
list is mentioned. For a feature that:
- Adds a new external API dependency
- Changes the cost structure of the product
- Sets patterns for four subsequent features

...the launch coordination surface is larger than a typical feature. Who needs to be
notified? Customer success (so they can brief existing customers)? Sales (new capability to
pitch)? The security or legal team (for any data governance sign-off before GA)?

---

## Confidence Assessment

**Medium.** The PRD's stakeholder picture is significantly incomplete, but the gaps are
identifiable and addressable. The two actors named (drafter, legal reviewer) are correct
but underspecified. At least five additional stakeholder groups have unmet or unstated
needs: operators, security/legal, finance, support, and future engineering teams. Three of
these gaps (security/data governance, operator visibility, finance/cost ownership) could
produce post-launch escalations that a brief pre-launch stakeholder consultation would
prevent. The core feature is coherent and the primary user's needs are well-served — the
incompleteness is in the surrounding infrastructure of accountability and governance, not
in the user-facing feature itself.
