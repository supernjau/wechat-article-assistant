const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/core.js");

test("parseKeywords splits commas and new lines, removes duplicates, and sorts longest first", () => {
  assert.deepEqual(Core.parseKeywords("fit, suitable\nappropriate， fit"), [
    "appropriate",
    "suitable",
    "fit",
  ]);
});

test("safeUrl blocks script URLs and keeps normal article URLs", () => {
  assert.equal(Core.safeUrl("javascript:alert(1)"), "");
  assert.equal(Core.safeUrl(" DATA:text/html,<p>bad</p> "), "");
  assert.equal(Core.safeUrl("vbscript:msgbox(1)"), "");
  assert.equal(
    Core.safeUrl(" https://mp.weixin.qq.com/s/example "),
    "https://mp.weixin.qq.com/s/example",
  );
});
