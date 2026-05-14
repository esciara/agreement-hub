# Functional Use Cases

This folder captures product use cases that can be used to evolve Agreement Hub.

## Reusable Context

```text
This repository is Agreement Hub, a lightweight Contract Lifecycle Management application.

Current application:
- React/Vite frontend.
- Express/TypeScript backend.
- SQLite persistence.
- Basic contract CRUD is already implemented.

General constraints:
- Keep the application simple, readable, maintainable, and easy to extend.
- Stay consistent with the current architecture unless a change is clearly justified.
- Avoid overengineering.
- Add tests where behavior changes.
- Keep frontend and backend types aligned.
```

## Use Cases

1. **AI Clause Generator**: Users should be able to provide a few structured inputs and receive a generated contract clause with a short explanation and risk notes.
2. **AI Risk Reviewer**: Users should be able to submit contract or clause content and receive structured risk findings with explanations and recommended actions where relevant.
3. **Contract Approval Workflow**: Contracts should support simple approval requirements, approval actions, approval status, and approval history.
4. **Contract Intelligence / Search**: Users should be able to search and filter contracts by keyword and useful contract metadata, including practical queries like expiring contracts, risky clauses, GDPR-sensitive content, or specific vendors.
5. **Clause Library Management**: Users should be able to create, browse, edit, archive, and reuse clause templates.
