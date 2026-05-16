# PRD: AI Clause Generator

## Problem Statement

Users composing contracts in Agreement Hub write clause text from scratch. They have no
guidance on clause structure, legal completeness, or risk — leading to inconsistent quality,
missing protections, and clauses that may create unintended liability. When users know they
need "a limitation of liability clause" but don't know what one should contain or what risks
to watch for, they either copy-paste from the internet or write something inadequate.

**Who:** Agreement Hub users actively drafting or editing contracts — primarily non-lawyers
(operations, sales, founders) who need a starting point, not a blank page.

**Why now:** AI clause generation is use case #1 of 5 on the product roadmap. It unblocks
the downstream AI Risk Reviewer (use case #2) and establishes the AI integration pattern
(API key management, prompt structure, streaming/non-streaming response) the rest of the
roadmap depends on.

---

## Goals

- Users can generate a ready-to-use clause draft in under 30 seconds from structured inputs
- Generated output includes: clause text, a short plain-language explanation, and risk notes
- Feature integrates into the existing contract editing flow without redesigning it
- Establishes a reusable AI call pattern (provider client, error handling, key config) for
  subsequent use cases

---

## Non-Goals

- No clause library persistence — generated clauses are ephemeral unless the user copies them
  into the contract body (Clause Library is use case #5)
- No multi-turn conversation or iterative refinement — one-shot generation only
- No streaming — synchronous response is sufficient for v1
- No fine-tuning or custom model training
- No support for jurisdiction-specific legal requirements (too complex for v1)
- No automated insertion into contract body — user pastes manually
- No authentication or API key UI for end users — key is operator-configured via env var

---

## User Stories / Scenarios

**Scenario 1 — Blank slate**
Alice is drafting a new SaaS services agreement. She needs a limitation of liability clause.
She opens the AI Clause Generator, selects "Limitation of Liability", specifies the context
("SaaS vendor, B2B, capped at 12 months of fees"), and clicks Generate. She receives clause
text she can read, understand, and paste into her contract.

**Scenario 2 — Risk awareness**
Bob is reviewing a contract draft. He uses the generator to create a standard IP assignment
clause. The risk notes flag that "work made for hire" language may not cover contractors in
some jurisdictions — he follows up with counsel.

**Scenario 3 — Unfamiliar clause type**
Carol doesn't know what a "force majeure" clause should cover. She selects the type from a
dropdown, leaves context minimal, and receives a clause with an explanation that teaches her
what the clause does.

**Actors:** Contract drafter (primary), legal reviewer (secondary/consumer of output)

---

## Constraints

**Technical:**
- Stack: React/Vite frontend, Express/TypeScript backend, SQLite — no changes to this
- No AI provider client exists today — must choose and wire one (Anthropic SDK, OpenAI SDK, etc.)
- API key must not be exposed to the browser — all AI calls go through the backend
- Provider key configured via environment variable (e.g., `ANTHROPIC_API_KEY`)
- Response size: clause + explanation + risks fits comfortably in a single non-streaming response

**Business/Product:**
- Must not require database schema changes for v1 (generated output is ephemeral)
- UI entry point should be discoverable from the contract detail/edit view without cluttering
  the existing layout

**Open constraints:**
- Which AI provider? Not decided. Anthropic Claude is the likely default given the stack context,
  but the backend abstraction should be provider-agnostic enough to swap.
- Cost per call unknown until provider is chosen — no per-user metering in v1

---

## Open Questions

1. **Where does the UI live?** — Modal triggered from contract edit page? Standalone `/clauses/generate` route? Sidebar panel?
2. **Which clause types to support at launch?** — Dropdown of common types (NDA, limitation of liability, IP assignment, force majeure, indemnification, payment terms, termination) or free-text entry?
3. **Which AI provider?** — Anthropic, OpenAI, or abstracted behind a thin wrapper?
4. **Prompt strategy** — Zero-shot vs. few-shot with curated examples? Who owns the prompts?
5. **Error UX** — What does the user see if the API key is missing, the provider is down, or the model returns an error?
6. **Explanation length** — How long should the plain-language explanation be? 1 sentence? 1 paragraph?
7. **Risk notes format** — Bulleted list of risks? Severity-tagged? How opinionated?
8. **Rate limiting** — Any throttle needed in v1 to prevent runaway API spend?
9. **Testing** — Do we mock the AI provider in tests, or use a real key in CI? (real key adds cost/complexity)

---

## Rough Approach

**Backend:**
- Add `POST /api/clauses/generate` endpoint
- Accept: `{ clause_type: string, context?: string }`
- Install chosen provider SDK (e.g., `@anthropic-ai/sdk`)
- Build a structured prompt: clause type + optional context → JSON response with `text`, `explanation`, `risks[]`
- Return the structured response to the frontend
- Provider key read from env var — error early if missing

**Frontend:**
- Add a "Generate Clause" trigger on the contract edit/detail view (button or menu item)
- Modal or slide-over: dropdown for clause type + optional context textarea + Generate button
- Display result: formatted clause text (copyable), explanation, risk notes
- No save/persist — user copies what they want

**Key decision:** Parse structured output from the model (JSON mode or instructed JSON) vs. parse free-text. Structured JSON is more reliable for downstream risk notes display.

**Unknowns that will shape the approach:**
- Provider choice drives SDK and prompt format
- UI placement decision affects frontend component scope
