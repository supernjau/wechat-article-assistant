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
