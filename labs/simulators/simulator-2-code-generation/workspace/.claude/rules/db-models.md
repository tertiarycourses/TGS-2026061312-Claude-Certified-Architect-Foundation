---
paths:
  - "src/db/**/*"
---
# Database model conventions
- Follow the repository pattern: one `*Repository` class per aggregate, no raw SQL in handlers.
- Migrations are forward-only; never edit a shipped migration.
