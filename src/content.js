(function (root) {
  "use strict";

  if (root.__SEWA_INSTALLED__) return;
  root.__SEWA_INSTALLED__ = true;

  const Core = root.SEWA && root.SEWA.Core;
  const EditorAdapter = root.SEWA && root.SEWA.EditorAdapter;
  if (!Core || !EditorAdapter) {
    console.warn("公众号文章助手加载失败：核心模块或编辑器适配层不可用。");
    return;
  }

  const STORAGE_KEY = "sewaArticleAssistant";
  const HIGHLIGHT_STYLES = {
    marker: "background:#fff1a8;color:inherit;padding:0 2px;",
    red: "color:#c24141;font-weight:700;",
    underline:
      "color:#1d4ed8;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;",
  };
  const TEMPLATE_LABELS = {
    clean: "清爽列表",
    numbered: "数字目录",
    editor: "编辑精选",
    border: "极简边框",
    magazine: "杂志索引",
    studio: "工作室风格",
  };
  const state = {
    activeTab: "import",
    importMode: "replace",
    importHtml: "",
    highlightTerms: "",
    highlightStyle: "marker",
    articles: [],
    templateId: "clean",
    recommendMode: "append",
  };

  function escape(value) {
    return Core.escapeHtml(String(value || ""));
  }

  function storageAvailable() {
    return Boolean(
      root.chrome &&
        root.chrome.storage &&
        root.chrome.storage.local &&
        typeof root.chrome.storage.local.get === "function",
    );
  }

  async function loadState() {
    try {
      let saved = {};
      if (storageAvailable()) {
        saved = (await root.chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
      } else {
        saved = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || "{}");
      }
      Object.assign(state, {
        importMode: saved.importMode === "cursor" ? "cursor" : "replace",
        highlightTerms: String(saved.highlightTerms || ""),
        highlightStyle: HIGHLIGHT_STYLES[saved.highlightStyle]
          ? saved.highlightStyle
          : "marker",
        articles: Array.isArray(saved.articles) ? saved.articles.slice(0, 5) : [],
        templateId: Core.TEMPLATE_IDS.includes(saved.templateId)
          ? saved.templateId
          : "clean",
        recommendMode: saved.recommendMode === "cursor" ? "cursor" : "append",
      });
    } catch {
      showStatus("无法读取本地设置，将使用默认值。", "error");
    }
  }

  async function saveState() {
    const saved = {
      importMode: state.importMode,
      highlightTerms: state.highlightTerms,
      highlightStyle: state.highlightStyle,
      articles: state.articles.slice(0, 5),
      templateId: state.templateId,
      recommendMode: state.recommendMode,
    };
    try {
      if (storageAvailable()) {
        await root.chrome.storage.local.set({ [STORAGE_KEY]: saved });
      } else {
        root.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      }
    } catch {
      showStatus("设置未能保存，但本次操作仍可继续。", "error");
    }
  }

  const launcher = root.document.createElement("button");
  launcher.type = "button";
  launcher.className = "sewa-launcher";
  launcher.setAttribute("aria-label", "打开公众号文章助手");
  launcher.innerHTML = '<span class="sewa-launcher-icon">A</span><span>文章助手</span>';

  const panel = root.document.createElement("aside");
  panel.className = "sewa-panel";
  panel.setAttribute("aria-label", "公众号文章助手");
  panel.innerHTML = `
    <header class="sewa-panel-header">
      <div>
        <p class="sewa-eyebrow">Super英语工作室</p>
        <h2 class="sewa-panel-title">公众号文章助手</h2>
      </div>
      <button type="button" class="sewa-icon-button" data-sewa-action="close" aria-label="关闭文章助手" title="关闭">×</button>
    </header>
    <nav class="sewa-tabs" aria-label="文章助手功能">
      <button type="button" class="sewa-tab is-active" data-sewa-tab="import">HTML 导入</button>
      <button type="button" class="sewa-tab" data-sewa-tab="highlight">关键词强调</button>
      <button type="button" class="sewa-tab" data-sewa-tab="recommend">往期推荐</button>
    </nav>
    <div class="sewa-panel-body">
      <section class="sewa-view is-active" data-sewa-view="import">
        <p class="sewa-hint">粘贴 HTML 代码，或选择已排版的文章文件。</p>
        <label class="sewa-file-button">
          <span>选择 HTML 文件</span>
          <input class="sewa-file-input" type="file" accept=".html,.htm,text/html">
        </label>
        <label class="sewa-field">
          <span class="sewa-label">HTML 代码</span>
          <textarea class="sewa-textarea sewa-import-code" rows="8" placeholder="在这里粘贴 HTML 代码"></textarea>
        </label>
        <div class="sewa-field">
          <span class="sewa-label">导入方式</span>
          <div class="sewa-segments">
            <label class="sewa-segment"><input type="radio" name="sewa-import-mode" value="replace" checked><span>覆盖正文</span></label>
            <label class="sewa-segment"><input type="radio" name="sewa-import-mode" value="cursor"><span>插入光标位置</span></label>
          </div>
        </div>
        <button type="button" class="sewa-primary-button sewa-import-submit" data-sewa-action="import-html"><span class="sewa-button-icon" aria-hidden="true">↓</span>导入正文</button>
        <div class="sewa-field">
          <span class="sewa-label">导入预览</span>
          <iframe class="sewa-preview-frame sewa-import-preview" sandbox="" title="HTML 导入预览"></iframe>
        </div>
      </section>

      <section class="sewa-view" data-sewa-view="highlight">
        <p class="sewa-hint">每行输入一个关键词，也可以使用逗号分隔。</p>
        <label class="sewa-field">
          <span class="sewa-label">关键词</span>
          <textarea class="sewa-textarea sewa-highlight-terms" rows="6" placeholder="例如：suitable, appropriate"></textarea>
        </label>
        <div class="sewa-field">
          <span class="sewa-label">强调样式</span>
          <div class="sewa-style-options">
            <label class="sewa-style-choice"><input type="radio" name="sewa-highlight-style" value="marker" checked><span class="sewa-marker-sample">黄色标记</span></label>
            <label class="sewa-style-choice"><input type="radio" name="sewa-highlight-style" value="red"><span class="sewa-red-sample">红色加粗</span></label>
            <label class="sewa-style-choice"><input type="radio" name="sewa-highlight-style" value="underline"><span class="sewa-underline-sample">蓝色下划线</span></label>
          </div>
        </div>
        <div class="sewa-button-row">
          <button type="button" class="sewa-primary-button" data-sewa-action="apply-highlight">应用强调</button>
          <button type="button" class="sewa-secondary-button" data-sewa-action="remove-highlight">移除本插件强调</button>
        </div>
      </section>

      <section class="sewa-view" data-sewa-view="recommend">
        <p class="sewa-hint">先打开官方“超链接”窗口，再读取最近文章。读取后可在这里校正。</p>
        <div class="sewa-button-row">
          <button type="button" class="sewa-secondary-button" data-sewa-action="open-links">打开超链接入口</button>
          <button type="button" class="sewa-primary-button" data-sewa-action="scrape-articles">读取最近文章</button>
        </div>
        <div class="sewa-article-list"></div>
        <button type="button" class="sewa-add-button" data-sewa-action="add-article">＋ 添加文章</button>
        <div class="sewa-field">
          <span class="sewa-label">推荐模板</span>
          <div class="sewa-template-grid"></div>
        </div>
        <div class="sewa-field">
          <span class="sewa-label">模板预览</span>
          <iframe class="sewa-preview-frame sewa-recommend-preview" sandbox="" title="往期推荐预览"></iframe>
        </div>
        <div class="sewa-field">
          <span class="sewa-label">插入位置</span>
          <div class="sewa-segments">
            <label class="sewa-segment"><input type="radio" name="sewa-recommend-mode" value="append" checked><span>正文末尾</span></label>
            <label class="sewa-segment"><input type="radio" name="sewa-recommend-mode" value="cursor"><span>光标位置</span></label>
          </div>
        </div>
        <button type="button" class="sewa-primary-button" data-sewa-action="insert-recommendations">插入往期推荐</button>
      </section>
    </div>
    <div class="sewa-status" role="status" aria-live="polite"></div>
  `;

  root.document.body.append(launcher, panel);

  const status = panel.querySelector(".sewa-status");
  const importCode = panel.querySelector(".sewa-import-code");
  const importPreview = panel.querySelector(".sewa-import-preview");
  const highlightTerms = panel.querySelector(".sewa-highlight-terms");
  const articleList = panel.querySelector(".sewa-article-list");
  const templateGrid = panel.querySelector(".sewa-template-grid");
  const recommendPreview = panel.querySelector(".sewa-recommend-preview");

  function showStatus(message, type) {
    if (!status) return;
    status.textContent = message || "";
    status.className = `sewa-status${type ? ` is-${type}` : ""}`;
  }

  function dispatchEditorEvents(editor) {
    const EventConstructor =
      (editor.ownerDocument.defaultView && editor.ownerDocument.defaultView.Event) ||
      root.Event;
    editor.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    editor.dispatchEvent(new EventConstructor("change", { bubbles: true }));
  }

  function openPanel() {
    panel.classList.add("is-open");
    launcher.classList.add("is-hidden");
    const editor = EditorAdapter.findEditor();
    if (editor) watchSelection(editor.ownerDocument);
    renderImportPreview();
    renderRecommendations();
  }

  function closePanel() {
    panel.classList.remove("is-open");
    launcher.classList.remove("is-hidden");
  }

  function activateTab(tabName) {
    state.activeTab = tabName;
    for (const tab of panel.querySelectorAll(".sewa-tab")) {
      tab.classList.toggle("is-active", tab.dataset.sewaTab === tabName);
    }
    for (const view of panel.querySelectorAll(".sewa-view")) {
      view.classList.toggle("is-active", view.dataset.sewaView === tabName);
    }
    if (tabName === "recommend") renderRecommendations();
  }

  function sanitizedImportHtml() {
    return EditorAdapter.sanitizeHtml(state.importHtml);
  }

  function renderImportPreview() {
    try {
      const html = sanitizedImportHtml();
      importPreview.srcdoc = html || '<p style="color:#94a3b8;">等待导入内容</p>';
    } catch (error) {
      importPreview.srcdoc = '<p style="color:#b91c1c;">无法预览当前内容</p>';
      showStatus(error.message, "error");
    }
  }

  async function handleImport() {
    try {
      const html = sanitizedImportHtml();
      if (!html.trim()) {
        showStatus("没有可导入的正文内容。", "error");
        return;
      }
      if (
        state.importMode === "replace" &&
        (await EditorAdapter.getHtml()).trim() &&
        !root.confirm("覆盖当前正文？原有正文将被替换。")
      ) {
        return;
      }
      const result =
        state.importMode === "cursor"
          ? await EditorAdapter.insertHtml(html)
          : await EditorAdapter.replaceHtml(html);
      showStatus(result ? "HTML 已写入正文。" : "没有可写入的正文内容。", result ? "success" : "error");
    } catch (error) {
      showStatus(error.message, "error");
    }
  }

  function removeHighlights(editor) {
    const marks = Array.from(editor.querySelectorAll("[data-sewa-highlight]"));
    for (const mark of marks) mark.replaceWith(...Array.from(mark.childNodes));
    editor.normalize();
    if (marks.length) dispatchEditorEvents(editor);
    return marks.length;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function applyHighlights() {
    try {
      const editor = EditorAdapter.findEditor();
      if (!editor) throw new Error("未找到公众号正文编辑器。");
      const terms = Core.parseKeywords(state.highlightTerms);
      if (!terms.length) {
        showStatus("请先输入至少一个关键词。", "error");
        return;
      }
      removeHighlights(editor);
      const regex = new RegExp(terms.map(escapeRegExp).join("|"), "gi");
      const skipTags = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
      const NodeFilter =
        (editor.ownerDocument.defaultView &&
          editor.ownerDocument.defaultView.NodeFilter) ||
        root.NodeFilter;
      const walker = editor.ownerDocument.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent || !node.nodeValue || !node.nodeValue.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            if (parent.closest("[data-sewa-highlight]")) {
              return NodeFilter.FILTER_REJECT;
            }
            return Array.from(skipTags).some((tag) => parent.closest(tag))
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      let count = 0;
      for (const node of nodes) {
        const text = node.nodeValue;
        regex.lastIndex = 0;
        if (!regex.test(text)) continue;
        regex.lastIndex = 0;
        const fragment = editor.ownerDocument.createDocumentFragment();
        let lastIndex = 0;
        for (const match of text.matchAll(regex)) {
          if (match.index > lastIndex) {
            fragment.append(text.slice(lastIndex, match.index));
          }
          const mark = editor.ownerDocument.createElement("span");
          mark.dataset.sewaHighlight = "1";
          mark.setAttribute("style", HIGHLIGHT_STYLES[state.highlightStyle]);
          mark.textContent = match[0];
          fragment.append(mark);
          lastIndex = match.index + match[0].length;
          count += 1;
        }
        fragment.append(text.slice(lastIndex));
        node.replaceWith(fragment);
      }
      if (count) dispatchEditorEvents(editor);
      showStatus(count ? `已强调 ${count} 处关键词。` : "正文中没有找到这些关键词。", count ? "success" : "error");
      saveState();
    } catch (error) {
      showStatus(error.message, "error");
    }
  }

  function handleRemoveHighlights() {
    const editor = EditorAdapter.findEditor();
    if (!editor) {
      showStatus("未找到公众号正文编辑器。", "error");
      return;
    }
    const count = removeHighlights(editor);
    showStatus(count ? `已移除 ${count} 处插件强调。` : "正文中没有本插件添加的强调。", count ? "success" : "");
  }

  function isVisible(element) {
    if (!element || element.hidden) return false;
    const view = element.ownerDocument.defaultView;
    if (!view) return true;
    const style = view.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  const PUBLISHED_DATE_PATTERN =
    /(?:19|20)\d{2}(?:[-/.]\d{1,2}[-/.]\d{1,2}|年\d{1,2}月\d{1,2}日?)/;
  const ARTICLE_URL_ATTRIBUTES = new Set([
    "href",
    "value",
    "data-url",
    "data-link",
    "data-href",
    "data-appmsg-url",
  ]);

  function extractOfficialArticleUrl(element) {
    if (!element) return "";
    const values = [];
    for (const node of [element, ...element.querySelectorAll("*")]) {
      for (const attribute of Array.from(node.attributes || [])) {
        if (
          ARTICLE_URL_ATTRIBUTES.has(attribute.name.toLowerCase()) ||
          /mp\.weixin\.qq\.com/i.test(attribute.value)
        ) {
          values.push(attribute.value);
        }
      }
    }
    for (const value of values) {
      const decodedValues = [String(value || "").replace(/&amp;/gi, "&")];
      try {
        decodedValues.push(decodeURIComponent(decodedValues[0]));
      } catch {
        // Some official attributes contain ordinary percent signs.
      }
      for (const decoded of decodedValues) {
        const direct = Core.safeRecommendationUrl(decoded);
        if (direct) return direct;
        const match = decoded.match(/https:\/\/mp\.weixin\.qq\.com\/s[^\s"'<>]*/i);
        const extracted = Core.safeRecommendationUrl(match && match[0]);
        if (extracted) return extracted;
      }
    }
    return "";
  }

  function extractRecentTitle(element) {
    if (!element) return "";
    const values = [
      element.getAttribute("data-title"),
      element.getAttribute("title"),
    ];
    for (const titled of element.querySelectorAll("[data-title],[class*='title']")) {
      values.push(titled.getAttribute("data-title"), titled.textContent);
    }
    values.push(element.textContent);
    return Core.pickRecentTitle(values);
  }

  function recentArticleRowForElement(element, scope) {
    let current = element;
    while (current && current !== scope) {
      if (PUBLISHED_DATE_PATTERN.test(current.textContent || "")) return current;
      current = current.parentElement;
    }
    return element;
  }

  function scrapeRecentArticles() {
    const containers = Array.from(
      root.document.querySelectorAll(
        "[role='dialog'],.weui-desktop-dialog,.dialog,.pop_dialog,[class*='dialog'],[class*='modal'],.sewa-mock-link-dialog",
      ),
    ).filter(isVisible);
    const scopes = containers.length ? containers : [root.document];
    const candidates = [];
    for (const scope of scopes) {
      for (const element of scope.querySelectorAll(
        "[href],[data-url],[data-link],[data-href],[data-appmsg-url]",
      )) {
        const url = extractOfficialArticleUrl(element);
        if (!url) continue;
        const row = recentArticleRowForElement(element, scope);
        candidates.push({ title: extractRecentTitle(row), url });
      }
      for (const radio of scope.querySelectorAll("input[type='radio']")) {
        if (radio.closest(".sewa-panel,.sewa-launcher")) continue;
        const row = recentArticleRowForElement(radio, scope);
        if (!row) continue;
        const url = extractOfficialArticleUrl(row);
        if (!url && !PUBLISHED_DATE_PATTERN.test(row.textContent || "")) continue;
        candidates.push({ title: extractRecentTitle(row), url });
      }
    }
    return Core.collectRecentArticles(candidates, 5);
  }

  function openOfficialLinkPicker() {
    const controls = Array.from(
      root.document.querySelectorAll("button,a,[role='button']"),
    ).filter(
      (control) =>
        isVisible(control) && !control.closest(".sewa-panel,.sewa-launcher"),
    );
    const target = controls.find((control) =>
      /超链接|插入链接/.test(
        `${control.textContent || ""} ${control.title || ""} ${control.getAttribute("aria-label") || ""}`,
      ),
    );
    if (!target) {
      showStatus("未找到官方超链接按钮，请在编辑器工具栏中手动打开。", "error");
      return;
    }
    target.click();
    showStatus("已尝试打开官方超链接入口。窗口出现后点击“读取最近文章”。", "success");
  }

  function normalizeArticles() {
    state.articles = state.articles
      .filter((article) => article && typeof article === "object")
      .map((article) => ({
        title: String(article.title || ""),
        url: String(article.url || ""),
      }))
      .slice(0, 5);
  }

  function renderArticleRows() {
    normalizeArticles();
    articleList.innerHTML = state.articles.length
      ? state.articles
          .map(
            (article, index) => {
              const hasValidUrl = Boolean(Core.safeRecommendationUrl(article.url));
              return `
              <div class="sewa-article-row" data-sewa-index="${index}">
                <div class="sewa-article-row-header">
                  <span class="sewa-article-number">${String(index + 1).padStart(2, "0")}</span>
                  <div class="sewa-icon-row">
                    <button type="button" class="sewa-mini-button" data-sewa-action="move-up" title="上移" aria-label="上移文章">↑</button>
                    <button type="button" class="sewa-mini-button" data-sewa-action="move-down" title="下移" aria-label="下移文章">↓</button>
                    <button type="button" class="sewa-mini-button is-danger" data-sewa-action="delete-article" title="删除" aria-label="删除文章">×</button>
                  </div>
                </div>
                <input class="sewa-input" data-sewa-article-field="title" value="${escape(article.title)}" placeholder="文章标题">
                <input class="sewa-input${hasValidUrl ? "" : " is-missing"}" data-sewa-article-field="url" value="${escape(article.url)}" placeholder="请补充 https://mp.weixin.qq.com/s/...">
              </div>`;
            },
          )
          .join("")
      : '<p class="sewa-empty">暂未读取文章。可从官方窗口读取，或手动添加。</p>';
    panel.querySelector(".sewa-add-button").disabled = state.articles.length >= 5;
  }

  function renderTemplateGrid() {
    templateGrid.innerHTML = Core.TEMPLATE_IDS.map(
      (id) => `
        <button type="button" class="sewa-template${state.templateId === id ? " is-active" : ""}" data-sewa-template="${id}">
          <span class="sewa-template-name">${escape(TEMPLATE_LABELS[id])}</span>
          <span class="sewa-template-lines"><i></i><i></i><i></i></span>
        </button>`,
    ).join("");
  }

  function renderRecommendationPreview() {
    recommendPreview.srcdoc =
      Core.buildRecommendationHtml(state.templateId, state.articles) ||
      '<p style="color:#94a3b8;">添加文章后可预览模板</p>';
  }

  function renderRecommendations() {
    renderArticleRows();
    renderTemplateGrid();
    renderRecommendationPreview();
  }

  async function insertRecommendations() {
    try {
      normalizeArticles();
      if (!state.articles.length) {
        showStatus("请先读取或添加至少一篇文章。", "error");
        return;
      }
      const missingUrls = state.articles.filter(
        (article) => !Core.safeRecommendationUrl(article.url),
      ).length;
      if (missingUrls) {
        showStatus(`还有 ${missingUrls} 篇文章缺少有效链接，请补充后再插入。`, "error");
        return;
      }
      const html = Core.buildRecommendationHtml(state.templateId, state.articles);
      const result =
        state.recommendMode === "cursor"
          ? await EditorAdapter.insertHtml(html)
          : await EditorAdapter.appendHtml(html);
      showStatus(result ? "往期推荐已插入正文。" : "没有可插入的推荐内容。", result ? "success" : "error");
      saveState();
    } catch (error) {
      showStatus(error.message, "error");
    }
  }

  function mutateArticle(action, index) {
    if (action === "delete-article") state.articles.splice(index, 1);
    if (action === "move-up" && index > 0) {
      [state.articles[index - 1], state.articles[index]] = [
        state.articles[index],
        state.articles[index - 1],
      ];
    }
    if (action === "move-down" && index < state.articles.length - 1) {
      [state.articles[index + 1], state.articles[index]] = [
        state.articles[index],
        state.articles[index + 1],
      ];
    }
    renderRecommendations();
    saveState();
  }

  launcher.addEventListener("click", openPanel);
  panel.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-sewa-tab]");
    if (tab) return activateTab(tab.dataset.sewaTab);
    const template = event.target.closest("[data-sewa-template]");
    if (template) {
      state.templateId = template.dataset.sewaTemplate;
      renderRecommendations();
      saveState();
      return;
    }
    const actionElement = event.target.closest("[data-sewa-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.sewaAction;
    const article = actionElement.closest("[data-sewa-index]");
    if (article && ["move-up", "move-down", "delete-article"].includes(action)) {
      mutateArticle(action, Number(article.dataset.sewaIndex));
      return;
    }
    if (action === "close") closePanel();
    if (action === "import-html") handleImport();
    if (action === "apply-highlight") applyHighlights();
    if (action === "remove-highlight") handleRemoveHighlights();
    if (action === "open-links") openOfficialLinkPicker();
    if (action === "scrape-articles") {
      state.articles = scrapeRecentArticles();
      renderRecommendations();
      saveState();
      const missingUrls = state.articles.filter(
        (article) => !Core.safeRecommendationUrl(article.url),
      ).length;
      showStatus(
        state.articles.length
          ? missingUrls
            ? `已读取 ${state.articles.length} 篇文章，其中 ${missingUrls} 篇未提取到链接。请补充后再插入。`
            : `已读取 ${state.articles.length} 篇文章，可在插入前校正。`
          : "未读取到文章。请先打开官方超链接窗口，或手动添加。",
        state.articles.length && !missingUrls ? "success" : "error",
      );
    }
    if (action === "add-article" && state.articles.length < 5) {
      state.articles.push({ title: "", url: "" });
      renderRecommendations();
      saveState();
    }
    if (action === "insert-recommendations") insertRecommendations();
  });

  panel.addEventListener("input", (event) => {
    if (event.target === importCode) {
      state.importHtml = importCode.value;
      renderImportPreview();
    }
    if (event.target === highlightTerms) {
      state.highlightTerms = highlightTerms.value;
      saveState();
    }
    const article = event.target.closest("[data-sewa-index]");
    const field = event.target.dataset.sewaArticleField;
    if (article && field) {
      state.articles[Number(article.dataset.sewaIndex)][field] = event.target.value;
      renderRecommendationPreview();
      saveState();
    }
  });

  panel.addEventListener("change", (event) => {
    if (event.target.name === "sewa-import-mode") {
      state.importMode = event.target.value;
      saveState();
    }
    if (event.target.name === "sewa-highlight-style") {
      state.highlightStyle = event.target.value;
      saveState();
    }
    if (event.target.name === "sewa-recommend-mode") {
      state.recommendMode = event.target.value;
      saveState();
    }
    if (event.target.classList.contains("sewa-file-input")) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (!/\.html?$/i.test(file.name)) {
        showStatus("请选择 .html 或 .htm 文件。", "error");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        state.importHtml = String(reader.result || "");
        importCode.value = state.importHtml;
        renderImportPreview();
        showStatus("文件已读取，请检查预览后导入。", "success");
      });
      reader.addEventListener("error", () => {
        showStatus("文件读取失败，请重新选择。", "error");
      });
      reader.readAsText(file, "UTF-8");
    }
  });

  const watchedSelectionDocuments = new WeakSet();

  function watchSelection(doc) {
    if (!doc || watchedSelectionDocuments.has(doc)) return;
    watchedSelectionDocuments.add(doc);
    doc.addEventListener("selectionchange", () => {
      EditorAdapter.rememberSelection();
    });
  }

  watchSelection(root.document);

  if (
    root.chrome &&
    root.chrome.runtime &&
    root.chrome.runtime.onMessage &&
    typeof root.chrome.runtime.onMessage.addListener === "function"
  ) {
    root.chrome.runtime.onMessage.addListener((message) => {
      if (message && message.action === "SEWA_OPEN_PANEL") openPanel();
    });
  }

  loadState().then(() => {
    importCode.value = state.importHtml;
    highlightTerms.value = state.highlightTerms;
    const importMode = panel.querySelector(
      `input[name="sewa-import-mode"][value="${state.importMode}"]`,
    );
    const highlightStyle = panel.querySelector(
      `input[name="sewa-highlight-style"][value="${state.highlightStyle}"]`,
    );
    const recommendMode = panel.querySelector(
      `input[name="sewa-recommend-mode"][value="${state.recommendMode}"]`,
    );
    if (importMode) importMode.checked = true;
    if (highlightStyle) highlightStyle.checked = true;
    if (recommendMode) recommendMode.checked = true;
    renderRecommendations();
  });

  root.SEWA.Content = {
    openPanel,
    closePanel,
    scrapeRecentArticles,
    applyHighlights,
    removeHighlights,
    renderRecommendations,
  };
})(window);
