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
  assert.equal(Core.safeUrl("file:///tmp/private.html"), "");
  assert.equal(Core.safeUrl("intent://scan/#Intent;scheme=zxing;end"), "");
  assert.equal(Core.safeUrl("blob:https://example.com/demo"), "");
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

test("normalizeRecentTitle removes published dates and collapses row whitespace", () => {
  assert.equal(
    Core.normalizeRecentTitle(
      '  “你真厉害”别只会说 amazing！这些说法更地道 \n 2026-05-28 ',
    ),
    '“你真厉害”别只会说 amazing！这些说法更地道',
  );
  assert.equal(
    Core.normalizeRecentTitle("定金、订金用英文到底怎么说？ 2026年5月27日"),
    "定金、订金用英文到底怎么说？",
  );
});

test("pickRecentTitle ignores official view actions and keeps the article title", () => {
  assert.equal(
    Core.pickRecentTitle([
      "查看文章",
      "“你真厉害”别只会说 amazing！这些说法更地道\n2026-05-28\n查看文章",
    ]),
    "“你真厉害”别只会说 amazing！这些说法更地道",
  );
});

test("collectRecentArticles keeps title-only radio rows, deduplicates, and limits results", () => {
  const articles = Core.collectRecentArticles([
    {
      title: " 第一篇文章 \n 2026-05-28 ",
      url: "https://mp.weixin.qq.com/s/first",
    },
    { title: "第一篇文章\n2026-05-28", url: "" },
    { title: "第二篇文章\n2026-05-27", url: "" },
    { title: "第二篇文章\n2026-05-27", url: "" },
    { title: "第三篇文章", url: "https://evil.example/s/third" },
    { title: "第四篇文章", url: "" },
    { title: "第五篇文章", url: "" },
    { title: "第六篇文章", url: "" },
  ]);

  assert.deepEqual(articles, [
    { title: "第一篇文章", url: "https://mp.weixin.qq.com/s/first" },
    { title: "第二篇文章", url: "" },
    { title: "第三篇文章", url: "" },
    { title: "第四篇文章", url: "" },
    { title: "第五篇文章", url: "" },
  ]);
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

test("parsePublishedArticles reads nested publish_page JSON and skips deleted articles and image-text reposts", () => {
  const info = (articles) => JSON.stringify({ appmsgex: articles });
  const response = {
    publish_page: JSON.stringify({
      publish_list: [
        {
          publish_info: info([
            { title: "最新一篇", link: "https://mp.weixin.qq.com/s/aaa" },
            { title: "已删除", link: "https://mp.weixin.qq.com/s/del", is_deleted: true },
            { title: "同次群发第二篇", link: "https://mp.weixin.qq.com/s/bbb" },
          ]),
        },
        {
          publish_info: info([
            { title: "同题图文", link: "https://mp.weixin.qq.com/s/img", item_show_type: 8 },
            { title: "同题图文", link: "https://mp.weixin.qq.com/s/orig", item_show_type: 0 },
            { title: "音频类文章", link: "https://mp.weixin.qq.com/s/audio", item_show_type: 7 },
          ]),
        },
        { publish_info: "not json" },
        { publish_info: info([{ title: "上一期", link: "https://mp.weixin.qq.com/s/ccc" }]) },
      ],
    }),
  };

  assert.deepEqual(Core.collectRecentArticles(Core.parsePublishedArticles(response), 5), [
    { title: "最新一篇", url: "https://mp.weixin.qq.com/s/aaa" },
    { title: "同次群发第二篇", url: "https://mp.weixin.qq.com/s/bbb" },
    { title: "同题图文", url: "https://mp.weixin.qq.com/s/orig" },
    { title: "音频类文章", url: "https://mp.weixin.qq.com/s/audio" },
    { title: "上一期", url: "https://mp.weixin.qq.com/s/ccc" },
  ]);
  assert.deepEqual(Core.parsePublishedArticles(null), []);
  assert.deepEqual(Core.parsePublishedArticles({ publish_page: "oops" }), []);
});

test("planKeywordMatches marks every match and counts hits per keyword", () => {
  const plan = Core.planKeywordMatches(
    ["This is suitable. Fit or fit?", "More SUITABLE words"],
    ["suitable", "fit", "appropriate"],
  );

  assert.deepEqual(plan.counts, [
    { term: "suitable", total: 2, marked: 2 },
    { term: "fit", total: 2, marked: 2 },
    { term: "appropriate", total: 0, marked: 0 },
  ]);
  assert.deepEqual(plan.ranges, [
    [
      { start: 8, end: 16 },
      { start: 18, end: 21 },
      { start: 25, end: 28 },
    ],
    [{ start: 5, end: 13 }],
  ]);
});

test("planKeywordMatches firstOnly marks only the earliest match of each keyword, ignoring case", () => {
  const plan = Core.planKeywordMatches(
    ["a Fit b", "fit again", "FIT and suitable", "suitable"],
    ["suitable", "fit"],
    { firstOnly: true },
  );

  assert.deepEqual(plan.counts, [
    { term: "suitable", total: 2, marked: 1 },
    { term: "fit", total: 3, marked: 1 },
  ]);
  assert.deepEqual(plan.ranges, [
    [{ start: 2, end: 5 }],
    [],
    [{ start: 8, end: 16 }],
    [],
  ]);
});

test("planKeywordMatches prefers the longest keyword and merges keywords that differ only by case", () => {
  const plan = Core.planKeywordMatches(["fitness fit"], ["fitness", "fit", "Fit"]);

  assert.deepEqual(plan.counts, [
    { term: "fitness", total: 1, marked: 1 },
    { term: "fit", total: 1, marked: 1 },
  ]);
  assert.deepEqual(plan.ranges, [
    [
      { start: 0, end: 7 },
      { start: 8, end: 11 },
    ],
  ]);
});

test("planKeywordMatches treats regex characters literally and handles empty input", () => {
  assert.deepEqual(Core.planKeywordMatches(["a.b axb"], ["a.b"]).ranges, [
    [{ start: 0, end: 3 }],
  ]);
  assert.deepEqual(Core.planKeywordMatches(["text"], []), {
    ranges: [[]],
    counts: [],
  });
});
