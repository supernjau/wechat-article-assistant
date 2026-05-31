const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("manifest references extension resources that exist", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const referenced = [
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...entry.css]),
  ];
  for (const file of referenced) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
  assert.deepEqual(manifest.permissions, ["storage"]);
});

test("content panel exposes the three requested workflows", () => {
  const content = read("src/content.js");
  for (const label of ["HTML 导入", "关键词强调", "往期推荐"]) {
    assert.match(content, new RegExp(label));
  }
  for (const action of [
    "import-html",
    "apply-highlight",
    "remove-highlight",
    "scrape-articles",
    "insert-recommendations",
  ]) {
    assert.match(content, new RegExp(`data-sewa-action="${action}"`));
  }
});

test("recent article scraper recognizes official radio-list rows without requiring URLs", () => {
  const content = read("src/content.js");
  assert.match(content, /input\[type='radio'\]/);
  assert.match(content, /Core\.collectRecentArticles/);
  assert.match(content, /缺少有效链接/);
});

test("HTML import action stays visible before the long preview area", () => {
  const content = read("src/content.js");
  const action = content.indexOf('data-sewa-action="import-html"');
  const preview = content.indexOf('title="HTML 导入预览"');
  assert.notEqual(action, -1);
  assert.notEqual(preview, -1);
  assert.ok(action < preview, "导入正文按钮必须放在预览框之前");
});

test("local preview provides five official-shaped article links", () => {
  const preview = read("preview.html");
  const links =
    preview.match(/href="https:\/\/mp\.weixin\.qq\.com\/s\/[^"]+"/g) || [];
  assert.equal(links.length, 5);
  assert.match(preview, /id="ueditor_0" contenteditable="true"/);
});

test("panel CSS keeps a mobile-safe width and restrained radii", () => {
  const css = read("src/content.css");
  assert.match(css, /width:\s*390px/);
  assert.match(css, /max-width:\s*calc\(100vw - 24px\)/);
  assert.doesNotMatch(css, /border-radius:\s*(?:[9-9]|[1-9][0-9]+)px/);
});

test("primary actions resist host-page button style overrides", () => {
  const css = read("src/content.css");
  assert.match(css, /\.sewa-panel button\.sewa-primary-button\s*\{/);
  assert.match(css, /background-color:\s*#0f766e\s*!important/);
  assert.match(css, /color:\s*#ffffff\s*!important/);
  assert.match(css, /opacity:\s*1\s*!important/);
  assert.match(css, /visibility:\s*visible\s*!important/);
  assert.match(read("src/content.js"), /class="sewa-button-icon"[^>]*>↓<\/span>导入正文/);
});
