import { describe, it, expect } from "vitest";
import { hashUrl, hashContent } from "../hash";

describe("hashUrl", () => {
  it("returns consistent SHA-256 hex for a URL", () => {
    const hash = hashUrl("https://example.com/article/123");
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashUrl("https://example.com/article/123"));
  });

  it("normalizes trailing slashes", () => {
    expect(hashUrl("https://example.com/path/")).toBe(
      hashUrl("https://example.com/path")
    );
  });

  it("different URLs produce different hashes", () => {
    expect(hashUrl("https://a.com")).not.toBe(hashUrl("https://b.com"));
  });
});

describe("hashContent", () => {
  it("hashes title + first 200 chars of content", () => {
    const hash = hashContent("My Title", "Some content here");
    expect(hash).toHaveLength(64);
  });

  it("same title + content = same hash", () => {
    const a = hashContent("Title", "Body text");
    const b = hashContent("Title", "Body text");
    expect(a).toBe(b);
  });

  it("truncates content to first 200 chars before hashing", () => {
    const longText = "x".repeat(500);
    const a = hashContent("T", longText);
    const b = hashContent("T", longText.slice(0, 200));
    expect(a).toBe(b);
  });
});
