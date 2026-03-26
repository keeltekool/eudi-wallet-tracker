import { describe, it, expect, vi } from "vitest";
import { parseCss } from "../css";
import type { ParserConfig } from "../types";

const mockHtml = `
<html>
<body>
  <div class="news-list">
    <article class="news-item">
      <h2 class="title"><a href="/news/eudi-update">EUDI Wallet Update</a></h2>
      <span class="date">2026-03-20</span>
      <span class="author">John</span>
      <p class="excerpt">Important update about EUDI...</p>
    </article>
    <article class="news-item">
      <h2 class="title"><a href="https://external.com/article">External Article</a></h2>
      <span class="date">2026-03-21</span>
      <p class="excerpt">Another update...</p>
    </article>
  </div>
</body>
</html>
`;

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(mockHtml),
  })
);

const config: ParserConfig = {
  articleSelector: "article.news-item",
  titleSelector: "h2.title a",
  linkSelector: "h2.title a",
  dateSelector: "span.date",
  authorSelector: "span.author",
  excerptSelector: "p.excerpt",
  baseUrl: "https://example.com",
};

describe("parseCss", () => {
  it("extracts articles using CSS selectors", async () => {
    const result = await parseCss("https://example.com/news", config);
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].title).toBe("EUDI Wallet Update");
    expect(result.articles[0].url).toBe("https://example.com/news/eudi-update");
    expect(result.articles[0].author).toBe("John");
    expect(result.errors).toHaveLength(0);
  });

  it("resolves relative URLs against baseUrl", async () => {
    const result = await parseCss("https://example.com/news", config);
    expect(result.articles[0].url).toBe("https://example.com/news/eudi-update");
    expect(result.articles[1].url).toBe("https://external.com/article");
  });

  it("returns error on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Timeout"));
    const result = await parseCss("https://example.com/news", config);
    expect(result.articles).toHaveLength(0);
    expect(result.errors[0]).toContain("Timeout");
  });

  it("returns empty articles when selector matches nothing", async () => {
    const badConfig = { ...config, articleSelector: ".nonexistent" };
    const result = await parseCss("https://example.com/news", badConfig);
    expect(result.articles).toHaveLength(0);
  });
});
