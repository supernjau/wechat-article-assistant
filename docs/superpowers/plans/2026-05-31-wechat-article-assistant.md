# 微信公众号文章助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可加载到 Chrome 的 Manifest V3 插件，为微信公众号官方编辑器增加 HTML 导入、全文关键词强调和往期推荐模板插入功能。

**Architecture:** 插件由纯函数核心、公众号编辑器适配层和侧边面板三部分组成。核心工具可在 Node 中单元测试；适配层集中处理正文定位、HTML 清理、覆盖和光标插入；面板负责交互与本地存储。Chrome 工具栏弹窗只负责唤起侧边面板或打开公众号后台。

**Tech Stack:** Chrome Manifest V3、原生 JavaScript、原生 DOM API、CSS、Node.js 内置测试框架。

---

## 文件结构

```text
chajian/
├── manifest.json                  # Chrome 扩展清单
├── package.json                   # 本地检查与测试命令
├── popup.html                     # Chrome 工具栏弹窗
├── popup.css                      # 工具栏弹窗样式
├── popup.js                       # 工具栏弹窗行为
├── preview.html                   # 本地模拟公众号编辑器
├── README.md                      # 安装、使用和真实后台验证说明
├── src/
│   ├── core.js                    # 关键词解析、链接安全、六种模板生成
│   ├── editor-adapter.js          # 正文定位、HTML 清理、覆盖与光标插入
│   ├── content.js                 # 面板状态、交互、本地存储、文章读取
│   └── content.css                # 悬浮入口与侧边面板样式
└── tests/
    └── core.test.js               # Node 单元测试
```

### Task 1: 搭建扩展清单和可测试核心

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `src/core.js`
- Create: `tests/core.test.js`

- [ ] **Step 1: 写关键词与链接安全测试**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/core.js");

test("parseKeywords splits commas and new lines, removes duplicates, and sorts longest first", () => {
  assert.deepEqual(Core.parseKeywords("fit, suitable\nappropriate, fit"), [
    "appropriate",
    "suitable",
    "fit",
  ]);
});

test("safeUrl blocks script URLs and keeps normal article URLs", () => {
  assert.equal(Core.safeUrl("javascript:alert(1)"), "");
  assert.equal(Core.safeUrl(" https://mp.weixin.qq.com/s/example "), "https://mp.weixin.qq.com/s/example");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test`

Expected: FAIL because `src/core.js` does not exist.

- [ ] **Step 3: 写入最小核心实现**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SEWA = root.SEWA || {};
  root.SEWA.Core = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function parseKeywords(value) {
    return [...new Set(String(value || "").split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))]
      .sort((a, b) => b.length - a.length);
  }

  function safeUrl(value) {
    const url = String(value || "").trim();
    return /^(?:javascript|data|vbscript):/i.test(url) ? "" : url;
  }

  return { parseKeywords, safeUrl };
});
```

- [ ] **Step 4: 添加 Manifest V3 清单与命令**

`manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "公众号文章助手",
  "version": "0.1.0",
  "description": "为微信公众号官方编辑器提供 HTML 导入、关键词强调和往期推荐模板。",
  "permissions": ["storage"],
  "host_permissions": ["https://mp.weixin.qq.com/*"],
  "action": {
    "default_title": "公众号文章助手",
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://mp.weixin.qq.com/*"],
      "js": ["src/core.js", "src/editor-adapter.js", "src/content.js"],
      "css": ["src/content.css"],
      "run_at": "document_idle"
    }
  ]
}
```

`package.json`:

```json
{
  "name": "wechat-article-assistant",
  "private": true,
  "scripts": {
    "test": "node --test tests/*.test.js",
    "check": "node -e \"const { existsSync, readFileSync } = require('node:fs'); const { execFileSync } = require('node:child_process'); for (const file of ['src/core.js', 'src/editor-adapter.js', 'src/content.js', 'popup.js']) if (existsSync(file)) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' }); JSON.parse(readFileSync('manifest.json', 'utf8'));\""
  }
}
```

- [ ] **Step 5: 运行测试并确认通过**

Run: `npm test`

Expected: 2 tests PASS.

- [ ] **Step 6: 提交**

```bash
git add manifest.json package.json src/core.js tests/core.test.js
git commit -m "feat: scaffold extension core"
```

### Task 2: 实现六种往期推荐模板

**Files:**
- Modify: `src/core.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: 写模板测试**

```js
test("buildRecommendationHtml supports six templates and escapes article content", () => {
  const articles = [{ title: "<英语>", url: "https://mp.weixin.qq.com/s/demo?a=1&b=2" }];
  for (const template of Core.TEMPLATE_IDS) {
    const html = Core.buildRecommendationHtml(template, articles);
    assert.match(html, /往期推荐/);
    assert.match(html, /&lt;英语&gt;/);
    assert.match(html, /a=1&amp;b=2/);
  }
  assert.equal(Core.TEMPLATE_IDS.length, 6);
});

test("buildRecommendationHtml discards unsafe article URLs", () => {
  const html = Core.buildRecommendationHtml("clean", [{ title: "危险链接", url: "javascript:alert(1)" }]);
  assert.doesNotMatch(html, /javascript:/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test`

Expected: FAIL because template helpers are not defined.

- [ ] **Step 3: 在核心中加入模板生成器**

Add these functions to `src/core.js` and export them:

```js
const TEMPLATE_IDS = ["clean", "numbered", "editor", "border", "magazine", "studio"];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function link(article, label, style) {
  const href = safeRecommendationUrl(article.url);
  const title = escapeHtml(article.title || "未命名文章");
  const content = label ? `${escapeHtml(label)} ${title}` : title;
  return href
    ? `<a href="${escapeHtml(href)}" style="${style}">${content}</a>`
    : `<span style="${style}">${content}</span>`;
}

function buildRecommendationHtml(templateId, articles) {
  const items = (Array.isArray(articles) ? articles : []).slice(0, 5);
  const id = TEMPLATE_IDS.includes(templateId) ? templateId : "clean";
  const heading = `<section style="margin:32px 0 8px;padding:0;"><p style="margin:0 0 14px;font-size:18px;font-weight:700;color:#1f2937;">往期推荐</p>`;
  const end = `</section>`;
  if (id === "numbered") {
    return heading + items.map((article, index) => `<p style="margin:0;padding:10px 0;border-bottom:1px solid #e5e7eb;">${link(article, String(index + 1).padStart(2, "0"), "font-size:15px;line-height:1.7;color:#334155;text-decoration:none;")}</p>`).join("") + end;
  }
  if (id === "editor") {
    return heading + items.map((article) => `<p style="margin:8px 0;padding:10px 12px;background:#f8fafc;border-radius:4px;">${link(article, "精选", "font-size:15px;line-height:1.7;color:#0f766e;text-decoration:none;")}</p>`).join("") + end;
  }
  if (id === "border") {
    return heading + items.map((article) => `<p style="margin:10px 0;padding:2px 0 2px 12px;border-left:3px solid #2563eb;">${link(article, "", "font-size:15px;line-height:1.7;color:#334155;text-decoration:none;")}</p>`).join("") + end;
  }
  if (id === "magazine") {
    return heading + items.map((article) => `<p style="margin:0;padding:11px 0;border-bottom:1px solid #d1d5db;">${link(article, "→", "font-size:15px;line-height:1.7;color:#111827;text-decoration:none;")}</p>`).join("") + end;
  }
  if (id === "studio") {
    return `<section style="margin:32px 0 8px;padding:16px 14px;border:1px solid #dbeafe;background:#f8fbff;"><p style="margin:0 0 4px;font-size:13px;color:#2563eb;">Super英语工作室</p><p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1f2937;">往期推荐</p>` + items.map((article) => `<p style="margin:7px 0;">${link(article, "•", "font-size:15px;line-height:1.7;color:#1d4ed8;text-decoration:none;")}</p>`).join("") + end;
  }
  return heading + items.map((article) => `<p style="margin:0;padding:9px 0;border-bottom:1px solid #eef2f7;">${link(article, "", "font-size:15px;line-height:1.7;color:#334155;text-decoration:none;")}</p>`).join("") + end;
}
```

Recommendation links must only become clickable when they use HTTPS and point to
an official published WeChat article URL under `mp.weixin.qq.com/s`. Invalid,
external, or non-HTTPS URLs degrade to a non-clickable `span` while keeping the
article title. Filter malformed article entries such as `null` before rendering.

The `editor` template must render `精选` as a distinct visual label. The
`magazine` template must render the article title and arrow as separate,
visually split inline structures rather than a plain text prefix.

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test`

Expected: 4 tests PASS.

- [ ] **Step 5: 提交**

```bash
git add src/core.js tests/core.test.js
git commit -m "feat: add recommendation templates"
```

### Task 3: 实现公众号编辑器适配层

**Files:**
- Create: `src/editor-adapter.js`
- Create: `preview.html`

- [ ] **Step 1: 创建本地模拟编辑器**

`preview.html` must include an editable `#ueditor_0`, a mock hyperlink dialog containing five `https://mp.weixin.qq.com/s/` links, and:

```html
<link rel="stylesheet" href="src/content.css">
<script src="src/core.js"></script>
<script src="src/editor-adapter.js"></script>
<script src="src/content.js"></script>
```

- [ ] **Step 2: 实现适配层**

`src/editor-adapter.js` attaches `window.SEWA.EditorAdapter` with these methods:

```js
findEditor()
rememberSelection()
sanitizeHtml(html)
replaceHtml(html)
insertHtml(html)
appendHtml(html)
getHtml()
```

Implementation requirements:

```js
const BLOCKED_TAGS = "script,style,link,meta,iframe,object,embed,form";
const EDITOR_SELECTORS = ["#ueditor_0", ".ProseMirror", "[contenteditable='true']"];
```

- Search the main document first, then same-origin iframe documents.
- Prefer visible candidates with `contenteditable="true"` or `#ueditor_0`.
- Use `DOMParser` to extract `doc.body.innerHTML`.
- Remove blocked tags, attributes beginning with `on`, and unsafe `href`, `src`, `data-src`, or `xlink:href` values.
- Restore a remembered range before `document.execCommand("insertHTML", false, html)`.
- Fall back to range insertion when `execCommand` is unavailable.
- Dispatch bubbling `input` and `change` events after every write.
- Preserve a snapshot and restore it when replacement fails.

- [ ] **Step 3: 做语法检查**

Run: `node --check src/editor-adapter.js`

Expected: exit code 0.

- [ ] **Step 4: 提交**

```bash
git add src/editor-adapter.js preview.html
git commit -m "feat: add editor adapter"
```

### Task 4: 实现侧边面板、HTML 导入和关键词强调

**Files:**
- Create: `src/content.js`
- Create: `src/content.css`
- Modify: `preview.html`

- [ ] **Step 1: 实现悬浮按钮和三标签面板**

`src/content.js` must:

- Guard against duplicate injection with `window.__SEWA_INSTALLED__`.
- Inject a fixed `文章助手` button and a right-side panel.
- Render tabs: `HTML 导入`, `关键词强调`, `往期推荐`.
- Listen for `chrome.runtime.onMessage` action `SEWA_OPEN_PANEL`.
- Fall back to `localStorage` in `preview.html` when `chrome.storage.local` is unavailable.

- [ ] **Step 2: 实现 HTML 导入**

Use `EditorAdapter.sanitizeHtml()` before preview and write. Support:

```js
state.importMode = "replace"; // or "cursor"
state.importHtml = "";
```

- Read `.html` and `.htm` files with `FileReader`.
- Show sanitized HTML inside a sandboxed preview iframe.
- Call `replaceHtml()` or `insertHtml()` only after the user clicks the import button.
- Reject empty sanitized content with a visible status message.

- [ ] **Step 3: 实现关键词强调**

Add:

```js
const HIGHLIGHT_STYLES = {
  marker: "background:#fff1a8;color:inherit;padding:0 2px;",
  red: "color:#c24141;font-weight:700;",
  underline: "color:#1d4ed8;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;"
};
```

Keyword highlighting must:

- Render three visible style choices: `黄色标记`, `红色加粗`, and `蓝色下划线`.
- Parse terms using `Core.parseKeywords()`.
- Walk text nodes with `TreeWalker`.
- Skip `SCRIPT`, `STYLE`, `CODE`, `PRE`, `TEXTAREA`, and existing `[data-sewa-highlight]` nodes.
- Wrap matches in `<span data-sewa-highlight="1" style="...">`.
- Dispatch editor input events.
- Remove only `[data-sewa-highlight]` spans when the user clicks remove.

- [ ] **Step 4: 写面板样式**

`src/content.css` must:

- Prefix every selector with `sewa-`.
- Keep the launcher fixed on the right edge.
- Use a panel width of `390px`, capped at `calc(100vw - 24px)`.
- Use compact labels and controls suitable for repeated editing.
- Use radius no greater than `8px`.
- Provide visible active, hover, disabled, success, and error states.

- [ ] **Step 5: 做语法检查**

Run: `node --check src/content.js && node --check src/editor-adapter.js`

Expected: exit code 0.

- [ ] **Step 6: 提交**

```bash
git add src/content.js src/content.css preview.html
git commit -m "feat: add import and keyword panel"
```

### Task 5: 实现最近文章读取和模板插入

**Files:**
- Modify: `src/content.js`
- Modify: `preview.html`

- [ ] **Step 1: 实现文章读取**

Add `scrapeRecentArticles()` in `src/content.js`:

```js
function scrapeRecentArticles() {
  const containers = [...document.querySelectorAll(
    "[role='dialog'],.weui-desktop-dialog,.dialog,.pop_dialog,.sewa-mock-link-dialog"
  )].filter(isVisible);
  const scope = containers.length ? containers : [document];
  const seen = new Set();
  const articles = [];
  for (const root of scope) {
    for (const anchor of root.querySelectorAll("a[href], [data-url], [data-link]")) {
      const url = Core.safeUrl(anchor.getAttribute("href") || anchor.dataset.url || anchor.dataset.link || "");
      const title = (anchor.getAttribute("data-title") || anchor.textContent || "").trim();
      if (!url || !title || seen.has(url)) continue;
      if (!/mp\.weixin\.qq\.com\/s(?:[/?#]|$)/i.test(url)) continue;
      seen.add(url);
      articles.push({ title, url });
      if (articles.length === 5) return articles;
    }
  }
  return articles;
}
```

- [ ] **Step 2: 实现列表校正**

The recommendation tab must support:

- A visible `读取最近文章` button.
- Editable title and URL fields.
- Add and delete controls.
- Visible `上移` and `下移` controls for上下移动.
- A maximum of five inserted items.
- Storage of the latest article list and selected template.

- [ ] **Step 3: 实现六种模板预览和插入**

Use:

```js
Core.TEMPLATE_IDS
Core.buildRecommendationHtml(state.templateId, state.articles)
```

- Show six template choices.
- Render the selected template in a sandboxed preview iframe.
- Insert at the end using `EditorAdapter.appendHtml()` or at the cursor using `EditorAdapter.insertHtml()`.

- [ ] **Step 4: 在本地模拟页加入五篇链接**

Add a `.sewa-mock-link-dialog` block to `preview.html` with five distinct official article-shaped links so the scraper can be manually verified.

- [ ] **Step 5: 做语法和测试检查**

Run: `npm test && npm run check`

Expected: tests PASS and checks exit code 0.

- [ ] **Step 6: 提交**

```bash
git add src/content.js preview.html
git commit -m "feat: add recent article recommendations"
```

### Task 6: 实现 Chrome 工具栏弹窗

**Files:**
- Create: `popup.html`
- Create: `popup.css`
- Create: `popup.js`

- [ ] **Step 1: 创建紧凑弹窗**

`popup.html` contains:

- Title: `公众号文章助手`
- Short instruction
- Primary button: `打开文章助手`
- Secondary link button: `打开公众号后台`
- Status region

- [ ] **Step 2: 实现弹窗行为**

`popup.js`:

```js
const status = document.querySelector("#status");
document.querySelector("#open-panel").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/mp\.weixin\.qq\.com\//.test(tab.url || "")) {
    status.textContent = "请先打开微信公众号文章编辑页。";
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "SEWA_OPEN_PANEL" });
    window.close();
  } catch {
    status.textContent = "当前页面还未加载文章助手，请刷新页面后重试。";
  }
});

document.querySelector("#open-mp").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://mp.weixin.qq.com/" });
});
```

- [ ] **Step 3: 做语法检查**

Run: `node --check popup.js`

Expected: exit code 0.

- [ ] **Step 4: 提交**

```bash
git add popup.html popup.css popup.js
git commit -m "feat: add toolbar popup"
```

### Task 7: 编写说明并完成验证

**Files:**
- Create: `README.md`
- Modify: `preview.html`

- [ ] **Step 1: 编写安装与使用说明**

`README.md` must include:

- Chrome 扩展程序页加载 `chajian` 文件夹的方法。
- 三个功能的操作步骤。
- 往期推荐的半自动读取流程。
- 插件只使用本地存储、不上传文章内容的说明。
- 公众号后台改版后优先检查 `src/editor-adapter.js` 和 `scrapeRecentArticles()` 的维护说明。
- 真实后台验证清单。

- [ ] **Step 2: 运行完整静态验证**

Run: `npm test && npm run check`

Expected: all tests PASS and syntax checks exit code 0.

- [ ] **Step 3: 本地打开 `preview.html` 验证界面**

Verify manually:

- Panel opens and tabs switch correctly.
- HTML preview and replace work.
- Cursor insertion works after clicking the sample article.
- All three keyword styles apply and remove cleanly.
- Five mock articles load.
- All six templates preview and insert.

- [ ] **Step 4: 检查 Git 工作区**

Run: `git status --short`

Expected: only intentional files are modified or untracked.

- [ ] **Step 5: 提交**

```bash
git add README.md preview.html
git commit -m "docs: add extension usage guide"
```

- [ ] **Step 6: 真实后台验证交接**

Ask the user to:

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Click “加载已解压的扩展程序”.
4. Select the `chajian` folder.
5. Open a微信公众号文章编辑页 and verify the checklist in `README.md`.
