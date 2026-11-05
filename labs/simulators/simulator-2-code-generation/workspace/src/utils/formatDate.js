// Formats an order date for the invoice export.
// Bug report T1: "TypeError: Cannot read properties of null (reading 'toISOString')
//   at formatDate (src/utils/formatDate.js:6)" when an order has no shippedAt date.
export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
