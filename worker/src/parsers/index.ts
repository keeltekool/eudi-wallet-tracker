import { parseRss } from "./rss";
import { parseCss } from "./css";
import type { ParseResult, ParserConfig } from "./types";

type SourceInput = {
  type: "rss" | "css";
  url: string;
  config: ParserConfig;
};

export async function parseSource(source: SourceInput): Promise<ParseResult> {
  switch (source.type) {
    case "rss":
      return parseRss(source.config.feedUrl || source.url);
    case "css":
      return parseCss(source.url, source.config);
    default:
      return {
        articles: [],
        errors: [`Unknown parser type: ${(source as any).type}`],
      };
  }
}

export type { ParseResult, ParserConfig, RawArticle } from "./types";
