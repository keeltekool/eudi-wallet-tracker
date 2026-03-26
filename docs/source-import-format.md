# EUDI Wallet Tracker — Source Import Format

Use this format when producing source lists from AI research. The output can be directly pasted into the admin bulk import page.

## Format

JSON array of objects:

```json
[
  {
    "name": "Source Name",
    "url": "https://example.com/news",
    "type": "rss",
    "category": "regulation",
    "config": {
      "feedUrl": "https://example.com/news/feed"
    }
  }
]
```

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable source name |
| `url` | string | The source's main page URL (must be a valid URL) |
| `type` | string | Parser type: `"rss"` or `"css"` |

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `category` | string | One of the allowed categories (see below) |
| `config` | object | Parser configuration (see below) |

## Allowed Categories

- `regulation` — EU regulation, policy, implementing acts
- `technical-standards` — Technical specs, protocols, standards bodies
- `national-implementation` — Country-level EUDI implementation news
- `industry` — Industry players, vendors, integrators
- `security-privacy` — Security research, privacy analysis
- `interoperability` — Cross-border, cross-wallet interop
- `market-analysis` — Market reports, analyst commentary

## Config Object

For **RSS** sources:
```json
{
  "feedUrl": "https://example.com/feed"
}
```
If `feedUrl` is omitted, the scraper will try the source `url` directly as the feed URL.

For **CSS** sources (leave empty — selectors will be generated via AI in the admin):
```json
{}
```

Or if you already know the selectors:
```json
{
  "articleSelector": "article.post",
  "titleSelector": "h2 a",
  "linkSelector": "h2 a",
  "dateSelector": "time",
  "authorSelector": ".author",
  "excerptSelector": ".excerpt",
  "baseUrl": "https://example.com"
}
```

## Rules for AI Research Output

1. Output ONLY the JSON array — no markdown, no explanations
2. Every URL must be a valid, reachable URL
3. If the source has an RSS/Atom feed, set `type: "rss"` and include `feedUrl` in config
4. If no RSS feed exists, set `type: "css"` and leave config as `{}`
5. Do not include sources that require login/authentication
6. Do not include PDF-only sources
7. Duplicates are automatically detected and skipped during import
