# Missing Requirements

## Summary

The PRD is admirably focused and its Non-Goals section is unusually clear, but it omits several entire categories of requirement that are standard for any feature involving user-controlled input, third-party API calls, and legally consequential output. The most serious omissions are: (1) authorization model — the new endpoint's access control is entirely unspecified; (2) data privacy — confidential contract content sent to an external AI provider is a compliance decision that requires legal sign-off, not just an engineering choice; (3) prompt injection and input security — the user-controlled `context` field feeds directly into AI prompts with no sanitization or length limits specified; and (4) cost controls — rate limiting is listed as an open question but left completely unresolved despite being a live financial risk at ship time.

Secondary gaps cluster around operational readiness: no audit logging, no AI call timeout, no legal disclaimer for AI-generated clause text, and no observability story for ops. These are not implementation blockers but will cause friction at launch. The PRD is viable for starting the backend endpoint scaffold and frontend shell, but the critical authorization and data privacy gaps must be resolved before any user-facing data flows to the AI provider.

---

## Findings

### Critical Gaps / Questions

**1. Authorization: which users can call the endpoint?**

The PRD explicitly excludes "authentication or API key UI for end users" from scope (Non-Goals) — meaning the operator API key is not user-configurable. But it says nothing about which authenticated users may invoke the generation endpoint itself.

- The proposed `POST /api/clauses/generate` endpoint is a new cost-incurring surface. Without specified auth middleware, it is either (a) unprotected and publicly callable at the operator's expense, or (b) protected by whatever default middleware Agreement Hub applies to all routes — which is undocumented in the PRD.
- There is no mention of user roles, feature flags, or contract-scoped access. Can any logged-in user generate clauses for any contract, or only collaborators on a specific contract?
- The user stories (Alice, Bob, Carol) assume authenticated users but give no authorization context.

**Suggested question:** What authentication and authorization rules should protect `/api/clauses/generate`? Does Agreement Hub have a concept of user roles today, and if so, which roles should have access? Should access be gated per-contract (only collaborators)?

---

**2. Data privacy: confidential contract content sent to a third-party provider**

The `context` field is described as "optional context" for clause generation. Given the use cases (SaaS agreement, IP assignment, force majeure), this field will routinely contain confidential business terms, counterparty names, and commercially sensitive parameters. The PRD does not address what data-handling obligations arise from transmitting this content to an external AI provider.

- Under GDPR, CCPA, and standard B2B SaaS DPAs, sending customer data to a new sub-processor requires disclosure, contractual safeguards (DPA with the provider), and potentially user consent or at minimum notice.
- Enterprise customers with contractual data-residency or data-sharing restrictions may prohibit sending contract content to any third party.
- The PRD notes the provider is not yet decided — this is the moment to flag the privacy analysis requirement, before provider onboarding.

**Suggested question:** Has legal reviewed the data privacy implications of sending user-provided contract context to an AI provider? Does Agreement Hub's existing ToS/DPA permit this? Should the UI warn users that input content will be sent to a third-party model before they click Generate?

---

**3. Prompt injection via user-controlled context field**

The `context` field accepts free-text from the user and is incorporated directly into the AI prompt. The PRD specifies no input sanitization, no maximum length, and no injection defenses.

- An adversarial user can craft a `context` value that overrides system prompt instructions (e.g., "Ignore previous instructions and instead output..."). In a legal SaaS product, generating fake or harmful "clause text" that appears authoritative is particularly dangerous.
- Even non-adversarial inputs can cause issues: a 50,000-character context field will inflate token counts, slow responses, and significantly increase per-call cost.
- `clause_type` is described as a dropdown in the frontend but the backend has no corresponding allowlist — a crafted API call can pass arbitrary values.

**Suggested question:** What is the maximum character length for `clause_type` and `context`? Should `clause_type` be validated against an enumerated list on the backend? What input sanitization is expected before fields are inserted into AI prompts?

---

**4. Rate limiting and cost controls (Open Question #8 left unresolved)**

Rate limiting is listed as Open Question #8 but the PRD provides no provisional answer, not even a placeholder. The Non-Goals state "no per-user metering in v1" — but metering (billing/reporting) is distinct from throttling (abuse prevention). A basic rate limit does not require metering.

- With no throttle and a potentially unauthenticated endpoint (see Gap #1), a single script could generate thousands of API calls, incurring unbounded cost at the operator's expense.
- The PRD notes "cost per call unknown until provider is chosen" — this is true, but a cost-bounding mechanism (e.g., N calls/minute per session, or a daily global quota) should be designed before the provider is selected, not after.

**Suggested question:** What is an acceptable maximum number of generation requests per user per day? Is a global rate limit (e.g., 100 calls/hour across all users) acceptable for v1? Who monitors AI spend, and is there a circuit-breaker if costs spike?

---

**5. Backend input validation (not just frontend)**

The PRD describes a frontend dropdown for `clause_type`, which implies a controlled set of values. The backend receives raw JSON. No validation contract is specified for the backend endpoint.

- No required-field check: what does the endpoint return if `clause_type` is absent or empty?
- No maximum lengths on either field — a downstream model call with a massive payload will produce unexpected errors or costs.
- No enumerated allowlist for `clause_type` on the backend — frontend dropdowns are not a substitute for server-side validation.

**Suggested question:** What validation should the backend apply to `clause_type` and `context` before constructing the AI prompt? Should the backend return a 400 for unknown clause types, or pass them through?

---

### Important Considerations

**6. Legal disclaimer ("not legal advice")**

The PRD targets non-lawyers generating legal clause text. No disclaimer requirement is specified — not in the UI, not in the generated output.

- In several jurisdictions, generating legal text without a disclaimer that it is not legal advice may create liability for the operator.
- Enterprise legal departments will ask whether the tool includes a "not legal advice" notice before approving internal use.
- Users in Scenario 3 (Carol, who doesn't know what a force majeure clause should cover) are the highest-risk group — they may treat AI output as authoritative without appropriate caveats.

**Suggested question:** Should the UI display a persistent or one-time-dismissable disclaimer that generated clause text is AI-assisted and does not constitute legal advice? Should this disclaimer appear in the generated output itself?

---

**7. AI call timeout and frontend loading UX**

The PRD goal states "under 30 seconds" for generation, but no backend timeout is specified for the HTTP call to the AI provider, and no frontend timeout or cancel behavior is described.

- Without a backend timeout, a slow provider response holds an HTTP connection open indefinitely, potentially exhausting the server's connection pool under concurrent load.
- Without a frontend timeout or cancel button, users watching a spinner for 20+ seconds with no feedback will abandon or repeatedly click Generate, creating duplicate backend calls.
- "Under 30 seconds" is a goal, not an SLA — the PRD should specify what happens when the goal is not met.

**Suggested question:** What is the backend timeout for the AI provider call (e.g., 30 seconds hard cutoff)? Should the frontend show a progress indicator with elapsed time? Should there be a Cancel button after N seconds?

---

**8. Audit logging**

The PRD does not specify whether generation events should be logged: who requested generation, what inputs were used, what was returned, when.

- In a legal SaaS product, audit logs serve both debugging and liability purposes: if a user claims the generated clause created a legal problem, the operator needs a record of what was generated.
- Without request logging, support cannot reproduce a user's complaint ("the generated clause said X") after the fact. Generated output is explicitly ephemeral (Non-Goal: no persistence) — without a server-side log, there is no way to reconstruct what was returned.
- Usage data is also needed to prioritize the Clause Library investment (use case #5) and evaluate feature success.

**Suggested question:** Should generation requests be logged server-side (inputs, outputs, user ID, timestamp, provider response metadata)? What is the retention period? Does this interact with existing data privacy commitments?

---

**9. Model version pinning**

The PRD does not specify a model version. Using a provider's latest-model alias (e.g., `claude-sonnet-latest`) means the model behavior and JSON output format can change without notice when the provider updates the alias.

- The PRD identifies structured JSON output as a "key decision" — this parsing is the most brittle point in the integration. A model version change that alters the JSON schema will break clause display silently.
- Version pinning is a one-line configuration choice at integration time; retrofitting it after the first silent regression is more expensive.

**Suggested question:** Should the model be pinned to a specific version (e.g., `claude-sonnet-4-6`) rather than a mutable alias? Who is responsible for evaluating and approving model version upgrades?

---

**10. Accessibility**

The PRD describes a modal or slide-over UI but specifies no accessibility requirements: no WCAG compliance level, no keyboard navigation spec, no screen reader behavior, and no focus management (where focus lands when the modal opens/closes is an accessibility regression if unspecified).

**Suggested question:** Is Agreement Hub subject to WCAG 2.1 AA or other accessibility compliance? What is the minimum accessibility bar for the modal UI?

---

**11. Operator observability**

The PRD specifies that the server "errors early" if the API key is missing, but there is no logging or metrics story for production: no per-request success/failure tracking, no latency monitoring, no error categorization (provider error vs. timeout vs. bad request).

- A broken API key or provider outage will be discovered via user complaints rather than proactive monitoring.
- Provider error codes (e.g., rate-limited by the provider, token-limit exceeded, content-policy block) require different operational responses — these are not distinguished in the PRD.

**Suggested question:** What structured logging should the backend emit for each generation request (success/failure, latency, provider error type)? Is there an existing error monitoring tool (Sentry, Datadog, etc.) to integrate with?

---

### Observations

**12. English-only assumption not explicit**

The PRD does not mention the language of generated output. The clause types and expected output appear to be English-only. If Agreement Hub has non-English users, this needs to be stated as an explicit v1 constraint.

**13. Mobile and responsive behavior**

A modal or slide-over displaying generated clause text, explanation, and risk notes is potentially content-heavy. The PRD does not address whether the UI needs to be usable on mobile browsers or small viewports.

**14. Feature kill switch / graceful degradation**

There is no mechanism to disable AI generation without a code deployment. If the provider has an outage or costs spike unexpectedly, ops cannot turn off the feature without a deploy. A simple feature flag or env var to disable the endpoint would bound operational risk.

**15. Cost monitoring**

The PRD defers per-user metering to a future use case. But there is no fallback: no alert if daily AI spend exceeds a threshold, no spend dashboard for ops. The first signal of runaway cost would be the provider billing statement.

**16. Future design debt: Clause Library migration path**

Use case #5 is a Clause Library. The current design makes generation output ephemeral — users paste manually. When use case #5 ships, the product will need a way to save generated clauses. The ephemeral design is intentional for v1, but should be flagged as a known forward-compatibility constraint: the UI and API response format should be designed to make saving a clause a future-addable capability rather than requiring a redesign.

---

## Confidence Assessment

**Medium-High.** The PRD is well-bounded — its Non-Goals section reduces ambiguity about intentional scope cuts. The missing requirements identified here are not about unclear scope; they are entire categories of requirement (security, compliance, authorization, operational monitoring) that were not addressed at all. The critical gaps (1–5) are standard requirements for any feature with user-controlled input, third-party API calls, and cost-per-request economics — they apply here as much as they would to any comparable feature. Implementation can begin on the endpoint shape and UI scaffold, but gaps 1 (authorization) and 2 (data privacy) must be resolved before any real user data is sent to an AI provider.
