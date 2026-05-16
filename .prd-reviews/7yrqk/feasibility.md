# Technical Feasibility

## Summary

The AI Clause Generator is technically tractable on this stack. Express/TypeScript is a natural fit for an AI backend endpoint, no database schema changes are needed (ephemeral by design), and the frontend modal pattern is well within React/Tailwind reach. The core integration — install an SDK, build a structured prompt, parse JSON, return to frontend — is a few days of focused work, not weeks.

The harder problem is that this feature is explicitly meant to establish the AI integration pattern for four downstream use cases. That "establish the pattern" goal is load-bearing and materially expands scope beyond a naive reading. Getting the provider client, error handling, and response abstraction right the first time requires deliberate design — not just wiring in a single endpoint. Several open questions in the PRD (provider choice, error UX, UI placement) must be resolved before implementation can begin, because they each affect the component surface and prompt strategy in non-trivial ways.

---

## Findings

### Critical Gaps / Questions

**1. Provider not decided — but it's a prerequisite gate**

The PRD correctly flags this as open, but provider choice is a hard prerequisite: it determines which SDK to install, which auth format to use, what JSON/tool-use mechanism is available for structured output, and what error codes need to be handled. Implementation cannot meaningfully begin until this is settled.

- Why this matters: Anthropic's structured output path (tool use / beta structured output) differs significantly from OpenAI's `response_format: { type: "json_object" }`. The "provider-agnostic abstraction" the PRD wants is harder to design well before you know what you're abstracting.
- Suggested question: **Which provider is selected for v1? Anthropic Claude is mentioned as likely — is it confirmed?**

**2. Structured JSON reliability is the hardest implementation problem**

The PRD proposes parsing structured JSON (`{ text, explanation, risks[] }`) from the model. This is the correct approach for reliable downstream display, but JSON output from LLMs is not 100% guaranteed without explicit enforcement. Anthropic's tool use / structured output feature (currently in beta) substantially increases reliability; without it, you're depending on prompt instructions alone.

- Why this matters: If the model returns malformed JSON, the backend will throw a parse error. There is currently no global error handler pattern for external service failures — only SQLite errors. A silently broken clause generator (user sees 500 with no context) is a bad outcome.
- Suggested question: **What is the intended fallback if the model returns malformed JSON — surface an error, retry once, or degrade to raw text?**

**3. Error UX is undefined — this is a UX requirement gap, not just an implementation detail**

PRD open question #5 (error UX) must be answered before implementation. API key missing at startup vs. at runtime, provider rate-limit hit, model-level refusal, and network timeout are distinct failure modes that each need a different user-facing message.

- Why this matters: The existing global Express error handler returns a generic `{ error: "Internal server error" }` with no status code differentiation. This will not give users enough signal to act (e.g., "the AI service is temporarily unavailable" vs. "configuration error — contact your admin"). Building this out properly requires knowing what the UX contract is.
- Suggested question: **What should the user see for each failure mode: missing API key / provider down / model error / timeout? Should errors be recoverable (retry button) or informational only?**

**4. "Establish a reusable AI call pattern" is a scope amplifier**

The PRD explicitly states this feature "establishes the AI integration pattern (API key management, prompt structure, streaming/non-streaming response) the rest of the roadmap depends on." This is not a side goal — it means the provider client, error handling, and response model must be designed generically from day one.

- Why this matters: If the implementation is done as a one-off endpoint with no abstraction, the four downstream use cases will each require rework. Getting it right upfront likely means spending 1-2 extra days on the provider client module that the PRD currently underweights.
- Suggested question: **Is there a design document for the provider abstraction layer, or is the expectation that the implementer will design it from scratch?**

---

### Important Considerations

**5. Rate limiting / cost control is deferred but real**

A single `ANTHROPIC_API_KEY` with no per-user throttle means any user can trigger unlimited AI calls. The PRD treats this as an open question for v1 — which is reasonable for an internal tool. But if this is customer-facing or multi-tenant, the risk profile changes substantially.

- For a small internal team: acceptable in v1, but document the gap.
- Suggested question: **Is this deployed as a single-tenant internal tool, or will multiple organizations/users share one instance?**

**6. No test infrastructure exists in either package**

Neither `backend/package.json` nor `frontend/package.json` has a test script. PRD open question #9 (mock vs. real key in CI) cannot be answered until a test framework is chosen and wired. This is a prerequisite for anyone who needs to write automated tests for the new endpoint.

- Why this matters: Testing an AI endpoint requires either mocking the provider SDK (straightforward with Jest/Vitest) or running with a real key (adds cost). Without a test harness, the implementer has to establish this from scratch alongside feature work.
- Suggested question: **Has a test framework been selected for this project? Should the clause generator PR include test infrastructure setup, or is that a separate prior task?**

**7. The frontend API module is narrowly scoped to `/api/contracts`**

`frontend/src/api.ts` hardcodes `API_BASE` to the contracts endpoint. A new AI endpoint at `/api/clauses/generate` will need either a new `ai.ts` module or an extension of the existing pattern. This is low-effort but should be explicit in the implementation plan to avoid ad-hoc patterns.

**8. Copy-to-clipboard is not mentioned but is almost certainly needed**

The PRD says "no automated insertion — user pastes manually." The existing contract content field is a plain `<textarea>`. Without a copy-to-clipboard button on the generated clause output, the UX is awkward (user must manually select text from a potentially long response). This is a minor scope addition but easy to miss.

---

### Observations

**9. The 30-second goal is comfortably achievable**

Modern LLMs (Claude Sonnet, GPT-4o) generate a clause + explanation + risk notes in 3-12 seconds for typical token volumes. The non-streaming approach is fine. This is not a performance concern for v1.

**10. SQLite + WAL mode is fine for this use case**

No schema changes are needed. The ephemeral-by-design constraint is honored. The existing DB layer does not need to be touched.

**11. No streaming means simpler frontend state management**

A single `{ loading: true }` → `{ result: ... }` cycle is easy to implement with React's `useState`. The absence of streaming is the right call for v1 complexity.

**12. Vite proxy coverage**

The existing proxy (`/api` → backend) will cover the new `/api/clauses/generate` endpoint automatically. No Vite configuration changes are needed. Worth verifying in `vite.config.ts` but expected to work.

**13. Clause type dropdown vs. free-text affects prompt strategy significantly**

If a dropdown is used, each clause type can have a tailored system prompt or few-shot examples. If free-text is allowed, the prompt must be more generic and the output quality may vary. This is a product decision that shapes the AI prompt design, which in turn affects output quality and testing surface.

---

## Confidence Assessment

**Medium.** The implementation path is clear and the stack is well-suited. No technical blockers exist that would make this impossible or require architectural changes. However, three open questions (provider, error UX, UI placement) must be resolved before work can begin accurately — they affect component boundaries, prompt structure, and the error handling surface in non-trivial ways. The "establish a reusable pattern" goal is the most underspecified aspect and carries the most scope risk if not addressed explicitly in the design phase.
