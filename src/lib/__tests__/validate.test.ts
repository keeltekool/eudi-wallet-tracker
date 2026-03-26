import { describe, it, expect } from "vitest";
import { validateArticle, type RawArticle } from "../validate";

const valid: RawArticle = {
  title: "EUDI Wallet Update",
  url: "https://example.com/article",
  publishedAt: new Date("2026-03-01"),
};

describe("validateArticle", () => {
  it("accepts a valid article", () => {
    const result = validateArticle(valid);
    expect(result.valid).toBe(true);
  });

  it("rejects empty title", () => {
    const result = validateArticle({ ...valid, title: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("title");
  });

  it("rejects whitespace-only title", () => {
    const result = validateArticle({ ...valid, title: "   " });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid URL", () => {
    const result = validateArticle({ ...valid, url: "not-a-url" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("URL");
  });

  it("rejects future-dated articles (>2 days ahead)", () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const result = validateArticle({ ...valid, publishedAt: future });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain("future");
  });

  it("accepts articles with no date", () => {
    const result = validateArticle({ ...valid, publishedAt: undefined });
    expect(result.valid).toBe(true);
  });

  it("accepts articles dated today", () => {
    const result = validateArticle({ ...valid, publishedAt: new Date() });
    expect(result.valid).toBe(true);
  });
});
