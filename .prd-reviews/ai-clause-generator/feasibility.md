# Technical Feasibility

## Summary

The AI Clause Generator is technically buildable on the existing stack without architectural
surgery. React/Vite + Express/TypeScript handles this use case cleanly: add an endpoint, wire
an SDK, build a modal — nothing in the current stack blocks the feature. The 30-second latency
goal is achievable; most AI providers return responses of this complexity in 2–10 seconds under
normal conditions.

However, three areas carry real engineering risk. First, the PRD implicitly requires a
**provider abstraction layer** that is correctly designed upfront — if it is designed poorly,
every subsequent AI use case (#2–#5 on the roadmap) inherits the debt. Second, **structured
JSON output from a language model is non-trivial**: providers implement JSON mode differently,
malformed output will happen, and the failure strategy must be specified before building.
Third, the **testing strategy** for AI-dependent code is genuinely hard: mocking costs fidelity,
real keys cost money and make CI flaky. None of these are blockers, but each will double the
implementation estimate if discovered mid-build.

---

## Findings

### Critical Gaps / Questions

**1. Provider abstraction interface is undefined — and it sets precedent for the entire roadmap**

The PRD says the backend should be "provider-agnostic enough to swap," but defines no interface.
This is the highest-consequence architecture decision in the feature.

- Why this matters: This is use case #1 of 5. The abstraction designed here will be copied or
  extended for the AI Risk Reviewer (use case #2) and all subsequent AI features. An abstraction
  designed for one provider's API surface (e.g., Anthropic's `messages` API with `tools` for
  structured output) will not map cleanly to another provider (e.g., OpenAI's `chat.completions`
  with `response_format: { type: "json_object" }`). The differences are subtle but real: token
  counting APIs differ, streaming semantics differ, structured output mechanisms differ.
- The risk: Building the abstraction after choosing a provider means the abstraction will be
  shaped by that provider's API — and swapping later will require refactoring across all
  use cases, not just this one.
- Suggested clarifying question: "Can we commit to a single AI provider for the full v1 roadmap
  (use cases #1–#5) and build a thin wrapper for testing purposes only? Or is provider swappability
  a real near-term requirement?" If swappability is real, the interface must be specified as a
  design artifact before any code is written.

**2. Structured JSON output reliability is an unsolved problem in this codebase**

The PRD endorses structured JSON output (clause text + explanation + risks[]) and notes it is
"more reliable for downstream display." This is correct — but structured output from LLMs is
not trivially reliable, and different providers implement it differently.

- Anthropic Claude: structured output is achieved via the `tools` API (the model "calls a tool"
  with a JSON schema) or via instructed JSON in the prompt. Claude 3+ supports this reliably
  but it requires prompt design and schema definition.
- OpenAI: has `response_format: { type: "json_object" }` in newer models, which is more
  direct but still not 100% schema-validated.
- Both can return syntactically valid JSON that does not match the expected schema.
- Both can, in edge cases, return malformed JSON (especially under high load or with unusual
  inputs).
- Why this matters: The codebase has no existing pattern for parsing AI responses. The first
  engineer to implement this will make choices about parsing, schema validation, and fallbacks
  that will be cargo-culted into all subsequent AI features. If they get it wrong, every
  use case breaks the same way.
- Suggested clarifying question: "Is the response schema (`{ text, explanation, risks[] }`)
  fixed? Can we define it formally (as a TypeScript type and a Zod schema) before implementation
  starts, so the parser and the prompt are designed together?"

**3. Testing strategy for AI-dependent code is unresolved**

PRD Open Question #9 asks about mocking in tests vs. real keys in CI. This is not a preference
question — it has concrete implementation consequences.

- Mock approach: Build a mock AI provider that returns fixture responses. Tests are fast and free,
  but they test the wrapper code, not the AI behavior. Any change to the prompt or provider API
  silently breaks coverage.
- Real key in CI: Tests exercise the real provider but add cost (~$0.01–$0.05 per test run for
  a request of this size), add CI flakiness (provider availability, rate limits), and require
  CI secrets management.
- Hybrid approach (recommended): Mock the provider at the HTTP transport level using a tool like
  `nock` or `msw`. Record real provider responses once, replay them in CI. This requires
  deliberate setup upfront.
- Why this matters: If this decision is deferred, the first engineer will either write no tests
  or write tests tightly coupled to the mock that become dead weight when the provider changes.
- Suggested clarifying question: "Is there a project standard for mocking external HTTP
  dependencies in tests? If not, can we decide the AI testing strategy before implementation
  starts?"

**4. The Express server has no documented timeout configuration for long-running requests**

The PRD states "synchronous response is sufficient" but specifies no request timeout. An AI
API call that hangs (network partition, provider degradation) will hold the Express connection
open indefinitely.

- Express's default behavior: no response timeout. Node's default socket timeout is often
  disabled or very long (minutes). A hung AI call will occupy a server connection until the
  provider eventually times out or the socket is closed by the OS.
- Under concurrent load: if 10 users hit the endpoint simultaneously and the provider is
  degraded, 10 connections hang. Express is single-threaded; while awaiting async calls it
  can still process other requests — but if the event loop is busy with cleanup or the
  connection pool is exhausted, degradation occurs.
- What's needed: an explicit `AbortController` timeout on the provider SDK call (e.g., 30s),
  plus a corresponding Express route-level timeout. This is ~5 lines of code but must be
  specified and tested.
- Suggested clarifying question: "What is the maximum acceptable wait time before returning
  a timeout error to the user? (Suggested: 30 seconds, matching the latency goal.)"

---

### Important Considerations

**5. No AI integration exists today — bootstrap cost is real but bounded**

The codebase has zero AI infrastructure: no provider SDK, no API key management, no prompt
structure, no error handling pattern. This is not a blocker but it is real setup work:

- Install and configure the provider SDK (~30 minutes)
- Establish env var handling with startup validation (~1 hour)
- Design and test the `POST /api/clauses/generate` endpoint shape (~2 hours)
- Write the initial prompt and test it manually (~2–4 hours, highly variable)
- Implement response parsing with error handling (~2 hours)

Total bootstrap: approximately 1 day for an engineer unfamiliar with the chosen provider's API.
This is not accounted for if the sprint plan treats this as "wire up the SDK and it works."

**6. Prompt engineering is implementation work, not configuration**

Writing a prompt that reliably produces well-structured, legally-appropriate clause text,
a useful plain-language explanation, and actionable risk notes — for a variety of clause types
and contexts — is implementation work. It requires iteration.

- A zero-shot prompt ("generate a limitation of liability clause") will produce mediocre output
  without careful system prompt design.
- Few-shot examples improve reliability but require curated examples for each clause type.
- The time to write, test, and iterate on prompts is not reflected in any estimate visible in
  the PRD.
- There is no evaluation framework specified — no way to know if the output is "good enough"
  other than manual inspection.

**7. `context` field is an unbounded injection point**

The user-provided `context` field is passed directly into the prompt. There is no specified
maximum length.

- AI providers have token limits (Anthropic Claude: ~200K tokens; OpenAI GPT-4: ~128K). A
  malicious or accidental context of tens of thousands of characters will balloon request cost
  and may cause unexpected truncation.
- Prompt injection ("ignore all previous instructions and...") is a real attack surface for
  user-provided input injected into prompts.
- Mitigation: enforce a character limit (e.g., 2,000 characters) on `context` at the backend
  validation layer. This is low implementation cost and eliminates both the cost and injection
  risks.

**8. SQLite is fine for this feature but imposes a concurrency ceiling for future AI features**

For this feature (ephemeral, no persistence), SQLite is not a constraint. But as the roadmap
adds AI Risk Reviewer and subsequent features — potentially with longer-running AI calls and
concurrent users — SQLite's single-writer model may become a bottleneck. This is not a v1
concern but should be noted for roadmap planning.

---

### Observations

**9. The 30-second latency goal is achievable but should be measured at p95**

For clause generation requests of this complexity (~100–500 tokens of prompt, ~300–800 tokens
of response), Anthropic Claude Sonnet/Haiku and OpenAI GPT-4o/mini typically respond in
2–8 seconds under normal load. The 30-second goal has significant headroom. However:

- Provider cold starts, rate limit backoff, and network variability can push individual requests
  to 15–20 seconds.
- "Under 30 seconds" as a p50 target is not the same as "under 30 seconds" as a p95 target.
  The existing analysis correctly notes this should be specified as a percentile.

**10. The feature correctly defers streaming for v1**

Streaming would improve perceived latency but adds significant frontend complexity (SSE or
WebSocket, incremental rendering of partial JSON). For a 2–8 second synchronous response,
the UX tradeoff does not justify the implementation cost. The non-streaming decision is sound.

**11. No existing AI call pattern means this feature sets precedent**

The PRD explicitly notes this feature "establishes the AI integration pattern for the rest of
the roadmap." This elevates the importance of getting the abstraction, error handling, and
testing patterns right. A 3-hour design spike to document the provider interface before
implementation would pay dividends across all five roadmap use cases.

**12. Provider choice is effectively decided**

The PRD lists Anthropic Claude as "the likely default given the stack context" and the
existing analysis context references `@anthropic-ai/sdk`. Treating this as decided (and the
abstraction as a thin testing wrapper) would unblock implementation immediately and reduce
speculative abstraction complexity. The cost of being wrong (swapping providers later) is
bounded — the endpoint is one file.

---

## Confidence Assessment

**Medium-High** for the core feature. The stack is well-suited, the scope is bounded, and there
are no technically infeasible requirements. The feature as described can be built and shipped.

**Medium** for the roadmap-level integration pattern. The provider abstraction and structured
output strategy need upfront design decisions — not because they are hard, but because getting
them wrong here propagates to four more AI use cases. A one-day design artifact (interface
definition, response schema, testing strategy) before implementation starts would raise this
to High confidence.

The two decisions that would unlock implementation immediately:
1. Commit to Anthropic Claude as the v1 provider (treat it as decided)
2. Define the response schema formally (`{ text: string, explanation: string, risks: string[] }`)
   and specify the JSON parsing/fallback strategy
