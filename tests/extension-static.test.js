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
    ...manifest.web_accessible_resources.flatMap((entry) => entry.resources),
  ];
  for (const file of referenced) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
  assert.deepEqual(manifest.permissions, ["storage"]);
});

test("official editor writes go through the page-level MP editor bridge", () => {
  const adapter = read("src/editor-adapter.js");
  const bridge = read("src/page-bridge.js");
  const content = read("src/content.js");

  assert.match(adapter, /src\/page-bridge\.js/);
  assert.match(adapter, /mp_editor_set_content/);
  assert.match(adapter, /mp_editor_get_content/);
  assert.match(adapter, /mp_editor_insert_html/);
  assert.match(bridge, /__MP_Editor_JSAPI__/);
  assert.match(bridge, /api\.invoke/);
  assert.match(content, /async function handleImport/);
  assert.match(content, /await recordedWrite\(/);
  assert.match(content, /EditorAdapter\.replaceHtml\(html\)/);
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
  assert.match(content, /Core\.pickRecentTitle/);
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

test("recent articles load from the publish-list API with DOM fallback and no manual dialog step", () => {
  const content = read("src/content.js");
  assert.match(content, /\/cgi-bin\/appmsgpublish/);
  assert.match(content, /Core\.parsePublishedArticles/);
  assert.match(content, /return scrapeRecentArticles\(\)/);
  assert.doesNotMatch(content, /data-sewa-action="open-links"/);
});

test("keyword highlight panel offers keyword sets, first-only toggle and live hit counts", () => {
  const content = read("src/content.js");
  for (const action of ["save-keyword-set", "delete-keyword-set"]) {
    assert.match(content, new RegExp(`data-sewa-action="${action}"`));
  }
  assert.match(content, /sewa-first-only/);
  assert.match(content, /sewa-keyword-hits/);
  assert.match(content, /Core\.planKeywordMatches/);
  assert.match(content, /keywordSets: state\.keywordSets/);
});

test("secondary and add buttons also resist host-page button style overrides", () => {
  const css = read("src/content.css");
  assert.match(css, /\.sewa-panel button\.sewa-secondary-button,\s*\.sewa-panel button\.sewa-add-button\s*\{/);
  assert.match(css, /border:\s*1px solid #cbd5e1\s*!important/);
});

test("highlight apply and remove write through the official editor API instead of mutating page DOM", () => {
  const content = read("src/content.js");
  const adapter = read("src/editor-adapter.js");
  assert.match(content, /async function transformBody/);
  assert.match(content, /await EditorAdapter\.setContent\(/);
  assert.match(content, /async function applyHighlights/);
  assert.match(content, /async function handleRemoveHighlights/);
  assert.match(adapter, /async function setContent/);
  assert.match(adapter, /mp_editor_set_content/);
});

test("highlight marks are recognised by key styles because the official editor strips custom attributes", () => {
  const content = read("src/content.js");
  assert.match(content, /function isHighlightMark/);
  assert.match(content, /HIGHLIGHT_KEY_STYLES/);
  assert.match(content, /background-color:#fff1a8/);
  assert.match(content, /filter\(isHighlightMark\)/);
});

test("plugin operations are backed up and the panel offers undo and redo", () => {
  const content = read("src/content.js");
  for (const action of ["undo", "redo"]) {
    assert.match(content, new RegExp(`data-sewa-action="${action}"`));
  }
  assert.match(content, /Core\.createHistory/);
  assert.match(content, /history\.record\(/);
  assert.match(content, /无法备份当前正文，已取消操作/);
  assert.match(content, /recordedWrite\("插入往期推荐"/);
  assert.match(content, /transformBody\("应用强调"/);
  assert.match(content, /transformBody\("移除强调"/);
});
