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

  return { parseKeywords, safeUrl };
});
