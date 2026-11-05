// Stands in for `npm test`: prints the dependency warnings and absolute paths CI logs usually carry.
console.log("npm WARN deprecated inflight@1.0.6: This module is not supported");
console.log("npm WARN deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported");
console.log("(node:4242) DeprecationWarning: punycode is deprecated");
console.log(`ok 3 tests passed in ${process.cwd()}/tests/quantity.test.js (41ms)`);
