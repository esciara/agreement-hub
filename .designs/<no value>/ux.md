# User Experience Analysis

## Summary

The AI Clause Generator addresses a genuine pain point: non-lawyers facing a blank page when
they know they need a clause but don't know what it should contain. The core UX challenge is
not discoverability or workflow disruption — the feature is narrow and well-scoped — but
rather the **trust and reliability gap**. Users will either over-trust AI-generated clause
text (treating it as authoritative legal language) or under-trust it (ignoring it after one
surprising output). Bridging that gap requires an interaction model that positions the feature
as a skilled first draft, not a legal oracle.

The second major UX risk is the **wait time**. At up to 25–30 seconds, the generation latency
exceeds the threshold at which users begin to assume failure. Without active, informative
feedback during the wait, the "Generate" button will feel broken on the first use. Everything
downstream of that first impression depends on getting the loading state right.

## Analysis

### Key Considerations

- **Primary user persona is task-interruption averse.** Alice (operations/sales/founder) is
  mid-editing a contract. The generator is a tool she reaches for to solve a specific gap, not
  a destination. The interaction must complete and return her to her editing context without
  friction. Every extra click or navigation step is a UX debt.
- **Non-lawyers do not know clause taxonomy.** "Limitation of Liability" is meaningful to a
  lawyer; to Carol, it may not be. Clause type labels need accompanying short descriptions or
  at minimum enough context to distinguish the seven options. The dropdown is the first filter
  — it must not be a guessing game.
- **The output has three distinct value layers, each serving a different user goal.** Clause
  text (copy/paste into contract), explanation (understand what it does), risk notes (decide
  whether to use it as-is or flag for counsel). The display hierarchy must reflect these
  priorities: clause text is the primary deliverable; explanation and risks are supporting
  context. Reversing this order would make the feature feel like a lecture before the answer.
- **Plain-text output is correct but may feel sparse.** Users accustomed to formatted web
  content may find plain-text clause text visually dull. The monospace rendering proposed for
  the result area (consistent with the contract content display) is technically correct for
  copy-paste fidelity but needs to look intentional, not broken.
- **30-second wait time is at the upper boundary of acceptable.** Nielsen's research places the
  threshold for "system is working" feedback at 1 second, and the threshold for "I need a
  progress indicator" at 10 seconds. 25–30 seconds requires active, informative feedback to
  prevent abandonment or repeated submissions.
- **Copy-to-clipboard is the most critical interaction after Generate.** The user's primary
  workflow is: generate → copy → paste into contract body. A missing or broken copy button
  forces manual text selection in a modal — a significant friction point for multi-paragraph
  clauses.
- **The feature is ephemeral by design, but users may not know that.** "Where did my clause
  go?" is the most predictable first support question. Stating "results are not saved" once is
  insufficient; the copy button and a brief note near the result should make the ephemeral
  contract explicit.

### Options Explored

#### Option 1: Modal dialog triggered from contract detail/edit view

- **Description**: A "Generate Clause" button in the contract action bar opens a full-screen
  modal overlay containing: clause type dropdown, optional context textarea, Generate button,
  and result display area. No new route. User closes the modal to return to editing.
- **Pros**: No navigation disruption. User stays in the contract editing context. Consistent
  with the existing app's interaction pattern (delete action uses `window.confirm`; a modal is
  the natural upgrade). No back-button or browser history issues with ephemeral state.
  Simpler implementation than a new route or slide-over.
- **Cons**: Result display space is constrained — a multi-paragraph clause plus explanation
  plus risk notes in a modal may feel cramped. Loading state (up to 30s) must be handled
  within the modal without the user having an easy abort path. Modal scroll behavior needs
  careful implementation if the result is longer than the viewport.
- **Effort**: Medium

#### Option 2: Standalone route `/contracts/:id/generate-clause`

- **Description**: A dedicated page for clause generation, reachable from the contract detail
  view. Result displayed on the page with a "Copy to clipboard" button and a "Back to contract"
  link.
- **Pros**: Ample display space for long clause text. Browser history works naturally. Users
  can bookmark or share the URL.
- **Cons**: Navigation disruption is significant — users leave the editing context, copy the
  clause, then navigate back. For ephemeral output, a permanent URL creates a misleading
  affordance (users may expect results to persist or be retrievable via the URL). Back-button
  behavior after a generate action is unpredictable — the user may re-submit or lose their
  inputs.
- **Effort**: Medium (similar to modal, but with routing complexity and loss of context)

#### Option 3: Slide-over side panel

- **Description**: A panel slides in from the right, overlapping the contract content 30–40%.
  Contract stays visible on the left. User can read the generated clause and immediately see
  where they want to paste it.
- **Pros**: Highest UX value — clause text and contract content simultaneously visible. Reduces
  the copy-paste round-trip to a single visual context. Ideal for the Scenario 2 workflow (Bob
  comparing generated clause to existing contract language).
- **Cons**: Highest implementation complexity. Tailwind CSS alone likely insufficient — custom
  layout management needed. Requires responsive design consideration (unusable on small
  viewports). Risk of layout breakage in contract editing view. Out of scope for v1 given the
  existing UI complexity.
- **Effort**: High

---

#### Option A: Spinner only (loading state)

- **Description**: A spinner replaces the Generate button text while the AI call is in
  progress. No other feedback.
- **Pros**: Simplest implementation.
- **Cons**: At 25–30 seconds, a spinner with no change in state will cause most users to assume
  the request failed or the page has hung. Users will click the Generate button again (causing
  duplicate submissions) or close the modal entirely. This is the highest-risk option for first
  impressions.
- **Effort**: Low

#### Option B: Spinner with animated status message (Recommended)

- **Description**: Generate button becomes disabled with a spinner icon. A status message below
  the button cycles through: "Generating clause..." → "Analyzing context..." → "Drafting risk
  notes..." on a timer. Button text changes to "Generating..." and a cancel affordance appears
  after 5 seconds.
- **Pros**: Communicates that work is in progress and that multiple steps are happening.
  Dramatically reduces perceived wait time. Cancel option respects the user's time if they
  change their mind. Low deception risk — messages describe real phases, even if not tied to
  actual progress.
- **Cons**: Requires cycling message state management. Cancel requires aborting the backend
  request (AbortController on the frontend, handled by response timeout on the backend).
- **Effort**: Low–Medium

#### Option C: Fake progress bar

- **Description**: A 0% → 95% progress bar that fills at a fake rate, jumping to 100% on
  success.
- **Pros**: Familiar pattern from file uploads.
- **Cons**: Deceptive — the bar has no relationship to actual completion. If generation takes
  longer than the bar's animation, the bar stalls at 95% and the user still perceives a hang.
  Worse than Option B for honest user communication.
- **Effort**: Medium (for low value)

---

#### Option X: Clause type dropdown with short descriptions (Recommended)

- **Description**: Each dropdown option shows the clause type name plus a one-line description:
  "Limitation of Liability — Caps your financial exposure" / "IP Assignment — Transfers
  ownership of created work" / etc. Descriptions are static, hardcoded alongside the clause
  type enum.
- **Pros**: Directly addresses the "I don't know what these terms mean" problem for Carol and
  similar users. No extra clicks — description is visible inline as the user scans options.
  High value for minimal implementation cost.
- **Cons**: Dropdown option formatting (`<option>` element) is constrained in standard HTML.
  This may require a custom select component (Radix UI Combobox, Headless UI Listbox, or
  similar) to display two-line options. Worth the cost.
- **Effort**: Low–Medium

#### Option Y: Plain dropdown labels only

- **Description**: Dropdown shows only clause type names: "Limitation of Liability",
  "Indemnification", etc.
- **Pros**: Simplest implementation. Uses a native `<select>` element.
- **Cons**: Non-lawyers guessing between "Indemnification" and "Limitation of Liability" will
  get it wrong. Wrong clause type → wrong generated text → user loses trust in the feature.
  The discoverability cost is high.
- **Effort**: Low

#### Option Z: Clause type with tooltip help icon

- **Description**: Plain dropdown labels with a ℹ️ icon next to the dropdown label. Hovering
  or clicking the icon shows a popover explaining all clause types.
- **Pros**: Keeps the dropdown clean. Information available but not intrusive.
- **Cons**: Help is hidden behind an extra interaction. Mobile hostile. Users who need it most
  (Carol) are least likely to discover the help icon.
- **Effort**: Medium (for low value)

---

#### Option R1: Clause text first, then explanation, then risks (Recommended)

- **Description**: Result area displays: (1) "Clause Text" section with monospace copyable
  block and "Copy clause text" button; (2) "What this clause does" section with the plain-
  language explanation; (3) "Risk notes" section with severity-badged risk items.
- **Pros**: Matches the user's primary goal — get the clause text. Supporting context available
  by scrolling. Power users (Alice) get their deliverable immediately; learning users (Carol)
  scroll down for explanation. Risk notes are last because acting on them requires a separate
  decision (contact counsel), not an immediate action.
- **Cons**: A user who doesn't understand the clause type they selected may paste an irrelevant
  clause without reading the explanation. Mitigated by keeping the explanation visible by
  default (not collapsed).
- **Effort**: Low

#### Option R2: Explanation first, then clause text, then risks

- **Description**: Result area leads with the plain-language explanation, then shows the clause
  text, then risks.
- **Pros**: Educational-first approach. Users understand before acting.
- **Cons**: Slows down power users who already know what the clause does. Explanation is
  secondary — treating it as primary inverts the value hierarchy. The modal may scroll past the
  clause text, making the copy button less visible.
- **Effort**: Low

#### Option R3: Three-tab layout (Clause / Explanation / Risks)

- **Description**: Results are separated into three tabs. User clicks to switch between views.
- **Pros**: Clean, uncluttered display.
- **Cons**: Hides information that should be visible by default. Risk notes — the most
  actionable information for a legal reviewer — become invisible behind a tab click. Tab
  switching creates cognitive overhead for a feature that should be as frictionless as possible.
- **Effort**: Medium (for lower value)

---

#### Option D1: Severity-badged risk list (Recommended)

- **Description**: Risk notes displayed as a list where each item has a colored severity badge
  (High = red, Medium = amber, Low = green) and the risk description.
- **Pros**: Scannable. Risk severity is immediately visible. Helps legal reviewers (Bob, Scenario
  2) triage which risks to escalate vs. accept. Consistent with how risk is communicated in
  security and compliance tooling that users are likely familiar with.
- **Cons**: Requires badge color decisions and implementation. If the model returns poor severity
  ratings (e.g., everything is "high"), the badge system loses credibility.
- **Effort**: Low

#### Option D2: Plain bulleted list

- **Description**: Risk notes displayed as a simple unordered list, no severity.
- **Pros**: Simplest. No badge color design decisions.
- **Cons**: Legal reviewer cannot quickly identify which risks matter most. All risks look equal
  — a high-severity jurisdictional trap looks the same as a low-severity formatting note.
- **Effort**: Low

---

#### Option L1: Persistent inline disclaimer in result area (Recommended)

- **Description**: Below the clause text block, a single-line notice: "AI-generated content —
  not legal advice. Review with qualified counsel before use." Always visible in the result
  area. Not dismissable.
- **Pros**: Cannot be missed. Low implementation cost. Positions the output correctly as a
  starting point, not an authoritative document. Reduces operator liability risk identified in
  the synthesis review.
- **Cons**: Users who see it repeatedly may start ignoring it (banner blindness). Acceptable
  trade-off — the notice exists for legal coverage, not behavioral control.
- **Effort**: Low

#### Option L2: One-time first-use dismissable dialog

- **Description**: Before the first generation in a session (or ever, with localStorage flag),
  a modal-within-the-modal explains: "This feature uses AI to generate clause drafts. Output
  is not legal advice." User must click "I understand" to proceed.
- **Pros**: Users cannot miss it on first use. Creates an acknowledgment record.
- **Cons**: Friction on first use. localStorage-based "seen it" flag doesn't work across devices
  or incognito sessions. Adds implementation complexity. Annoying for power users.
- **Effort**: Medium (for significant friction cost)

#### Option L3: No disclaimer

- **Description**: No disclaimer displayed.
- **Pros**: No friction.
- **Cons**: Non-lawyers will paste AI-generated clause text into real contracts without any
  prompt to review. Operator liability risk. The synthesis review explicitly flagged this.
- **Effort**: Low (but creates product risk)

### Recommendation

**UI placement:** Option 1 (modal dialog) for v1. The modal is the correct scope for an
ephemeral, single-shot interaction. Revisit slide-over (Option 3) if user testing shows the
copy-paste round-trip is a significant pain point — that data is worth having before the
added complexity.

**Loading state:** Option B (animated status messages with cancel). The 25–30 second wait time
makes this non-negotiable. A spinner-only experience will generate immediate user complaints and
unnecessary Witness/support load. The cancel button is a simple `AbortController` on the
frontend; it reduces user frustration and prevents duplicate submissions.

**Clause type presentation:** Option X (dropdown with short descriptions). The investment in a
custom select component (or Radix/Headless UI Listbox) pays for itself in user success rate
for non-lawyers. Without descriptions, Carol selects the wrong clause type and the feature
fails her on first use.

**Result display:** Option R1 (clause text first). Primary deliverable is visible first. The
"Copy clause text" button must appear within the first screenful of the result — not below a
long explanation. Keep the explanation brief (1–3 sentences, per the API leg's recommendation)
so clause text and copy button are visible without scrolling on most viewports.

**Risk display:** Option D1 (severity-badged list). The badge system requires prompt engineering
discipline (severity must be a bounded enum, not free text from the model), but the UX value
for the legal reviewer persona (Bob) justifies it.

**Disclaimer:** Option L1 (persistent inline). Non-negotiable given the synthesis review's
explicit call-out of operator liability risk.

**Context input:** Free-text textarea (consistent with API leg recommendation for v1). Add a
placeholder example: `"SaaS vendor, B2B, liability cap 12 months of fees"` to demonstrate
the level of context that improves output quality. Consider a character counter visible when
approaching the 2000-character limit.

## Constraints Identified

- **The 30-second wait is a hard UX constraint.** The loading state must communicate active
  progress from the first second. If the backend timeout is extended beyond 30 seconds, the
  UX design must be revisited — at 45+ seconds, the feature becomes unusable without a
  streaming response.
- **Plain-text clause output must be rendered in a monospace block** (consistent with the
  contract content display). Do NOT use a `<pre>` tag without appropriate overflow and wrapping
  — long clause lines will overflow the modal horizontally on small viewports.
- **The copy button requires HTTPS in production.** `navigator.clipboard.writeText()` is
  restricted to secure contexts. If the production deployment is not HTTPS, a fallback
  (`document.execCommand('copy')` or a "Select all" affordance) must be present. This must be
  confirmed with the infrastructure owner before ship.
- **Mobile viewport support is uncertain.** A modal with a dropdown, textarea, and multi-section
  result display must scroll correctly on mobile. If Agreement Hub users primarily use desktop,
  this can be deprioritized — but the constraint must be explicitly accepted, not ignored.
- **The ephemeral contract must be communicated at the result display level**, not just in
  documentation. Users who close the modal without copying their clause must not be surprised
  by missing results. An "Are you sure? Your generated clause will be lost." dismissal
  confirmation is optional but worth considering if usage data shows frequent accidental closure.

## Open Questions

1. **Cancel during generation**: Should the user be able to cancel a pending generate request?
   Recommended: yes (AbortController on frontend, backend timeout enforces its own cutoff).
   This requires a product decision on whether to show a cancel button immediately or only
   after N seconds.

2. **What happens if `risks[]` is empty?** If the model returns no risks for a given clause
   type, should the "Risk notes" section be hidden or show "No specific risks identified"?
   Recommendation: always show the section with a "None identified for this clause type."
   message — hiding it may cause users to think risk analysis was not performed.

3. **Disclaimer link**: Should the "not legal advice" disclaimer link to a help article or
   Terms of Service? A bare text notice is defensible; a linked disclaimer is stronger. Depends
   on legal team's preference.

4. **First-use onboarding**: Should there be a brief tooltip or spotlight on the "Generate
   Clause" button the first time a user visits the contract edit view? Low implementation cost,
   potentially high discoverability value. Requires localStorage or DB flag.

5. **Context field label and guidance**: Is "Context (optional)" the right label? Alternative:
   "Additional context (optional) — describe the deal type, parties, and any specific
   requirements." The label and placeholder together are the primary UX for context quality.

6. **Explanation length target**: The API leg proposes 1–3 sentences. For Scenario 3 (Carol
   learning what a force majeure clause does), 3 sentences may be insufficient. Consider a
   product decision on whether to allow the model to produce a 1–2 paragraph explanation for
   unfamiliar clause types, with the prompt instructing brevity as a default.

7. **Re-generate behavior**: After a successful generation, should the user be able to modify
   their inputs and re-generate without closing the modal? The current design implies yes (form
   fields remain editable). The previous result should be replaced (not shown alongside the
   new one) to avoid confusion.

## Integration Points

- **API design (see api.md)**: The result display hierarchy (clause text → explanation → risks)
  maps directly to the `ClauseResult` type schema (`text`, `explanation`, `risks: RiskItem[]`).
  The `severity` field on `RiskItem` is required for the Option D1 severity-badge display — any
  change to the risks schema (e.g., removing severity, making it optional) would require a
  redesign of the risk display section. Treat severity as a first-class field, not optional.
- **Error messages**: The error message strings proposed in api.md are the source of truth for
  UX copy. The UX design assumes these strings are human-readable and can be displayed directly
  in the inline error callout without transformation. If the backend returns machine-readable
  codes instead of human-readable messages, a frontend translation layer is needed.
- **Auth middleware**: If the endpoint requires authentication and the frontend does not currently
  maintain session state in a queryable way, the UX must handle the "Generate Clause" button
  being disabled or hidden for unauthenticated users. The button must not appear in contexts
  where the API call would return 401.
- **Clause Library (use case #5)**: The ephemeral design is a deliberate non-goal, but the UX
  must not create a false affordance of persistence. When use case #5 ships, the modal result
  area is the natural place to add a "Save to Clause Library" secondary button. Designing the
  result area with this future extension in mind (button slot beneath clause text) avoids a
  layout redesign.
- **AI Risk Reviewer (use case #2)**: The risk notes display in this feature is the user's first
  exposure to structured risk feedback from AI. The severity-badge vocabulary (High/Medium/Low)
  should be consistent with however the Risk Reviewer surfaces risk severity — establishing a
  shared visual language now reduces user re-learning when use case #2 ships.
