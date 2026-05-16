# Ambiguity Analysis

## Summary

The PRD for AI Clause Generator is directionally clear — the problem, personas, and non-goals are well-scoped. However, a cluster of unresolved decisions in the "Open Questions" section are not actually open for discovery: they are blockers that must be resolved before two engineers could independently implement the same feature. The most dangerous ambiguities are around output schema (what does `risks[]` actually look like?), error UX (the feature's failure mode is completely undefined), and the "provider-agnostic" constraint (undefined abstraction target creates implementation drift risk).

Additionally, there is a latent contradiction between the Non-Goals (no jurisdiction-specific content) and Scenario 2 (risk notes explicitly flag jurisdictional variation), and the "30-second" performance goal lacks a measurement definition that makes it testable.

---

## Findings

### Critical Gaps / Questions

**1. Output schema for `risks[]` is undefined**

The Rough Approach specifies a JSON response with `text`, `explanation`, `risks[]` but does not define the schema of array items. Open Question #7 asks about severity tagging without resolution.

- *Why this matters:* Two engineers will build different UIs. One renders `risks[]` as a flat bulleted list of strings; another builds a severity-labeled card component. Neither can be called wrong based on the spec.
- *Clarifying question:* Is `risks[]` an array of strings, or an array of objects (e.g., `{ text: string, severity: "low" | "medium" | "high" }`)? Is severity displayed in v1?

**2. Error UX is completely undefined**

Open Question #5 ("What does the user see if the API key is missing, the provider is down, or the model returns an error?") is listed but not answered anywhere in the PRD. It is not a nice-to-have — every error path needs a defined user-visible behavior to implement the feature.

- *Why this matters:* Engineers will invent their own error UX. A modal with a generic "Something went wrong" is not the same as an inline callout with actionable guidance. If API key is missing, does the Generate button even appear?
- *Clarifying question:* What is the error state for each failure mode: missing API key, provider timeout, model error, malformed response? Is the Generate button hidden/disabled when the key is not configured?

**3. "Provider-agnostic enough to swap" has no defined abstraction target**

The Constraints section says the backend abstraction "should be provider-agnostic enough to swap" but never defines what "enough" means. Prompt format, JSON mode support, and SDK idioms differ materially between providers.

- *Why this matters:* One engineer writes a thin function wrapper; another builds a full adapter interface with a factory. Both claim compliance with the spec. Prompt portability is especially contested: if the prompt is optimized for Claude's instruction following, it may not work as well on OpenAI models.
- *Clarifying question:* Is "provider-agnostic" scoped to SDK/transport (swap by changing one import and env var) or does it include prompt portability? Should the abstraction be a formal interface (e.g., `AIProvider.generateClause(...)`) or a configuration convention?

**4. Timeout and cancellation behavior undefined**

The Goals state "under 30 seconds" but there is no defined behavior if the API call exceeds this threshold.

- *Why this matters:* Without a timeout, a slow provider leaves the user staring at a spinner indefinitely. Engineers will make different decisions: no timeout, 30s timeout with error, 30s timeout with partial display.
- *Clarifying question:* Is there a hard timeout on the backend API call? What does the user see if it expires? Can the user cancel an in-flight request?

**5. What format is the generated clause text?**

The Rough Approach says "formatted clause text (copyable)" but does not specify the text format (plain text, Markdown, HTML).

- *Why this matters:* If the model returns Markdown and the frontend renders it as raw text, users see `**WHEREAS**` instead of bold. If it renders Markdown to HTML, the user's clipboard copy includes formatting that may not paste cleanly into Word/Google Docs. The copy-to-clipboard behavior differs based on this choice.
- *Clarifying question:* Should clause text be returned as Markdown, plain text, or something else? What should "copy to clipboard" capture — the rendered text or the raw source?

**6. "Structured inputs" vs. free-text context**

The Goals say "user provides structured inputs" but the Rough Approach's API only takes `{ clause_type: string, context?: string }` where `context` is a free-text string. The user stories show context like "SaaS vendor, B2B, capped at 12 months of fees" — which is structured content expressed as prose.

- *Why this matters:* "Structured inputs" implies form fields (party type, deal type, cap amount). Free-text `context` means a single textarea. These produce very different UIs and prompt engineering approaches.
- *Clarifying question:* Is the context field a single free-text textarea (user writes their own context string), or a set of structured form fields that are assembled into a context? If the latter, what fields?

---

### Important Considerations

**7. "Reusable AI call pattern" is architecturally undefined**

The Goals treat establishing the AI integration pattern as a first-class deliverable ("the AI integration pattern the rest of the roadmap depends on"), but no constraints on what that pattern looks like are given.

- *Why this matters:* If not intentionally designed, subsequent use cases (Risk Reviewer, etc.) will either depend on a pattern they didn't review, or ignore it and create a second pattern. The scope of "get this right" is unclear.
- *Suggested question:* Should the AI call pattern be defined as an explicit interface or documented convention before implementation, rather than reverse-engineered from the first use case?

**8. Contradiction: Non-Goal says no jurisdictional content; Scenario 2 assumes it**

Non-Goals state "No support for jurisdiction-specific legal requirements (too complex for v1)." But Scenario 2 explicitly describes risk notes that say "may not cover contractors in some jurisdictions."

- *Why this matters:* These are incompatible. Either risk notes are generic and jurisdiction-agnostic, or they include jurisdictional caveats. An engineer who follows the Non-Goals writes a prompt that avoids jurisdictional content; another who follows Scenario 2 includes it.
- *Clarifying question:* Should the model be instructed to avoid jurisdiction-specific content in risk notes, or is jurisdictional flagging (at the "be aware, consult counsel" level) acceptable?

**9. "Error early if missing" API key is ambiguous**

The Rough Approach says the backend should "error early if missing" for the API key, but "early" is undefined.

- *Why this matters:* Failing at server boot (process.env check on startup) vs. failing at first request call are different operational behaviors. One means the server won't start without a key; the other means the server starts but the endpoint fails.
- *Clarifying question:* Should a missing API key prevent server startup, or should it cause the `/api/clauses/generate` endpoint to return a clear error on first call?

**10. "Should" vs. "must" confusion in constraints**

Several constraint statements use "should" in ways that are ambiguous between required and optional:
- "backend abstraction **should** be provider-agnostic enough to swap"
- "UI entry point **should** be discoverable from the contract detail/edit view"
- "Must not require database schema changes" (correctly uses "must")

- *Why this matters:* "Should" in requirements language typically means "recommended, not required." If these are hard requirements, they should use "must." If they are soft goals, they should be in a Goals section, not Constraints.
- *Clarifying question:* Are provider-agnosticism and discoverability hard constraints (blocking) or best-effort goals?

**11. Rate limiting: explicitly unresolved but no deferral decision**

Open Question #8 ("Any throttle needed in v1?") has no answer. Without a decision, there is no per-user, per-org, or global rate limit — leaving API spend unbounded.

- *Why this matters:* A single user running 1,000 requests will incur costs. The non-goal "No per-user metering in v1" suggests no user-level tracking, but that doesn't address total spend protection.
- *Clarifying question:* Is rate limiting deferred to v2 (explicitly, with known risk), or is a simple global server-side throttle required for v1?

**12. Who curates the clause type list?**

Open Question #2 is unresolved. If a dropdown is used, the clause type list must come from somewhere.

- *Why this matters:* Hardcoded in the frontend? Loaded from a config file? Seeded in the backend? Different assumptions lead to different implementation shapes. The PRD mentions 7 types as examples but doesn't confirm these are the launch set.
- *Clarifying question:* Is the clause type list fixed for v1 (hardcoded) or configurable? Who owns it and how is it extended?

---

### Observations

**13. 30-second SLA measurement point is unspecified**

"Under 30 seconds" is stated as a goal but not defined as client-side end-to-end (button click → display) or server-side (request receipt → response). Network round-trip could push a 28s server response past 30s for users on slow connections.

**14. Legal reviewer persona does not appear in any user story**

"Legal reviewer (secondary/consumer of output)" is listed as an actor but no scenario shows a legal reviewer interacting with the generator. If they only consume output (not generate), they aren't really a feature actor — which is fine, but it should be stated.

**15. "JSON mode or instructed JSON" decision affects provider-agnostic goal**

JSON mode (e.g., OpenAI's `response_format: { type: "json_object" }`) is provider-specific. Anthropic's equivalent is prompt-instructed JSON. If the key decision is to use JSON mode for reliability, this de facto selects a provider family. This tension is flagged as a "key decision" but not resolved.

**16. Testing approach unresolved creates CI cost/reliability risk**

Open Question #9 is unresolved. Mocking the AI provider risks false confidence; real keys in CI add cost and flakiness. Neither path has been chosen, which will surface as an urgent decision when the first test is written.

**17. `context?` field has no documented character/token limit**

The context parameter is optional but unbounded. Very long context strings could cause model errors or unexpected prompt behavior. No guidance on expected length or validation.

---

## Confidence Assessment

**Medium.** The core concept and scope are well-defined. Non-Goals are specific and useful. However, six critical gaps (output schema, error UX, abstraction target, timeout behavior, text format, structured vs. free-text context) are genuine blockers — two engineers could not independently implement the same feature without resolving them. The open questions section acknowledges uncertainty honestly, but most of them need answers before implementation, not after. The document reads as a strong first draft that needs a half-day design session to close the critical gaps before sprint commitment.
