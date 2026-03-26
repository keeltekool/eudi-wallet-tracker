export type RawArticle = {
  title: string;
  url: string;
  publishedAt?: Date;
  author?: string;
  fullText?: string;
};

export type ParseResult = {
  articles: RawArticle[];
  errors: string[];
};

export type ParserConfig = {
  feedUrl?: string;
  articleSelector?: string;
  titleSelector?: string;
  linkSelector?: string;
  dateSelector?: string;
  authorSelector?: string;
  excerptSelector?: string;
  baseUrl?: string;
};
