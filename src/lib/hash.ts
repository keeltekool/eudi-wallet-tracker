import { createHash } from "crypto";

export function hashUrl(url: string): string {
  const normalized = url.replace(/\/+$/, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function hashContent(title: string, content?: string): string {
  const truncated = (content || "").slice(0, 200);
  const input = `${title}::${truncated}`;
  return createHash("sha256").update(input).digest("hex");
}
