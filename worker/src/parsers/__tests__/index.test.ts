import { describe, it, expect, vi } from "vitest";
import { parseSource } from "../index";

vi.mock("../rss", () => ({
  parseRss: vi.fn().mockResolvedValue({
    articles: [{ title: "RSS Article", url: "https://rss.com/1" }],
    errors: [],
  }),
}));

vi.mock("../css", () => ({
  parseCss: vi.fn().mockResolvedValue({
    articles: [{ title: "CSS Article", url: "https://css.com/1" }],
    errors: [],
  }),
}));

describe("parseSource", () => {
  it("routes RSS sources to parseRss", async () => {
    const result = await parseSource({
      type: "rss",
      url: "https://example.com",
      config: { feedUrl: "https://example.com/feed" },
    });
    expect(result.articles[0].title).toBe("RSS Article");
  });

  it("uses feedUrl from config for RSS", async () => {
    const { parseRss } = await import("../rss");
    await parseSource({
      type: "rss",
      url: "https://example.com",
      config: { feedUrl: "https://example.com/feed.xml" },
    });
    expect(parseRss).toHaveBeenCalledWith("https://example.com/feed.xml");
  });

  it("routes CSS sources to parseCss", async () => {
    const result = await parseSource({
      type: "css",
      url: "https://example.com/news",
      config: { articleSelector: ".item" },
    });
    expect(result.articles[0].title).toBe("CSS Article");
  });

  it("returns error for unknown source type", async () => {
    const result = await parseSource({
      type: "unknown" as any,
      url: "https://example.com",
      config: {},
    });
    expect(result.articles).toHaveLength(0);
    expect(result.errors[0]).toContain("Unknown parser type");
  });
});
