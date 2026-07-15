// Verify admin plumbing against a LOCAL sqlite DB (no prod writes):
// roster seed-on-empty, add/remove, auth token round-trip, handle parsing.
process.env.ADMIN_PASSWORD = "test-secret-123";
delete process.env.DATABASE_URL; // force sqlite backend

const { loadXRoster } = await import("../src/lib/adapters/x");
const { addXAccount, removeXAccount, getXAccounts } = await import("../src/lib/db");
const { expectedToken, passwordValid, tokenValid } = await import("../src/lib/adminAuth");

// 1. seed-on-empty
const seeded = await loadXRoster();
console.log("seed: org=" + seeded.org.length, "people=" + seeded.people.length, "(expect 20 / 45)");

// 2. add + remove round-trip
await addXAccount("newtestaccount", "people");
let after = await getXAccounts();
console.log("after add: has newtestaccount =", after.some((a) => a.handle === "newtestaccount"));
await removeXAccount("newtestaccount");
after = await getXAccounts();
console.log("after remove: has newtestaccount =", after.some((a) => a.handle === "newtestaccount"), "(expect false)");

// 3. idempotent seed (should NOT duplicate)
const again = await loadXRoster();
console.log("re-load stable: org=" + again.org.length, "people=" + again.people.length);

// 4. auth token round-trip
const tok = expectedToken();
console.log("password valid (correct):", passwordValid("test-secret-123"), "(expect true)");
console.log("password valid (wrong):", passwordValid("nope"), "(expect false)");
console.log("token valid (matching):", tokenValid(tok), "(expect true)");
console.log("token valid (tampered):", tokenValid("deadbeef"), "(expect false)");

// 5. no-password → closed
process.env.ADMIN_PASSWORD = "";
console.log("token when unconfigured:", expectedToken(), "(expect null)");
console.log("passwordValid when unconfigured:", passwordValid(""), "(expect false)");

process.exit(0);
