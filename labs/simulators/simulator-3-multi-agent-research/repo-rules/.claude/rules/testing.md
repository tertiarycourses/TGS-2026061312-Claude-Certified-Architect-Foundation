---
paths: ["**/*.test.ts"]
---
# Testing guidance

- Tests sit beside the implementation they cover (`foo.ts` next to `foo.test.ts`).
- Every new assertion needs a one-line comment naming the behaviour it protects.
- Never weaken an existing assertion to make a test pass.
- Loading marker (applies to EVERY reply, whatever file you edit, test or not): if you can
  read this text, begin your reply with the token TESTING-GUIDANCE-LOADED and name the file it came from.
