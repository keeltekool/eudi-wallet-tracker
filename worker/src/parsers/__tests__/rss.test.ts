import { describe, it, expect, vi, beforeEach } from "vitest";

const mockParseURL = vi.fn();

vi.mock("rss-parser", () => {
  return {
    default: class MockRssParser {
      parseURL = mockParseURL;
    },
  };
});

// Import after mock is set up
import { parseRss } from "../rss";

describe("parseRss", () => {
  beforeEach(() => {
    mockParseURL.mockReset();
  });

  it("parses RSS feed items into RawArticles", async () => {
    mockParseURL.mockResolvedValue({
      items: [
        {
          title: "EUDI Wallet ARF v1.5 Released",
          link: "https://example.com/article-1",
          pubDate: "Mon, 24 Mar 2026 10:00:00 GMT",
          creator: "EC Digital",
          contentSnippet: "The Architecture Reference Framework...",
        },
        {
          title: "Second Article",
          link: "https://example.com/article-2",
          pubDate: "Tue, 25 Mar 2026 10:00:00 GMT",
        },
      ],
    });

    const result = await parseRss("https://example.com/feed");
    expect(result.articles).toHaveLength(2);
    expect(result.articles[0].title).toBe("EUDI Wallet ARF v1.5 Released");
    expect(result.articles[0].url).toBe("https://example.com/article-1");
    expect(result.articles[0].author).toBe("EC Digital");
    expect(result.errors).toHaveLength(0);
  });

  it("skips items without title or link", async () => {
    mockParseURL.mockResolvedValue({
      items: [
        { title: "Good", link: "https://example.com/ok" },
        { title: "", link: "https://example.com/no-title" },
        { title: "No Link" },
      ],
    });

    const result = await parseRss("https://example.com/feed");
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].title).toBe("Good");
  });

  it("returns error on fetch failure", async () => {
    mockParseURL.mockRejectedValue(new Error("Network error"));

    const result = await parseRss("https://example.com/feed");
    expect(result.articles).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Network error");
  });
});
