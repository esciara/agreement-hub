# Ambiguity Analysis

## Summary

The PRD for the AI Clause Generator is well-structured and clearly motivated, but it carries a significant number of ambiguities that will produce engineering disagreements at implementation time. The core issues cluster into three areas: (1) the PRD's "Open Questions" section is partially answered elsewhere in the document, creating contradictions between sections; (2) several key output-format decisions are deferred but are actually required to specify the backend contract and frontend display; (3) quality/behavioral expectations use subjective language ("discoverable", "short", "agnostic enough") that will not survive first contact with a PR review.

The feature is implementable, but without resolving the critical gaps below, two engineers reading this PRD would make materially different choices on the API response shape, UI placement, clause type input method, and error handling — resulting in work that needs to be reconciled later.

---

## Findings

### Critical Gaps / Questions

**1. The `risks[]` response field is structurally undefined**

The Rough Approach specifies the backend will return `{ text, explanation, risks[] }`, but `risks[]` is never defined. Is each element a plain string? An object with a `severity` field? This is load-bearing: the frontend display code and the prompt instructions both depend on the shape. Open Question #7 ("Risk notes format — Bulleted list of risks? Severity-tagged? How opinionated?") re-opens this, but the Rough Approach implies it's decided.

- **Why this matters:** The backend API contract, the prompt template, and the frontend rendering component cannot all be written until this is resolved. Different engineers will make different choices.
- **Clarifying question:** What is the exact JSON schema for a risk note? Is it `string[]` or `{ text: string, severity?: "low"|"medium"|"high" }[]` or something else?

---

**2. Open Question #1 (UI placement) contradicts the Rough Approach**

Open Question #1 asks "Where does the UI live? — Modal triggered from contract edit page? Standalone `/clauses/generate` route? Sidebar panel?" — marking it undecided. But the Rough Approach already says "Modal or slide-over" and the Constraints section says the entry point must be "discoverable from the contract detail/edit view without cluttering the existing layout." These are not the same decision: a standalone route satisfies none of those constraints; a modal or slide-over satisfies them. The document states an open question that is de facto answered elsewhere.

- **Why this matters:** A developer reading the Open Questions section may think this is still undecided and explore a route-based approach, wasting time.
- **Clarifying question:** Is the UI placement decided (modal/slide-over from the contract edit view)? If so, remove it from Open Questions. If not, the Rough Approach section needs to be updated to reflect that.

---

**3. Open Question #2 (clause type input method) contradicts Scenario 1**

Open Question #2 asks whether clause types are a "dropdown of common types or free-text entry?" But Scenario 1 describes Alice selecting "Limitation of Liability" from what is clearly a dropdown. If free-text is still on the table, Scenario 1 is misleading. If a dropdown is decided, the open question should be closed with a list of the supported types.

- **Why this matters:** The UI component, the backend validation, and the prompt construction all differ substantially between dropdown-constrained and free-text inputs. These are not interchangeable at implementation time.
- **Clarifying question:** Is the clause type input a controlled dropdown or free-text? If a dropdown, what are the exact supported types at launch?

---

**4. "Ready-to-use clause draft" is undefined**

The first Goal states: "Users can generate a ready-to-use clause draft." The word "ready-to-use" is doing significant work here and is undefined. Does it mean the user can paste it directly into a signed contract with no edits? Or that it's a reasonable starting point requiring light editing? These imply very different standards for prompt engineering and output quality.

- **Why this matters:** This phrase will be used to evaluate whether the feature is "done." Two people reading this will have different acceptance criteria.
- **Clarifying question:** What level of editing is expected before a user would paste the output into a contract? Is the output meant to be legally serviceable as-is, or a draft requiring review?

---

**5. "Short plain-language explanation" is undefined, and the definition is itself an open question**

The Goals section lists "a short plain-language explanation" as a required output component. Open Question #6 then asks "How long should the plain-language explanation be? 1 sentence? 1 paragraph?" This is circular: the goal states a requirement ("short") and the open questions section re-opens it. The prompt template cannot be written until this is resolved because the length is an explicit prompt instruction.

- **Why this matters:** Prompt engineering for a 1-sentence explanation vs. a 1-paragraph explanation will produce different outputs and different frontend layout requirements.
- **Clarifying question:** What is the maximum length of the plain-language explanation? 1 sentence, 2-3 sentences, or a paragraph?

---

**6. Error UX for missing/failed API key is undefined**

Open Question #5 asks "What does the user see if the API key is missing, the provider is down, or the model returns an error?" The Rough Approach addresses only the backend side: "error early if missing." No user-facing error message, no fallback behavior, and no distinction between transient (provider down) vs. permanent (no key configured) errors is specified.

- **Why this matters:** The frontend component cannot be implemented without knowing what to render on error. A "missing key" error is an operator configuration issue; a "provider down" error is transient. Displaying the same message for both is misleading.
- **Clarifying question:** What error message(s) should the user see for (a) missing/invalid API key, (b) provider timeout or outage, and (c) model returning malformed output?

---

**7. "Copyable" clause text: what does copy mean?**

The Rough Approach states the UI should "Display result: formatted clause text (copyable)." "Copyable" is ambiguous: does this mean a "Copy to clipboard" button, or that the text is user-selectable (the browser default)? The Non-Goals section says "No automated insertion" and "user pastes manually" — which implies Copy to clipboard is desired, but it's not explicitly required.

- **Why this matters:** This is a frontend implementation decision. A "Copy" button is a feature that needs to be built; selectable text is a default. The PRD should state which is expected.
- **Clarifying question:** Is a "Copy to clipboard" button required for the clause text output, or is browser-native text selection sufficient?

---

### Important Considerations

**8. "Discoverable" and "without cluttering" are subjective acceptance criteria**

The Constraints section says: "UI entry point should be discoverable from the contract detail/edit view without cluttering the existing layout." Both "discoverable" and "without cluttering" are subjective. A developer's judgment and a designer's judgment will differ. This will cause a PR review debate.

- **Suggested approach:** Define what "discoverable" means concretely — e.g., visible without scrolling, reachable in ≤2 clicks, or present in a specific UI region. Define "cluttering" as a constraint on the number of new UI elements added to the existing view.

---

**9. "Provider-agnostic enough to swap" needs a definition of successful swap**

The Constraints section says "the backend abstraction should be provider-agnostic enough to swap." "Agnostic enough" is vague. Does provider swap require zero code changes? Changing only a config file? Changing only one module? Without defining this, the abstraction design will be debated in PR review.

- **Suggested approach:** Define what a successful provider swap looks like: "Switching from Anthropic to OpenAI should require changing only the SDK import and environment variable, with no changes to the route handler or response parsing."

---

**10. `context?: string` lacks any constraints**

The API accepts `context?: string` as an optional field. There are no stated constraints on length. A user could pass 10,000 characters. The prompt template will embed this string directly, affecting token count, cost, and possibly model behavior.

- **Suggested approach:** Define a max character limit for the context field (e.g., 500 characters) and specify frontend validation and backend truncation or rejection behavior.

---

**11. The "legal reviewer" actor has no requirements**

The Scenarios section introduces two actors: "Contract drafter (primary), legal reviewer (secondary/consumer of output)." All three scenarios focus exclusively on the drafter. The legal reviewer's interaction with generated clauses is never described. Are there any requirements specific to this actor? Could they use the generator too, or only consume its output?

- **Suggested approach:** Either remove the legal reviewer from the actors list (if they have no distinct requirements), or add a scenario describing how they interact with generator output.

---

**12. Regeneration behavior is undefined**

The Non-Goal states "No multi-turn conversation or iterative refinement — one-shot generation only." But this doesn't answer: can a user click Generate a second time with different inputs (or the same inputs) in the same session? Is a "Regenerate" button allowed? These are distinct from multi-turn conversation.

- **Suggested approach:** Clarify whether the UI should allow multiple sequential generation attempts within a single modal session, or whether the modal closes/resets after one generation.

---

**13. "Formatted clause text" format is undefined**

The Rough Approach says the frontend should display "formatted clause text." Is the clause returned as plain text, Markdown, or HTML? This affects both the prompt (what formatting to request from the model) and the frontend renderer (how to display it safely). Markdown would require a renderer; HTML would require sanitization.

- **Suggested approach:** Specify the expected text format of the `text` field in the response — plain text, Markdown, or HTML — and specify the rendering approach.

---

**14. Rate limiting decision deferred without a default**

Open Question #8: "Any throttle needed in v1 to prevent runaway API spend?" is listed without a recommended default. Since there's no per-user metering and no authentication tie-in to limit calls, an unthrottled endpoint could result in significant unexpected cost. This should at minimum have a recommended default (e.g., IP-based rate limiting at N requests/minute).

---

### Observations

**15. Testing strategy (Open Question #9) needs a decision before CI setup**

Open Question #9 asks whether to mock the AI provider in tests or use a real key. This must be decided before the CI pipeline is configured, not after. If a real key is used in CI, secrets management must be set up; if mocked, the mock strategy affects how the provider abstraction is implemented.

**16. Jurisdiction non-goal may need a disclaimer in the UI**

The Non-Goals section rules out "jurisdiction-specific legal requirements." However, Scenario 2 describes risk notes flagging jurisdictional issues (work-made-for-hire). If the risk notes surface jurisdictional concerns, but the system doesn't support them, the UI should include a disclaimer that generated clauses are not jurisdiction-specific. Otherwise users may assume they're legally adequate in their jurisdiction.

**17. The 30-second goal lacks a percentile definition**

The Goal "generate a ready-to-use clause draft in under 30 seconds" doesn't specify a percentile. P50? P99? Under load? This matters for production monitoring and for deciding whether to add a loading indicator.

---

## Confidence Assessment

**Medium.** The PRD describes a coherent feature with a clear problem statement, and the implementation approach is sensible. However, approximately half the Open Questions are either partially answered elsewhere in the document (creating contradictions) or are not truly open — they need to be resolved before implementation can start. The `risks[]` schema, error UX, and explanation length are blocking decisions. The UI placement and clause type input ambiguities will cause the most implementation disagreement if not resolved. A developer reading this PRD today would need to make at least 5-6 undocumented judgment calls to begin implementation.
