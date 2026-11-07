// Run with: node engine.test.js   (extracts the pure ENGINE block from pixel-life-sim.html and tests the three golden rules)
const fs = require("fs"), assert = require("assert");
const html = fs.readFileSync(__dirname + "/pixel-life-sim.html", "utf8");
const a = html.indexOf("const ENGINE = (() => {"), b = html.indexOf("})();", a) + 5;
const ENGINE = new Function(html.slice(a, b) + "; return ENGINE;")();

// Rule 1: never invent another person
const solo = ENGINE.resolve({ activityId: "work", people: [] });
assert.deepStrictEqual(solo.instance.cast.map(c => c.id), ["hero"]);
const refused = ENGINE.resolve({ activityId: "work", people: ["partner"] });          // work is SOLO: a named partner is refused, not silently added
assert.deepStrictEqual(refused.instance.cast.map(c => c.id), ["hero"]);
assert.strictEqual(refused.rejected[0].reason, "NOT_ALLOWED_FOR_ACTIVITY");
assert.strictEqual(ENGINE.resolve({ activityId: "eat", people: ["stranger"] }).rejected[0].reason, "UNKNOWN_CHARACTER");

// A phone call: the other person is REMOTE (a panel), never in the room; nobody named -> a faceless caller
const call = ENGINE.resolve({ activityId: "call", people: ["mentor"] }).instance.cast;
assert.strictEqual(call.find(c => c.id === "mentor").presence, "REMOTE");
assert.strictEqual(ENGINE.resolve({ activityId: "call", people: [] }).instance.cast[1].id, "caller");

// A group shortcut expands to real members only
assert.deepStrictEqual(ENGINE.resolve({ activityId: "family", people: ["family"] }).instance.cast.map(c => c.id), ["hero", "partner", "child"]);

// Rule 2: the same input gives the same output
const j = (x) => JSON.stringify(x);
assert.strictEqual(j(ENGINE.resolve({ activityId: "eat", people: ["partner", "child"] })), j(ENGINE.resolve({ activityId: "eat", people: ["partner", "child"] })));

// Rule 3: a preview never writes
assert.strictEqual(ENGINE.resolve({ activityId: "workout", people: [] }).instance.ledgerWrite, false);
console.log("engine: all tests passed");

// "Fit to N seconds": the plan always fits the budget, keeps highlights first, and every skipped scene still counts
const fa = html.indexOf("const FIT = {"), fb = html.indexOf("function quietApply");
const { fitPlan, FIT } = new Function(html.slice(fa, fb) + "; return { fitPlan, FIT };")();
const mk = (n) => Array.from({ length: n }, (_, i) => ({ sid: "s" + i, rewards: [{ pts: i % 7 === 0 ? 20 : 3 }] }));
for (const total of [30, 45, 60]) for (const n of [5, 10, 25, 60]) {
  FIT.total = total; const plan = fitPlan(mk(n)); const used = plan.play.length * plan.per;
  assert(used <= total - 3.4, `n=${n} total=${total} used=${used}`);                         // leaves room for the ending
  assert(plan.per >= 1.79 || plan.play.length === n, "slice too short to see");
  assert.strictEqual(plan.play.length + plan.skip.size, n);                                  // nothing lost: played + silently counted
}
FIT.total = 30; const hl = fitPlan(mk(60)); assert(hl.play.some(e => e.rewards[0].pts === 20), "highlights kept");
console.log("fit-to-N: all tests passed");
