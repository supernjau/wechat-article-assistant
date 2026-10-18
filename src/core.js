(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SEWA = root.SEWA || {};
  root.SEWA.Core = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function parseKeywords(value) {
    return [
      ...new Set(
        String(value || "")
          .split(/[,，\n]/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => b.length - a.length);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 按文本顺序规划关键词强调：返回每段文本里要标记的区间，以及每个词的命中统计。
  // total 是全文命中次数，marked 是实际会被标记的次数（firstOnly 时每个词最多 1 次）。
  function planKeywordMatches(texts, terms, options) {
    const firstOnly = Boolean(options && options.firstOnly);
    const entries = new Map();
    for (const term of Array.isArray(terms) ? terms : []) {
      const key = String(term || "").toLowerCase();
      if (key && !entries.has(key)) entries.set(key, { term, total: 0, marked: 0 });
    }
    const list = Array.isArray(texts) ? texts : [];
    const ranges = list.map(() => []);
    if (!entries.size) return { ranges, counts: [] };
    const regex = new RegExp(
      [...entries.values()]
        .map((entry) => entry.term)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|"),
      "gi",
    );
    list.forEach((text, index) => {
      for (const match of String(text || "").matchAll(regex)) {
        const entry = entries.get(match[0].toLowerCase());
        if (!entry) continue;
        entry.total += 1;
        if (firstOnly && entry.marked) continue;
        entry.marked += 1;
        ranges[index].push({ start: match.index, end: match.index + match[0].length });
      }
    });
    return { ranges, counts: [...entries.values()] };
  }

  // 插件改动正文前的备份栈：只记录插件自己的操作，最多保留 limit 步。
  // 撤销/重做分“查看”和“确认”两步，方便写回失败时不丢记录。
  function createHistory(limit) {
    const max = Number.isInteger(limit) && limit > 0 ? limit : 10;
    const undoStack = [];
    let redoEntry = null;
    return {
      record(label, html) {
        undoStack.push({ label, html, at: Date.now() });
        if (undoStack.length > max) undoStack.shift();
        redoEntry = null;
      },
      peekUndo() {
        return undoStack[undoStack.length - 1] || null;
      },
      commitUndo(currentHtml) {
        const entry = undoStack.pop();
        if (!entry) return null;
        redoEntry = { label: entry.label, html: currentHtml, at: entry.at };
        return entry;
      },
      peekRedo() {
        return redoEntry;
      },
      commitRedo(currentHtml) {
        const entry = redoEntry;
        if (!entry) return null;
        redoEntry = null;
        undoStack.push({ label: entry.label, html: currentHtml, at: entry.at });
        return entry;
      },
      size() {
        return undoStack.length;
      },
    };
  }

  function safeUrl(value) {
    const url = String(value || "").trim();
    const normalized = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
    return /^(?:javascript|data|vbscript|file|filesystem|intent|blob):/i.test(
      normalized,
    )
      ? ""
      : url;
  }

  const TEMPLATE_IDS = [
    "clean",
    "numbered",
    "editor",
    "border",
    "magazine",
    "studio",
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeRecommendationUrl(value) {
    const url = safeUrl(value);
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return parsed.origin === "https://mp.weixin.qq.com" &&
        !parsed.username &&
        !parsed.password &&
        /^\/s(?:\/|$)/.test(parsed.pathname)
        ? url
        : "";
    } catch {
      return "";
    }
  }

  function normalizeRecentTitle(value) {
    return String(value || "")
      .replace(
        /(?:19|20)\d{2}(?:[-/.]\d{1,2}[-/.]\d{1,2}|年\d{1,2}月\d{1,2}日?)/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function pickRecentTitle(values) {
    const actions = /(?:查看文章|查看详情|阅读全文|预览文章|打开文章)/g;
    for (const value of Array.isArray(values) ? values : [values]) {
      for (const line of String(value || "").split(/\r?\n/)) {
        const title = normalizeRecentTitle(line.replace(actions, " "));
        if (title) return title;
      }
    }
    return "";
  }

  function collectRecentArticles(candidates, limit) {
    const articles = [];
    const seenTitles = new Set();
    const seenUrls = new Set();
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
      if (!candidate || typeof candidate !== "object") continue;
      const title = normalizeRecentTitle(candidate.title);
      const url = safeRecommendationUrl(candidate.url);
      if (!title || seenTitles.has(title) || (url && seenUrls.has(url))) continue;
      seenTitles.add(title);
      if (url) seenUrls.add(url);
      articles.push({ title, url });
      if (articles.length === maxItems) break;
    }
    return articles;
  }

  const IMAGE_TEXT_SHOW_TYPE = 8;

  function parseJsonField(value) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function parsePublishedArticles(response) {
    const page = parseJsonField(response && response.publish_page);
    const list = page && Array.isArray(page.publish_list) ? page.publish_list : [];
    const candidates = [];
    for (const entry of list) {
      const info = parseJsonField(entry && entry.publish_info);
      const articles = info && Array.isArray(info.appmsgex) ? info.appmsgex : [];
      for (const article of articles) {
        if (!article || article.is_deleted) continue;
        // item_show_type 8 是由原文整理再发的图文，推荐原文即可。
        if (Number(article.item_show_type) === IMAGE_TEXT_SHOW_TYPE) continue;
        candidates.push({ title: article.title, url: article.link });
      }
    }
    return candidates;
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
    const items = (Array.isArray(articles) ? articles : [])
      .filter(
        (article) =>
          article && typeof article === "object" && !Array.isArray(article),
      )
      .slice(0, 5);
    const id = TEMPLATE_IDS.includes(templateId) ? templateId : "clean";
    const heading = `<section style="margin:32px 0 8px;padding:0;"><p style="margin:0 0 14px;font-size:18px;font-weight:700;color:#1f2937;">往期推荐</p>`;
    const end = `</section>`;
    if (id === "numbered") {
      return (
        heading +
        items
          .map(
            (article, index) =>
              `<p style="margin:0;padding:10px 0;border-bottom:1px solid #e5e7eb;">${link(article, String(index + 1).padStart(2, "0"), "font-size:15px;line-height:1.7;color:#334155;text-decoration:none;")}</p>`,
          )
          .join("") +
        end
      );
    }
    if (id === "editor") {
      return (
        heading +
        items
          .map(
            (article) =>
              `<p style="margin:8px 0;padding:10px 12px;background:#f8fafc;border-radius:4px;"><span style="display:inline-block;margin-right:8px;padding:1px 5px;font-size:12px;line-height:1.5;color:#0f766e;background:#ccfbf1;border-radius:2px;">精选</span>${link(article, "", "font-size:15px;line-height:1.7;color:#0f766e;text-decoration:none;")}</p>`,
          )
          .join("") +
        end
      );
    }
    if (id === "border") {
      return (
        heading +
        items
          .map(
            (article) =>
              `<p style="margin:10px 0;padding:2px 0 2px 12px;border-left:3px solid #2563eb;">${link(article, "", "font-size:15px;line-height:1.7;color:#334155;text-decoration:none;")}</p>`,
          )
          .join("") +
        end
      );
    }
    if (id === "magazine") {
      return (
        heading +
        items
          .map(
            (article) =>
              `<p style="margin:0;padding:11px 0;border-bottom:1px solid #d1d5db;"><span style="display:inline-block;width:90%;vertical-align:top;">${link(article, "", "font-size:15px;line-height:1.7;color:#111827;text-decoration:none;")}</span><span style="display:inline-block;width:10%;text-align:right;vertical-align:top;color:#64748b;">→</span></p>`,
          )
          .join("") +
        end
      );
    }
    if (id === "studio") {
      return (
        `<section style="margin:32px 0 8px;padding:16px 14px;border:1px solid #dbeafe;background:#f8fbff;"><p style="margin:0 0 4px;font-size:13px;color:#2563eb;">Super英语工作室</p><p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1f2937;">往期推荐</p>` +
        items
          .map(
            (article) =>
              `<p style="margin:7px 0;">${link(article, "•", "font-size:15px;line-height:1.7;color:#1d4ed8;text-decoration:none;")}</p>`,
          )
          .join("") +
        end
      );
    }
    return (
      heading +
      items
        .map(
          (article) =>
            `<p style="margin:0;padding:9px 0;border-bottom:1px solid #eef2f7;">${link(article, "", "font-size:15px;line-height:1.7;color:#334155;text-decoration:none;")}</p>`,
        )
        .join("") +
      end
    );
  }

  return {
    parseKeywords,
    planKeywordMatches,
    createHistory,
    safeUrl,
    TEMPLATE_IDS,
    escapeHtml,
    safeRecommendationUrl,
    normalizeRecentTitle,
    pickRecentTitle,
    collectRecentArticles,
    parsePublishedArticles,
    buildRecommendationHtml,
  };
});
