# Missing Requirements

## Summary

The PRD establishes a clear problem statement, scope, and rough technical approach. It is
unusually honest about its own open questions. However, it leaves a number of requirement
dimensions entirely unaddressed — not as open questions, but as silent omissions. The most
dangerous cluster centers on authorization, data privacy, cost control, and legal liability
disclosure. These are not edge cases; they are table-stakes for a feature that routes user
input through a paid external API and returns output that could be copied directly into
legally binding contracts.

Several gaps — notably prompt injection, AI output validation, and support visibility —
are implementation concerns that will bite the first engineer to touch this code if they
are not specified upfront. The PRD's "non-goals" are reasonably scoped; the problem is
what falls between the stated goals and non-goals with no specification at all.

---

## Findings

### Critical Gaps / Questions

**1. Authorization: Who is allowed to call the generation endpoint?**

The PRD specifies that the API key must not reach the browser and must be operator-configured,
but it says nothing about whether the `/api/clauses/generate` backend endpoint requires an
authenticated user session. If the endpoint is unprotected, any unauthenticated request —
including automated abuse — triggers a paid AI call.

- Why this matters: A single unauthenticated endpoint with no rate limiting and no auth check
  is a runaway cost vector. It also means anonymous visitors could use a feature intended for
  contract drafters.
- Clarifying question: Does `/api/clauses/generate` sit behind the same auth middleware as
  other protected routes? If so, which user roles/permissions are required?

**2. Data Privacy: User context is transmitted to a third-party AI provider**

The "context" field allows users to enter free-form text describing their contract situation
(e.g., "SaaS vendor, B2B, capped at 12 months of fees"). This content is sent verbatim to
an external AI provider. Depending on what users type, this could include party names,
deal terms, or sensitive commercial information.

- Why this matters: Agreement Hub's privacy policy may not cover sending user-authored
  content to a third-party AI. If Agreement Hub has enterprise or regulated-industry users
  (healthcare, finance), this could violate data handling agreements. Some AI providers
  retain conversation data for training by default unless opted out.
- Clarifying question: Is the privacy policy updated to cover AI data transmission? Is the
  chosen provider configured with a data processing agreement (DPA) and training opt-out?
  Are there any user types (e.g., enterprise plan) for whom this feature must be disabled
  until compliance is confirmed?

**3. Legal liability disclaimer: Is there a "not legal advice" disclosure?**

The PRD describes the output as "ready-to-use clause text" that users can "paste into their
contract." There is no requirement for any disclaimer that AI-generated clauses are not
legal advice and should be reviewed by qualified counsel.

- Why this matters: Agreement Hub is a legal tech tool. Displaying AI output as
  "ready-to-use" without a disclaimer exposes the operator to liability if a user relies on
  a defective clause and it causes harm. Most legal AI tools require explicit "not legal
  advice" disclosures.
- Clarifying question: Is a disclaimer required in the UI (e.g., before generation, in
  the output panel)? Is there a legal review of the product copy before launch?

**4. Spend control: No cost ceiling, no kill switch, no alerting**

Open Question #8 asks "any throttle needed?" but there is no answer, no design, and no
requirement. The PRD explicitly notes "cost per call unknown until provider is chosen" and
"no per-user metering in v1" — but provides no compensating control.

- Why this matters: An unthrottled endpoint with no budget alerts could silently exhaust
  API credits. A single automated client hammering the endpoint could generate costs in
  minutes. The "cost unknown" admission makes this more urgent, not less.
- Clarifying question: What is the acceptable monthly AI spend budget? Is there an
  alerting threshold? Is there a global kill switch (feature flag, env var) that can
  disable AI calls without a deployment?

**5. AI call timeout and failure behavior**

The PRD says "synchronous response is sufficient for v1" but specifies no timeout for the
backend-to-AI-provider call. If the provider is slow or hung, the Express server holds
the request open indefinitely, blocking the response and potentially exhausting server
connections under load.

- Why this matters: No timeout = potential server hang under degraded provider conditions.
  This is a production stability issue, not just a UX issue.
- Clarifying question: What is the maximum acceptable wait time for a generation response
  before returning an error? (Suggested: 30 seconds.) Should the backend use a circuit
  breaker if the provider is repeatedly failing?

**6. AI response validation: What if the model returns malformed JSON?**

The PRD notes structured JSON output is "more reliable for downstream risk notes display"
but does not specify what happens when parsing fails — which it will, occasionally.

- Why this matters: A malformed AI response with no fallback will either surface a raw
  error to the user or crash the response handler. Neither is specified.
- Clarifying question: If JSON parsing fails, should the backend return an error to the
  user, attempt a plain-text fallback parse, or retry? What does the user see?

---

### Important Considerations

**7. Accessibility: New UI components have no WCAG requirements**

The modal/slide-over and clause type dropdown have no accessibility requirements specified.
The output panel (clause text, explanation, risk notes) is also unspecified.

- Keyboard navigation for the dropdown and modal, focus management on open/close, and
  screen reader labels for generated content are commonly missed and painful to retrofit.
- Suggested: Add a one-line accessibility requirement ("UI must meet WCAG 2.1 AA") and
  note keyboard navigation requirements for the clause type dropdown and modal dismiss.

**8. Mobile / responsive behavior**

The PRD does not specify whether the feature needs to work on mobile browsers or only
desktop. Modal UIs on mobile often require explicit responsive design work.

- Suggested: State explicitly whether mobile is in or out of scope. If in scope, note
  minimum viewport width requirements for the modal.

**9. Prompt injection / input sanitization**

The user-provided "context" field is passed into an AI prompt. A user could craft input
designed to override system instructions ("Ignore all previous instructions and...").

- Why this matters: Prompt injection can cause the model to return output that bypasses
  the intended clause-generation behavior. Depending on what system prompt is used, this
  could result in unexpected or harmful output.
- Suggested: Specify whether input sanitization or prompt injection mitigations are
  required, or explicitly declare this out of scope for v1.

**10. Audit logging / operational visibility**

There is no requirement to log which user triggered generation, what inputs were provided,
or what response was returned. Support teams have no visibility into why a generation
failed for a specific user.

- Why this matters: When a user reports "generation isn't working," support has no
  trail to debug. Without logging, diagnosing provider errors or prompt failures is blind.
- Suggested: Require server-side logging of: user ID (or session), clause type, timestamp,
  provider response code, and error message (if any). Do not log the full context field
  if it may contain PII.

**11. API key lifecycle: rotation, dev vs. prod, startup validation**

The PRD specifies env var configuration but says nothing about key rotation procedure,
how to manage development vs. production keys, or whether the server should validate
key presence at startup vs. at request time.

- Why this matters: "Error early if missing" (stated in Rough Approach) implies startup
  validation, but this is inconsistent with ephemeral environments where the key may be
  injected at runtime. The rotation procedure matters for security incident response.
- Suggested: Specify whether the server should fail to start if the key is absent, or
  return a 503 at request time. Specify that dev and prod keys must be different values.

**12. Concurrent request behavior under load**

No specification for what happens if multiple users simultaneously trigger generation.
The AI provider SDK likely handles connection pooling, but the Express server's behavior
under many in-flight async requests is unspecified.

- Suggested: State whether per-user concurrent request limits are needed (e.g., one
  in-flight generation per user at a time), or explicitly declare this a v2 concern.

---

### Observations

**13. Multi-tenancy is unaddressed**

If Agreement Hub is or will become multi-tenant (multiple organizations sharing the
same deployment), the single operator-configured API key model means all tenants share
one budget and one rate limit. This is a future architecture decision but may constrain
the v1 design if multi-tenancy is on the near-term roadmap.

**14. Feature flag / rollout strategy is absent**

The PRD does not mention a feature flag for controlled rollout. If the AI integration
has issues in production, there is no specified way to disable the feature without
a deployment.

**15. Internationalization: language of generated output**

The PRD does not specify whether clause generation is English-only. If a user enters
a context in French, the model may respond in French — or switch mid-response. No
behavior is specified.

**16. Content safety / output moderation**

The PRD has no requirement for filtering or reviewing AI-generated output before display.
This is low-risk for clause generation (vs. open-ended generation), but worth a one-line
explicit "out of scope for v1" acknowledgment.

**17. Endpoint versioning**

The proposed endpoint is `POST /api/clauses/generate` with no version prefix. If the
request/response shape changes in a future iteration, there is no versioning strategy
to avoid breaking existing frontend code.

---

## Confidence Assessment

**Medium.** The PRD is clear on scope and non-goals, and the open questions section
surfaces the most visible unknowns. However, the authorization, data privacy, legal
disclaimer, and spend control gaps are not acknowledged as open questions — they are
silent omissions. These are the highest-risk findings because they are not on anyone's
radar to resolve before implementation starts. The implementation gaps (timeout, response
validation, prompt injection) are likely to be caught during development, but specifying
them now would prevent rework.

The PRD is ready for design/implementation discussion on the happy path. It is not
ready to hand to an engineer without answers to Critical Gaps 1–6.
