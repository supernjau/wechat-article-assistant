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

  function safeUrl(value) {
    const url = String(value || "").trim();
    const normalized = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
    return /^(?:javascript|data|vbscript):/i.test(normalized) ? "" : url;
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

  function link(article, label, style) {
    const href = safeUrl(article.url);
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
              `<p style="margin:8px 0;padding:10px 12px;background:#f8fafc;border-radius:4px;">${link(article, "精选", "font-size:15px;line-height:1.7;color:#0f766e;text-decoration:none;")}</p>`,
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
              `<p style="margin:0;padding:11px 0;border-bottom:1px solid #d1d5db;">${link(article, "→", "font-size:15px;line-height:1.7;color:#111827;text-decoration:none;")}</p>`,
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
    safeUrl,
    TEMPLATE_IDS,
    escapeHtml,
    buildRecommendationHtml,
  };
});
