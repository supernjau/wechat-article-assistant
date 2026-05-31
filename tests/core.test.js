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
  assert.equal(Core.safeUrl("java\nscript:alert(1)"), "");
  assert.equal(Core.safeUrl("java\tscript:alert(1)"), "");
  assert.equal(Core.safeUrl("java\rscript:alert(1)"), "");
  assert.equal(Core.safeUrl(" DATA:text/html,<p>bad</p> "), "");
  assert.equal(Core.safeUrl("vbscript:msgbox(1)"), "");
  assert.equal(
    Core.safeUrl(" https://mp.weixin.qq.com/s/example "),
    "https://mp.weixin.qq.com/s/example",
  );
});

test("buildRecommendationHtml supports six templates and escapes article content", () => {
  assert.deepEqual(Core.TEMPLATE_IDS, [
    "clean",
    "numbered",
    "editor",
    "border",
    "magazine",
    "studio",
  ]);
  assert.equal(Core.TEMPLATE_IDS.length, 6);

  const articles = [
    { title: "<英语>", url: "https://mp.weixin.qq.com/s/demo?a=1&b=2" },
  ];
  for (const template of Core.TEMPLATE_IDS) {
    const html = Core.buildRecommendationHtml(template, articles);
    assert.match(html, /往期推荐/);
    assert.match(html, /&lt;英语&gt;/);
    assert.match(html, /a=1&amp;b=2/);
  }
});

test("escapeHtml escapes HTML-sensitive characters", () => {
  assert.equal(
    Core.escapeHtml(`<span title="'">&</span>`),
    "&lt;span title=&quot;&#39;&quot;&gt;&amp;&lt;/span&gt;",
  );
});

test("buildRecommendationHtml discards unsafe article URLs without dropping titles", () => {
  const html = Core.buildRecommendationHtml("clean", [
    { title: "危险链接", url: "javascript:alert(1)" },
  ]);
  assert.doesNotMatch(html, /javascript:/);
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /<span /);
  assert.match(html, /危险链接/);
});

test("buildRecommendationHtml renders at most five articles", () => {
  const articles = Array.from({ length: 6 }, (_, index) => ({
    title: `文章 ${index + 1}`,
    url: `https://mp.weixin.qq.com/s/${index + 1}`,
  }));
  const html = Core.buildRecommendationHtml("clean", articles);
  assert.match(html, /文章 5/);
  assert.doesNotMatch(html, /文章 6/);
});

test("buildRecommendationHtml falls back to clean for unknown templates", () => {
  const articles = [{ title: "", url: "" }];
  assert.equal(
    Core.buildRecommendationHtml("unknown", articles),
    Core.buildRecommendationHtml("clean", articles),
  );
  assert.match(Core.buildRecommendationHtml("clean", articles), /未命名文章/);
});

test("buildRecommendationHtml includes the studio brand", () => {
  const html = Core.buildRecommendationHtml("studio", []);
  assert.match(html, /Super英语工作室/);
});

test("safeRecommendationUrl accepts only official published WeChat article URLs", () => {
  const validUrls = [
    "https://mp.weixin.qq.com/s",
    "https://mp.weixin.qq.com/s/demo",
    "https://mp.weixin.qq.com/s?__biz=demo",
    "https://mp.weixin.qq.com/s#demo",
  ];
  for (const url of validUrls) {
    assert.equal(Core.safeRecommendationUrl(url), url);
  }

  const invalidUrls = [
    "file:///tmp/article.html",
    "intent://scan/#Intent;scheme=zxing;end",
    "mailto:reader@example.com",
    "//evil.example/s/demo",
    "http://mp.weixin.qq.com/s/demo",
    "https://evil.example/s/demo",
    "https://mp.weixin.qq.com.evil.example/s/demo",
    "https://mp.weixin.qq.com/sneaky",
    "java\nscript:alert(1)",
    "vb\nscript:msgbox(1)",
    " DATA:text/html,<p>bad</p> ",
  ];
  for (const url of invalidUrls) {
    assert.equal(Core.safeRecommendationUrl(url), "");
  }
});

test("buildRecommendationHtml degrades non-WeChat article URLs to non-clickable titles", () => {
  const invalidUrls = [
    "file:///tmp/article.html",
    "intent://scan/#Intent;scheme=zxing;end",
    "mailto:reader@example.com",
    "//evil.example/s/demo",
    "http://mp.weixin.qq.com/s/demo",
    "https://evil.example/s/demo",
    "java\nscript:alert(1)",
    "vb\nscript:msgbox(1)",
  ];
  for (const url of invalidUrls) {
    const html = Core.buildRecommendationHtml("clean", [
      { title: "保留标题", url },
    ]);
    assert.doesNotMatch(html, /<a /);
    assert.match(html, /<span /);
    assert.match(html, /保留标题/);
  }
});

test("recommendation templates render their distinct visual structures", () => {
  const articles = [
    { title: "示例文章", url: "https://mp.weixin.qq.com/s/demo" },
  ];
  const templates = Object.fromEntries(
    Core.TEMPLATE_IDS.map((id) => [
      id,
      Core.buildRecommendationHtml(id, articles),
    ]),
  );

  assert.equal(new Set(Object.values(templates)).size, Core.TEMPLATE_IDS.length);
  assert.match(templates.numbered, />01 示例文章</);
  assert.match(
    templates.editor,
    /<span style="[^"]*background:[^"]*">精选<\/span><a /,
  );
  assert.doesNotMatch(templates.editor, /<a [^>]*>精选 /);
  assert.match(templates.border, /border-left:3px solid/);
  assert.match(
    templates.magazine,
    /<span style="[^"]*display:inline-block[^"]*">.*示例文章.*<\/span><span style="[^"]*text-align:right[^"]*">→<\/span>/,
  );
  assert.doesNotMatch(templates.magazine, />→ 示例文章</);
  assert.match(templates.studio, /Super英语工作室/);
});

test("buildRecommendationHtml filters invalid article entries before rendering", () => {
  const html = Core.buildRecommendationHtml("clean", [
    null,
    undefined,
    "invalid",
    42,
    ...Array.from({ length: 5 }, (_, index) => ({
      title: `有效文章 ${index + 1}`,
      url: `https://mp.weixin.qq.com/s/${index + 1}`,
    })),
  ]);

  assert.match(html, /有效文章 1/);
  assert.match(html, /有效文章 5/);
});
