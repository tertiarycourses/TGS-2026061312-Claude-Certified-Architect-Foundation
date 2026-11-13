// Topic 1 · Simulator 2 (Code Generation with Claude Code): a small virtual copy of the Orderly workspace,
// ported from labs/simulators/simulator-2-code-generation/workspace. Labs 3 and 7 load it into E.repo().

export const WORKSPACE = {
  "CLAUDE.md": `# Orderly web app

Monorepo for the Orderly storefront: React front end, Node API, Postgres models.

## Universal standards (always loaded)
- Run \`npm test -- --changed\` before you report a change as done.
- Prefer small, reviewable diffs.
`,
  "package.json": `{ "name": "orderly", "private": true, "type": "module", "dependencies": { "moment": "^2.30.1" } }
`,
  "src/utils/quantity.js": `// Validates an order line quantity before it reaches the repository.
export function validateQuantity(qty) {
  if (!Number.isInteger(qty)) throw new Error("quantity must be an integer");
  return qty;
}
`,
  "src/utils/formatDate.js": `// Formats an order date for the invoice export.
// Bug report T1: "TypeError: Cannot read properties of null (reading 'toISOString')
//   at formatDate (src/utils/formatDate.js:6)" when an order has no shippedAt date.
export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
`,
  "src/api/orders.js": `import moment from "moment";
import { authorize } from "../middleware/authorize.js";
import { OrderRepository } from "../db/orderRepository.js";
import { formatDate } from "../utils/formatDate.js";

const repo = new OrderRepository();

export async function getOrder(req, res) {
  if (!authorize(req.user, "orders:read")) return res.status(403).end();
  const order = await repo.findById(req.params.id);
  if (!order) return res.status(404).end();
  res.json({ ...order, shippedAt: formatDate(order.shippedAt), age: moment(order.createdAt).fromNow() });
}
`,
  "src/services/invoice.ts": `import moment from "moment";
import { formatDate } from "../utils/formatDate.js";

export interface Invoice { id: string; issuedAt: Date; dueAt: Date | null; }

export function renderInvoiceHeader(inv: Invoice): string {
  return \`\${inv.id} issued \${formatDate(inv.issuedAt)} due \${formatDate(inv.dueAt)}\`;
}
`,
  "src/services/report.ts": `import { formatDate } from "../utils/formatDate.js";

export function reportLine(label: string, when: Date): string {
  return \`\${label}: \${formatDate(when)}\`;
}
`,
};

// Write: create or overwrite a whole file (E.repo() ships Read, Grep, Glob and Edit).
export function writeTool(fs) {
  return {
    description: "Create a new file, or overwrite an existing one, with the full content given.",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    run: ({ path, content }) => { const isNew = !(path in fs); fs[path] = content; return `${isNew ? "Created" : "Overwrote"} ${path}`; },
  };
}

// Which files differ between two snapshots of the virtual file system.
export function changedFiles(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => before[k] !== after[k]).sort();
}
