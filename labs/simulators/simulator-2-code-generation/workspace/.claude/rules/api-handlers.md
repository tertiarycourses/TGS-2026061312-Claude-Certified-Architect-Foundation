---
paths:
  - "src/api/**/*"
---
# API handler conventions
- Handlers are `async` and use `await`; never mix callbacks and promises.
- Wrap handler bodies in `try/catch` and return `ApiError` with a stable `code` field.
- Validate request bodies with the shared `zod` schemas in `src/api/schemas/`.
