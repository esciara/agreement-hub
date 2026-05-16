# Missing Requirements

## Summary

The PRD is well-scoped for a v1 feature and its Non-Goals section is admirably clear, but it leaves several categories of requirement completely unaddressed. The most serious omissions are in data privacy (contract context is sent to a third-party AI provider — legal/compliance decision required), security (user-controlled prompt injection surface), and authorization (no specification of which users can invoke generation or how contract-level permissions interact with the feature). Rate limiting is acknowledged as an open question (#8) but left entirely unresolved, creating a live cost-risk for the operator.

Secondary gaps cluster around operational concerns that will surface at launch: there is no audit logging specified, no timeout defined for the AI call, no disclaimer requirement for AI-generated legal text, and no observability story for ops or support. These are not blockers for starting implementation, but they need answers before shipping to real users.

---

## Findings

### Critical Gaps / Questions

**1. Data privacy: contract content sent to third-party AI provider**
- The `context` field is likely to contain confidential contract terms, business details, or personal data (e.g., counterparty names, financial figures). The PRD does not address what data-handling obligations arise from passing this content to an external AI provider.
- Why this matters: Under GDPR, CCPA, and typical B2B SaaS DPAs, sending customer data to a sub-processor requires disclosure, consent, or contractual safeguards. If Agreement Hub operates in the EU or handles data for EU-based customers, this is a compliance blocker before shipping. Even outside regulated jurisdictions, enterprise customers may prohibit sending contract content to third parties.
- Suggested question: Does Agreement Hub currently commit to customers (via ToS or DPA) about where their data is processed? Has legal reviewed the implications of sending clause context to an AI provider? Should the UI warn users before submission?

**2. Authorization: who can invoke the generator?**
- The PRD describes the target user as "Agreement Hub users actively drafting or editing contracts" but does not specify the authorization model. There is no mention of:
  - Whether all authenticated users can use this feature, or only users with specific roles/permissions
  - Whether access is contract-scoped (only collaborators on a given contract can generate clauses for it, or the feature is context-free)
  - What the endpoint does if called by an unauthenticated request
- Why this matters: `POST /api/clauses/generate` is a new unauthenticated-by-default risk surface unless explicitly secured. If the backend doesn't already enforce auth middleware on all API routes, this endpoint could be publicly callable — each call costs money. Even with auth, role-based access is unspecified.
- Suggested question: What auth middleware should protect `/api/clauses/generate`? Is there a concept of user roles in Agreement Hub today, and if so, which roles should have access?

**3. Prompt injection via user-controlled context field**
- The `context` field accepts free-text from the user and is inserted directly into the AI prompt. The PRD specifies no input sanitization, length limits, or injection defenses. A malicious or curious user could craft a `context` value to override prompt instructions, cause the model to generate harmful or legally sensitive content, or extract system prompt details.
- Why this matters: AI prompt injection is a known attack class. In a legal context, generating malicious "clause text" that looks legitimate is particularly dangerous. This is also a potential abuse vector for generating off-topic or policy-violating content at the operator's API cost.
- Suggested question: What is the maximum allowed length for `clause_type` and `context`? Should inputs be sanitized or validated before insertion into the prompt? Is there a content policy for generated output?

**4. Rate limiting decision (Open Question #8 is left unresolved)**
- The PRD lists rate limiting as an open question but does not sketch even a provisional answer. With no per-user or global throttle, a single user (or an automated script calling the unauthenticated endpoint, see gap #2) could generate thousands of requests, leading to unbounded AI spend.
- Why this matters: v1 with no cost controls is a live financial risk the moment the feature ships. The PRD notes "no per-user metering in v1" — but that is a different concern from a basic abuse-prevention throttle. Even a simple global rate limit (e.g., N calls/minute per user, or a daily quota) would bound the exposure.
- Suggested question: What is an acceptable maximum AI spend per user per day? Is there a circuit-breaker if daily spend exceeds a threshold? Even if per-user metering is out of scope, is a simple per-IP or per-session throttle acceptable for v1?

**5. Input validation on the backend**
- The proposed endpoint accepts `{ clause_type: string, context?: string }` but the PRD specifies no validation: no required-field check on `clause_type`, no maximum lengths, no allowlist for `clause_type` values. The PRD mentions a dropdown for clause types on the frontend, but backend validation is independent.
- Why this matters: Without backend validation, an empty `clause_type`, a 50,000-character `context`, or an unexpected type value will be passed directly to the AI provider — potentially causing model errors, unexpected costs, or garbled output. Frontend-only validation is not a substitute.
- Suggested question: Should `clause_type` be constrained to an enumerated list on the backend, or is free-text accepted? What are the max character limits for each field?

---

### Important Considerations

**6. Accessibility (completely absent)**
- The PRD describes a modal or slide-over UI but specifies no accessibility requirements: no WCAG compliance level, no keyboard navigation, no screen reader behavior, no focus management (where does focus go when the modal opens/closes?), no color contrast requirements for risk notes (which may use color coding for severity).
- Why this matters: If Agreement Hub has enterprise customers, accessibility compliance may be contractually required. Missing focus management in a modal is a regression in keyboard usability for all users.
- Suggested question: Is Agreement Hub subject to any accessibility compliance requirements (WCAG 2.1 AA or similar)? What is the minimum accessibility bar for this feature?

**7. Audit logging**
- The PRD does not address whether generation events should be logged: who requested generation, what inputs were used, what output was returned, and when. In a legal SaaS context, this information is valuable for support debugging, usage analytics, and potentially for liability (demonstrating that a user knowingly invoked AI generation).
- Why this matters: Without logging, support cannot debug a user complaint of "the generated clause was wrong." Usage data is also needed to inform future investment in the feature (use case prioritization).
- Suggested question: Should generation requests be logged server-side (input + output + user + timestamp)? Where? Does this interact with data retention policy?

**8. Timeout and loading UX**
- The PRD says the goal is "under 30 seconds" for generation, but specifies no actual request timeout on the backend, no timeout on the frontend, and no UX behavior during an extended wait. If the AI provider is slow (15–25 seconds), the user sees a spinner with no feedback. If the call hangs indefinitely, the browser request may eventually fail with a network error.
- Why this matters: Without a defined timeout, a single slow AI response can hold an HTTP connection open indefinitely, potentially exhausting server connection pools under load.
- Suggested question: What is the backend request timeout for the AI provider call (e.g., 30s)? What does the user see if generation takes more than 10 seconds? Should there be a "cancel" button?

**9. Disclaimer / "not legal advice" requirement**
- The PRD targets non-lawyers generating legal clause text. There is no requirement for any disclaimer in the UI or in the generated output that the text is AI-generated and not legal advice.
- Why this matters: In some jurisdictions, generating legal text without a disclaimer may create liability for the operator. More practically, enterprise legal teams will ask whether the tool includes a "not legal advice" notice before approving use.
- Suggested question: Should the UI display a disclaimer that generated text is AI-assisted and not a substitute for legal counsel? Should the disclaimer be dismissable or persistent?

**10. Operator observability (health monitoring and debugging)**
- The PRD specifies that the API key is read from an env var and that the server "errors early" if it's missing. But there is no logging, metrics, or alerting story for the feature in production: no request success/failure rate tracking, no AI provider error categorization, no way for ops to know if the feature is silently failing for users.
- Why this matters: Without observability, a broken API key or a provider outage will be discovered via user complaints rather than proactive monitoring.
- Suggested question: What logging should the backend emit on success and failure? Should errors be tracked in an existing error monitoring tool (Sentry, etc.)?

**11. Model version pinning**
- The PRD specifies no model version. Using the provider's latest model alias (e.g., `claude-3-5-sonnet-latest`) means the behavior and JSON output format could change without notice when the provider updates the alias.
- Why this matters: If the model changes its output format, the JSON parsing step will silently break. The PRD notes structured JSON output as a key decision — this is fragile without version pinning.
- Suggested question: Should the model be pinned to a specific version (e.g., `claude-sonnet-4-6`) rather than a mutable alias? Who is responsible for model version upgrades?

---

### Observations

**12. English-only assumption unstated**
- The PRD does not mention the language of generated output or the UI. The clause type dropdown and explanation text appear to be English-only, but this is not explicit. If Agreement Hub has non-English-speaking users, the feature may need to support generation in other languages — or explicitly document it as English-only for v1.

**13. Mobile / responsive design not mentioned**
- A modal or slide-over on a mobile browser may have usability issues (small keyboard, limited screen space for clause text review). The PRD does not state whether Agreement Hub has mobile users or whether this view needs to be responsive.

**14. No feature flag / kill switch**
- There is no mechanism described to disable the AI generation feature without a code deployment. If the provider has an outage or unexpected costs spike, ops has no way to turn the feature off without a deploy.

**15. Cost monitoring / budget alerting**
- "Cost per call unknown until provider is chosen — no per-user metering in v1" is a reasonable deferral, but there is no substitute: no alert if daily AI spend exceeds a threshold, no dashboard for ops to see usage trends. The first month of production data will be invisible until the credit card bill arrives.

**16. Clause Library migration path (use case #5)**
- The PRD explicitly marks persistence as out of scope ("ephemeral unless user copies"). But use case #5 is a Clause Library. The design decision to make generation ephemeral may need to be revisited when #5 ships — or #5 needs to accommodate that generated clauses were never stored. This creates a potential design debt that is not flagged as a known future constraint.

---

## Confidence Assessment

**Medium.** The PRD is clear about what it intentionally excludes (jurisdiction-specific law, streaming, persistence, fine-tuning). The critical gaps are not about unclear scope — they are about categories of requirement that were not considered at all: data privacy, authorization, input security, and cost controls. These are well-understood SaaS requirements that apply to any feature touching user-controlled input and third-party API calls. The implementation could begin on the backend endpoint shape and frontend scaffold, but the critical gaps (#1–#5) should be answered before the feature ships to real users, and ideally before the authorization and input validation code is finalized.
