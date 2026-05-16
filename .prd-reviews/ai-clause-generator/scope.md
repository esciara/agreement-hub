# Scope Analysis

## Summary

The PRD has an unusually disciplined Non-Goals section that correctly rules out persistence,
multi-turn refinement, streaming, and jurisdiction-specific clause variants. However, the
scope contains two structural problems that will generate scope creep from within, not from
outside stakeholders.

First, the PRD bundles two distinct deliverables into one: a user-facing feature (clause
generation) and a platform-building exercise (establishing the "reusable AI call pattern"
for the roadmap). These have different scoping constraints, different success criteria, and
different stakeholders. Conflating them creates pressure to over-engineer the feature in
service of the platform goal — while the platform goal itself has no definition of "done."

Second, the stated Non-Goals protect the current feature from scope creep, but they do not
protect the team from feature-adjacent work that will be discovered mid-implementation:
operator controls, observability, legal disclosure, spend limits, and security concerns are
all absent from the Non-Goals list and absent from the requirements. The day after launch,
at least five categories of follow-up will be immediate.

The MVP core is well-identified in the scenarios: user selects clause type, provides optional
context, receives clause text to paste. Everything beyond that clause text — explanation,
risk notes, provider abstraction, reusable patterns — is additive scope with varying value.

---

## Findings

### Critical Gaps / Questions

**1. "Establishes a reusable AI call pattern" is unbounded platform scope embedded in a
feature PRD**

The second bullet in Goals reads: *"Establishes a reusable AI call pattern (provider client,
error handling, key config) for subsequent use cases."*

This is not a user-facing requirement. It is an architecture objective that serves use cases
#2–#5, none of which are specified in this PRD. The scope of "reusable" is undefined:
- Does "reusable" mean a shared npm module? A TypeScript interface? A documented convention?
  A copy-paste template?
- What interface must the pattern support? The AI Risk Reviewer (use case #2) will have
  different inputs, different outputs, and likely different prompt strategies than clause
  generation. A pattern "reusable" for those use cases cannot be designed without knowing
  what they require.
- Who validates that the pattern is sufficiently reusable before this feature is marked done?

**Why this matters:** This goal creates an implicit deliverable with no definition of done.
It will generate pressure to over-engineer the provider abstraction, error handling strategy,
and key management — not because the user feature needs it, but because "it needs to be a
pattern." A developer cannot know when to stop because "reusable enough for 4 future features"
is not measurable. The pattern work can silently expand the implementation by 1–2 weeks.

**Suggested clarifying question:** "Is the 'reusable pattern' a deliverable that must be
reviewed and accepted separately from the user-facing feature? Or does it mean 'write clean
code that future use cases can follow'? Can we explicitly defer the formal abstraction layer
until use case #2 begins, when we'll know what both use cases need?"

---

**2. Provider-agnosticism is phase-2 architecture presented as a v1 requirement**

The Constraints section states: *"the backend abstraction should be provider-agnostic enough
to swap."*

The provider is effectively decided (Anthropic, per the PRD's own language). The downstream
use cases (#2–#5) are not yet designed. Building a provider-agnostic abstraction now means
designing an interface for four use cases that don't yet exist, to support a swap that has
no stated timeline or trigger.

**Why this matters:** Provider-agnosticism is not free. A thin "swap-ready" wrapper requires:
defining a formal interface, mapping the interface to each provider's distinct API surface
(Anthropic's `tools` API for structured output differs meaningfully from OpenAI's
`response_format`), and testing that the interface actually works with a second provider.
This is real engineering work that delivers zero user value for v1 and zero roadmap value
until use case #2 is scoped.

The actual swap risk is low: the generation endpoint is a single backend file. Swapping a
provider in a single file does not require a formal abstraction layer. If the swap risk were
high (e.g., five existing use cases using different parts of the API), a formal abstraction
would be justified. For use case #1, it is not.

**Suggested clarifying question:** "Is provider swappability a near-term business requirement
(e.g., we expect to switch from Anthropic to OpenAI within 6 months), or a hedge against a
future decision that isn't made yet? If it's a hedge, can we defer the formal abstraction
and rely on the endpoint being self-contained?"

---

**3. The Non-Goals section does not cover operator-facing scope — a blind spot**

The Non-Goals list protects against user-facing feature creep (no library, no streaming, no
multi-turn, no fine-tuning). It is silent on operator-facing scope. The feature's absence
of any operator controls is not called out as a non-goal:

- No spend limit or budget cap
- No feature flag to disable AI calls without a deploy
- No admin visibility into generation activity or errors
- No configuration UI for AI behavior (temperature, model version, system prompt)
- No rate limiting per user or per organization

These are real concerns (several flagged in the gaps analysis) that will be raised by
operators or security review immediately after launch. Because they are not in the Non-Goals
list, the implicit answer is "we haven't decided yet" — meaning a post-launch request for
any of these arrives as an unplanned scope item.

**Suggested clarifying question:** "Can we explicitly list operator controls as out of scope
for v1 with a follow-on ticket, so the launch conversation doesn't become a negotiation?
The minimum to call out: no spend cap UI (key revocation is the kill switch), no admin
visibility dashboard, no feature flag."

---

### Important Considerations

**4. MVP definition: the explanation and risk notes are additive, not core**

The true minimum value unit of this feature is: user provides clause type → receives clause
text to paste. That single output resolves the stated problem ("write clauses from scratch
with no guidance").

The explanation (plain-language description) and risk notes are valuable additions, but
they are not required to deliver the core problem solution. They add prompt complexity,
display complexity, and output format decisions that are all currently unresolved (Q6, Q7).

If the nine open questions (Q1–Q9) are not resolved quickly, an incremental approach would
be lower-risk: ship clause text only in phase 1, add explanation and risk notes in phase 2
once the provider, prompt strategy, and format questions are answered. The user scenarios
still validate with text-only output (Alice pastes a clause; Carol gets a working clause
even without the explanation).

The counter-argument: Scenario 2 (Bob's risk awareness) and Scenario 3 (Carol learning what
force majeure does) depend on the explanation and risk notes. Cutting them removes two of
three user scenarios. The product differentiation from "just copy from the internet" relies
on risk notes and explanation. This is a judgment call, not a clear cut.

---

**5. Scope that will be requested the day after launch (implicit phase 2)**

The Non-Goals correctly name the Clause Library (use case #5) as deferred. The following
are not named as non-goals but are as inevitable as the Clause Library:

| Request | Why it will be asked | Currently in scope? |
|---------|---------------------|---------------------|
| "Can I save this clause?" | Every user who generates a good result | No (Clause Library is use case #5) |
| "Can I tweak and regenerate?" | Every user who wants to adjust the output | No (multi-turn is non-goal) |
| "Can the AI Risk Reviewer analyze this?" | Natural connection to use case #2 | Not specified |
| "Can I see what was generated last week?" | Audit trail / history | Not in scope |
| "Can I customize the prompt with our standard language?" | Enterprise users | Not in scope |
| "Is this generating a lot of errors? What's the cost?" | Operators after launch | Not in scope |

None of these require a decision now. But the PRD should explicitly name at least the top
two (save/history and regeneration) as follow-on, so launch conversations don't treat them
as bugs or launch criteria.

---

**6. The "while we're in there" refactor risk: Express server setup**

The PRD mentions no changes to the existing stack. However, implementing the AI endpoint
requires: configuring timeout behavior on Express routes (currently unspecified), possibly
adding `dotenv` or adjusting env var loading for the API key, and potentially adding
middleware for structured JSON error responses if not already present.

Each of these is small. Combined, they create a risk: an engineer who finds the Express
configuration unsatisfactory while adding the AI endpoint will be tempted to refactor it
"while they're in there." This is how a bounded feature becomes an Express refactor + a
feature.

The Non-Goals should explicitly exclude: "No refactoring of existing Express middleware or
server configuration beyond what is strictly required for the new endpoint."

---

**7. Cross-phase dependency: AI Risk Reviewer (use case #2) depends on this feature's
foundation but is not scoped here**

The PRD states this feature "unblocks the downstream AI Risk Reviewer (use case #2)."
This creates a directional dependency: use case #2 cannot start until use case #1 is done.
But the scope of the "blocking" relationship is undefined:

- Does use case #2 require this feature to be in production, or just the code patterns to
  be committed?
- Does use case #2 share the same provider client and endpoint infrastructure, or does it
  build a separate one?
- If use case #2 requires changes to the provider abstraction established here, who owns
  that rework?

The risk: if use case #2 starts and finds the v1 abstraction inadequate, the team must
choose between refactoring the v1 code (breaking change, risk of regression) or duplicating
the pattern (divergence, maintenance cost). Neither is addressed in either PRD.

---

**8. Phasing: Big bang vs. incremental**

The PRD is written as a single-phase delivery. Given the number of open questions (9 listed,
several more implicit), there is meaningful risk that implementing everything in one go means
making wrong choices on provider, UI placement, prompt strategy, and output format — and
discovering the wrong choices only when users interact with the feature.

A two-phase approach would reduce risk:
- **Phase 1 (spike to production):** Backend endpoint with Anthropic, single output field
  (clause text only, no structured JSON parsing), modal on contract edit page, no streaming,
  no rate limiting. Validate that users find it useful and identify which output format they
  actually care about.
- **Phase 2 (hardened feature):** Add explanation and risk notes, formalize output schema,
  add error handling contract, resolve rate limiting and observability questions.

The PRD does not consider this option. Given the number of design questions that will only
be answerable by user behavior, the single-phase approach accepts the risk of building the
wrong thing confidently.

---

### Observations

**9. The Non-Goals section is the strongest part of the PRD — extend it**

"No clause library persistence," "no multi-turn conversation," "no streaming," "no
fine-tuning," "no jurisdiction-specific requirements," "no automated insertion," "no API
key UI for end users" — this list is disciplined and specific. It will prevent the most
common scope creep vectors.

The section would be complete with three additions: explicit deferral of operator controls,
explicit deferral of audit/observability requirements beyond server logs, and explicit
deferral of provider abstraction formalization to a post-v1 design artifact.

**10. "No database schema changes" is well-scoped but may conflict with observability**

The constraint that v1 requires no database schema changes is correct for the feature.
However, any observability beyond what server logs already capture (structured logging,
request counts, cost tracking) would likely require either a new table or an external
monitoring service. This constraint and the unstated observability need may conflict.
The resolution — "observability is out of scope for v1, ops will watch server logs" — should
be made explicit rather than discovered post-launch.

**11. The clause type list is a scope surface that will expand**

Whether clause types are a fixed dropdown or free-text is Open Question #2. If a fixed
dropdown is chosen, the list of types is a permanent scope negotiation point: every use case
the PRD doesn't anticipate becomes a request to add a new clause type. A free-text input
eliminates that negotiation entirely. From a scope maintenance perspective, free-text is
lower-overhead — the downside is prompt quality, not scope.

---

## Confidence Assessment

**Medium**

The scope is well-identified on its outer boundaries (what this feature is vs. adjacent
future features). The Non-Goals section does real work. The risk is not that scope will
come from outside — it is that the two structural problems identified above (the "reusable
pattern" goal and the provider-agnosticism constraint) will generate scope expansion from
within the team during implementation, invisibly and without a decision point.

The MVP definition is recoverable: the absolute core is clause text generation on a simple
API endpoint, which is small, well-defined, and low-risk. Everything additive to that core
(explanation, risk notes, provider abstraction, pattern reusability) has increasing scope
risk and decreasing urgency relative to the user problem.

Resolving the two critical gaps above — bounding the "reusable pattern" deliverable and
deferring the provider-agnostic abstraction — would bring scope confidence to High. The
PRD can go to implementation without these answers, but a team that hasn't discussed them
will re-discover both debates in the middle of implementation.
