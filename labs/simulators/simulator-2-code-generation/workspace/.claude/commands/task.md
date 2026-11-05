---
description: Decide whether a developer request needs investigation, a plan, or a direct code change, then do it
argument-hint: <request>
---
Classify the request below, then act on the chosen path. Decide with the examples; they show why one path beats the plausible alternatives.

<example>
request: "look into this error: TypeError in formatDate"
path: investigate
why: a diagnosis is asked for, not a change; editing before understanding the cause risks fixing the wrong line.
</example>
<example>
request: "can you improve this module src/api/orders.js"
path: plan
why: "improve" has no acceptance criterion and the module has several callers; propose options before touching files.
</example>
<example>
request: "clean this up: remove the unused imports in src/db/orderRepository.js"
path: modify
why: one file, one named change, nothing to decide; planning would only add overhead.
</example>

Request: $ARGUMENTS
