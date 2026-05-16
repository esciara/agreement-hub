# Ambiguity Analysis

## Summary

The PRD is clearly structured and unusually honest about its open questions, but the
language of the stated requirements contains several interpretive landmines. The most
serious is a direct contradiction between a Non-Goal and a user scenario: the Non-Goal
explicitly excludes jurisdiction-specific requirements, while Scenario 2 requires risk
notes to flag jurisdiction-specific gaps. Two engineers would implement opposite behaviors.

A second cluster of ambiguities surrounds vague quality language ("ready-to-use",
"short", "discoverable without cluttering", "fits comfortably") that appears in Goals and
Constraints without measurable definitions. The latency goal — the only numeric success
criterion in the PRD — has an undefined measurement point. And the "Rough Approach"
section is written with imperative language that looks like a decision but is labeled as
rough, leaving developers uncertain about what is decided vs. open.

These are not missing requirements (covered by the completeness and gaps analyses); they
are statements that *are present* but that two reasonable engineers would interpret
differently when writing code or reviewing a PR.

---

## Findings

### Critical Gaps / Questions

**1. Scenario 2 directly contradicts the Non-Goals on jurisdiction**

Non-Goals: *"No support for jurisdiction-specific legal requirements (too complex for v1)"*

Scenario 2: Bob receives risk notes that flag *"'work made for hire' language may not
cover contractors in some jurisdictions"* — an explicitly jurisdiction-specific observation.

These two statements cannot both be true. Either risk notes may flag jurisdiction
differences (Scenario 2), or they may not (Non-Goals). An engineer implementing risk
note generation would produce opposite results depending on which statement they weighted.
A PR reviewer would have no authoritative text to resolve the debate.

- **Why this matters:** The scenario is the only concrete example of what risk notes
  should contain. If jurisdiction references are excluded, the scenario is a bad example.
  If they are included, the Non-Goal needs to be narrowed (e.g., "no
  jurisdiction-specific clause variants" rather than "no jurisdiction references at all").
- **Suggested clarifying question:** "Should risk notes be permitted to mention
  jurisdiction-specific caveats (e.g., 'may not apply in EU jurisdictions'), or must
  risk output be jurisdiction-neutral? Scenario 2 implies yes, the Non-Goals say no."

---

**2. "Under 30 seconds" — measurement point undefined**

The only numeric success criterion in the PRD is: *"Users can generate a ready-to-use
clause draft in under 30 seconds from structured inputs."*

There are at least four plausible interpretations of this:
- From user click to backend response received
- From user click to full UI render of the output
- From backend request to AI provider response (excluding network to browser)
- From the moment the provider is contacted to the moment the provider responds

The choice matters. A backend that responds in 25s but takes another 8s to render in
the browser fails the goal under interpretation 2 but passes under interpretation 1.

There is also no percentile specified. Is 30s the mean? The p95? The p99? A single
provider timeout (often 60s default) would exceed 30s — is that an acceptable outlier
or a violation?

- **Why this matters:** Two engineers would write different acceptance tests. QA cannot
  sign off without knowing exactly what to measure.
- **Suggested clarifying question:** "Does the 30-second goal measure client-side render
  complete or backend response time? Should we treat it as a p95 threshold, or does every
  request need to complete in under 30s?"

---

**3. "Ready-to-use clause draft" — internally contradictory**

The Goals describe the output as *"a ready-to-use clause draft."* The phrase contains
two contradictory signals:

- **"ready-to-use"** implies the clause is complete and can be used as-is with no editing.
- **"draft"** implies the clause is a starting point requiring review and revision.

Scenario 1 reinforces "ready-to-use": Alice "receives clause text she can read,
understand, and paste into her contract" — implying direct use without modification.
Scenario 3 (Carol) also implies the user receives something usable immediately.

But the risk notes in Scenario 2 tell Bob to "follow up with counsel" — implying the
output is *not* ready-to-use and requires professional review.

An engineer designing the UI copy, or reviewing the clause output quality, would reach
different conclusions depending on which reading they adopt: is this a polished final
clause, or a starting-point draft?

- **Why this matters:** Affects output quality bar, UI copy, and whether a disclaimer
  ("review before use") is appropriate or contradicts the product's value proposition.
- **Suggested clarifying question:** "Is the generated output intended to be paste-ready
  without editing, or a structured starting point that users should review? This affects
  how we frame the output UI and what quality bar we target."

---

**4. "One-shot generation" vs. regeneration**

Non-Goals: *"No multi-turn conversation or iterative refinement — one-shot generation only"*

The prohibition on "iterative refinement" is ambiguous with respect to regeneration.
If Alice generates a clause, dislikes it, changes the context field, and clicks Generate
again — is that "iterative refinement" (excluded) or a second independent one-shot
generation (permitted)?

Two engineers would answer this differently:
- Engineer A: the Generate button always triggers a fresh one-shot; clicking it again is
  just a new request; no UI state carries over.
- Engineer B: the feature allows the user to refine inputs and regenerate, which is
  iterative refinement; once generated, the Generate button should be disabled or the
  modal closed.

The UI design of the modal depends on this interpretation (does the modal reset after
generation? Stay open? Show a Regenerate button?).

- **Why this matters:** Affects the frontend component design and the scope of v1.
- **Suggested clarifying question:** "If a user generates a clause and wants to try again
  with different context, is clicking Generate a second time permitted, or does that count
  as 'iterative refinement'?"

---

**5. "Discoverable without cluttering" — competing constraints with no resolution criteria**

The Constraints section says: *"UI entry point should be discoverable from the contract
detail/edit view without cluttering the existing layout."*

"Discoverable" and "not cluttering" are in tension. A large, prominently labeled button
is discoverable but potentially clutters. An icon tucked into a menu doesn't clutter but
may not be discoverable. The PRD provides no criteria for what "discoverable" requires
(placement, labeling, visibility without interaction) or what "cluttering" prohibits
(number of new elements, visual weight, interaction with existing controls).

Where does a "Generate Clause" menu item in a context menu fall? Discoverable enough?
Too hidden to be discoverable?

- **Why this matters:** Two designers presented this constraint would produce different
  solutions with no shared definition to adjudicate them.
- **Suggested clarifying question:** "What makes the trigger 'discoverable enough'? Is it
  sufficient if users find it in a menu, or must it be visible without opening a menu?
  Is there a design spike or wireframe that resolves this?"

---

### Important Considerations

**6. "Short plain-language explanation" — "short" is unresolvably vague**

The Goals state that generated output includes *"a short plain-language explanation."*
Open Question Q6 then asks *"How long should the plain-language explanation be? 1 sentence?
1 paragraph?"* — meaning the PRD acknowledges that "short" is undefined but leaves it open.

Having an undefined term in the Goals section makes the goal untestable. A developer
will pick a length (likely 2–3 sentences) without shared agreement, and there is no
authoritative definition to use for code review or QA acceptance.

- **Suggested clarifying question:** "Can we define a word or character count target for
  the explanation? For example: under 100 words, or a maximum of 2 sentences."

---

**7. "The Rough Approach" — decided or suggestion?**

The "Rough Approach" section uses imperative language ("Add `POST /api/clauses/generate`",
"Install chosen provider SDK", "Build a structured prompt") that reads like a specification.
But it is labeled "Rough Approach" — implying it is a starting point, not a decision.

The section ends with: *"Key decision: Parse structured output from the model (JSON mode
or instructed JSON) vs. parse free-text."* — framing this as still open. But the rest of
the section reads as decided.

Two developers would interpret this differently:
- Developer A: the endpoint, request shape (`{ clause_type, context? }`), and JSON output
  are all decided; they can start implementing.
- Developer B: everything here is a suggestion; they need to discuss before starting.

- **Why this matters:** Causes friction when Developer A starts building from the rough
  approach and Developer B reopens design questions in PR review.
- **Suggested clarifying question:** "Which parts of the Rough Approach are decided
  (endpoint shape, JSON output, no streaming) vs. open for the implementer to determine?"

---

**8. "Provider-agnostic enough to swap" — threshold undefined**

The Constraints section says: *"the backend abstraction should be provider-agnostic enough
to swap."*

"Enough to swap" can mean anything from:
- Same SDK family (e.g., swap Anthropic for OpenAI, both using similar chat APIs)
- A thin wrapper with one provider-specific file that can be replaced
- A formal interface with dependency injection
- Just avoiding hardcoded model names

Without a defined abstraction interface or a concrete example of what a swap looks like,
two engineers would build completely different structures — and neither could be called wrong
based on the PRD text.

- **Suggested clarifying question:** "What should the provider abstraction look like
  concretely? Is a single `generateClause(type, context)` function sufficient, or does
  the abstraction need to match a richer interface for future use cases?"

---

**9. "Should" vs. "must" — priority levels are inconsistent**

The PRD mixes `should`, `must`, `can`, and imperative statements without a defined priority
hierarchy:

- Goals: *"Users **can** generate..."* — possibility, not requirement?
- Constraints: *"**Must** not require database schema changes"* — hard requirement
- Constraints: *"UI entry point **should** be discoverable"* — softer
- Rough Approach: *"Add `POST /api/clauses/generate`"* — imperative, no modal verb
- Constraints: *"the backend abstraction **should** be provider-agnostic"* — softer

RFC 2119 semantics (MUST/SHOULD/MAY) would resolve this, but the PRD mixes styles. An
engineer reading "should be discoverable" might treat it as optional; another would treat
it as a requirement. An engineer reading "Users can generate" might interpret it as
optionally supported rather than a core user capability.

- **Suggested clarifying question:** "Can critical requirements be marked MUST vs. SHOULD
  vs. NICE-TO-HAVE to prevent implementation teams from making different priority calls?"

---

**10. "Fits comfortably in a single non-streaming response" — "comfortably" is unmeasured**

Constraints: *"Response size: clause + explanation + risks fits comfortably in a single
non-streaming response."*

"Comfortably" has no definition. Comfortable relative to what?
- Token limits of the provider (different per model)?
- HTTP response payload size for the frontend?
- Rendering performance in the browser?
- Time-to-first-byte for the user experience?

This appears as a Constraint that justifies the non-streaming decision, but it is
untestable as written. If a future model returns an unusually long clause, there is no
defined threshold to determine whether "comfortably" is still satisfied.

- **Suggested clarifying question:** "Is there a maximum response size target (e.g., total
  tokens, or a word count ceiling for clause + explanation + risks)?"

---

**11. Actor definition: "legal reviewer (secondary/consumer of output)"**

The Actors section lists: *"Contract drafter (primary), legal reviewer (secondary/consumer
of output)."*

"Consumer of output" is ambiguous about whether the legal reviewer interacts with Agreement
Hub at all. There are two interpretations:
- The legal reviewer is a user of Agreement Hub who can also invoke the generator.
- The legal reviewer receives documents that were generated by the contract drafter and
  reviews them outside the system.

Under interpretation 1, the feature's UI access and permissions scope includes legal
reviewers. Under interpretation 2, legal reviewers are outside the system and the actor
listing is informational only.

Scenario 2 (Bob) blurs this: Bob "uses the generator to create a standard IP assignment
clause" — Bob sounds like a drafter using the tool, but the actor section designates
the legal reviewer as secondary. Is Bob a drafter or a reviewer using the tool?

- **Suggested clarifying question:** "Can legal reviewers invoke the clause generator
  themselves, or is 'secondary/consumer' meant to indicate they only see outputs that
  drafters generate? Should both actor types have the same access to the feature?"

---

### Observations

**12. "No multi-turn conversation" — multi-turn is not defined**

The Non-Goal prohibits "multi-turn conversation or iterative refinement." However, the PRD
does not define what constitutes a "turn." Is a second generation request with modified
context a second turn? Is displaying results followed by user copying text a two-turn
interaction? The term is borrowed from chat-AI vocabulary without defining how it maps to
this UI pattern.

**13. "context" field — no guidance on what constitutes valid input**

Alice's context example is specific business context ("SaaS vendor, B2B, capped at 12
months of fees"). Carol "leaves context minimal." Bob provides no context. There is no
description of what context is *for* — is it legal context? Business context? Party
context? Use-case context? Without this, users will enter anything, and the prompt
engineering that depends on context has no defined input space to optimize for.

**14. "Establishes a reusable AI call pattern" — reusability criteria absent**

This Goal is the only forward-looking requirement in the PRD (it exists to benefit future
use cases). But "reusable pattern" has no definition. Is it a module? An interface? A
documented convention? A code template? The downstream use cases that depend on this
pattern are not listed, so there is no way to know what the pattern must support.

**15. "No automated insertion into contract body — user pastes manually"**

The word "automated" is doing heavy lifting here. Is a "Copy" button that copies clause
text to the clipboard automated insertion? Is an "Insert into contract" button the user
explicitly clicks automated? Most engineers would say a user-initiated action is not
automated, but this Non-Goal could be read to prohibit any system-assisted insertion.

---

## Confidence Assessment

**Medium**

The PRD is coherent and well-scoped, and the explicit open questions are the right ones
to ask. However, the language of the stated requirements contains interpretive ambiguity
that will surface in PR review debates rather than in backlog refinement.

The **critical ambiguities** (jurisdiction contradiction, 30-second measurement, ready-
to-use vs. draft, one-shot vs. regeneration) are likely to cause implementation divergence
or rework — not just discussion. The jurisdiction contradiction is the most acute: it is
a direct conflict between a stated Non-Goal and a user scenario that serves as the primary
example of risk note output.

Resolving the five critical items above, alongside the open questions in the completeness
analysis, would bring this PRD to a buildable state where a PR review debate about
requirements language is unlikely.
