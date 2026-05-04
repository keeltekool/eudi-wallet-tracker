"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BulkEntry = {
  competitor: string;
  url: string;
  theme: string;
  purpose?: string;
};

type ValidationResult = {
  entry: BulkEntry;
  index: number;
  status: "new" | "duplicate" | "invalid";
  reason?: string;
  matchedSource?: string;
};

type PreviewData = {
  results: ValidationResult[];
  summary: {
    total: number;
    new: number;
    duplicate: number;
    invalid: number;
    inserted?: number;
  };
};

const COMPETITOR_MAP: Record<string, { competitor: string; defaultTheme: string }> = {
  "docusign.com": { competitor: "docusign", defaultTheme: "market" },
  "adobe.com": { competitor: "adobe-sign", defaultTheme: "market" },
  "dropboxsign.com": { competitor: "dropbox-sign", defaultTheme: "market" },
  "pandadoc.com": { competitor: "pandadoc", defaultTheme: "market" },
  "namirial.com": { competitor: "namirial", defaultTheme: "market" },
  "yousign.com": { competitor: "yousign", defaultTheme: "market" },
  "universign.com": { competitor: "universign", defaultTheme: "market" },
  "skribble.com": { competitor: "skribble", defaultTheme: "market" },
  "sproof.io": { competitor: "sproof", defaultTheme: "market" },
  "penneo.com": { competitor: "penneo", defaultTheme: "market" },
  "scrive.com": { competitor: "scrive", defaultTheme: "market" },
  "dokobit.com": { competitor: "dokobit", defaultTheme: "market" },
  "signicat.com": { competitor: "signicat", defaultTheme: "market" },
  "vismasign.fi": { competitor: "visma-sign", defaultTheme: "market" },
  "contractbook.com": { competitor: "scrive", defaultTheme: "market" },
};

const THEME_HINTS: Record<string, string> = {
  pricing: "pricing",
  hinnoittelu: "pricing",
  price: "pricing",
  plans: "pricing",
  feature: "features",
  product: "features",
  ominaisuudet: "features",
  integration: "integrations",
  integraatiot: "integrations",
  connector: "integrations",
  eid: "eid",
  auth: "eid",
  compliance: "compliance",
  trust: "compliance",
  security: "compliance",
  tietoturva: "compliance",
  blog: "market",
  press: "market",
  news: "market",
  wallet: "eudi-wallet",
  eudi: "eudi-wallet",
  eidas: "eudi-wallet",
};

function detectFromUrl(rawUrl: string): BulkEntry | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.toLowerCase();

    const mapped = COMPETITOR_MAP[host];
    const competitor = mapped?.competitor || host.split(".")[0];

    let theme = mapped?.defaultTheme || "market";
    for (const [hint, t] of Object.entries(THEME_HINTS)) {
      if (path.includes(hint)) {
        theme = t;
        break;
      }
    }

    const pathLabel = path.replace(/^\/|\/$/g, "").replace(/\//g, " › ") || "homepage";
    const purpose = `${competitor} ${pathLabel}`;

    return { competitor, url: rawUrl.trim(), theme, purpose };
  } catch {
    return null;
  }
}

const HEADER_FIELDS = ["competitor", "url", "theme", "purpose"];

function parseInput(input: string): BulkEntry[] {
  const rows = input
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (rows.length === 0) return [];

  const firstCols = rows[0].split("\t").map((c) => c.trim().toLowerCase());
  const hasHeader = HEADER_FIELDS.every((f) => firstCols.includes(f));
  const isTSV = rows[0].includes("\t") && !rows[0].startsWith("http");

  if (isTSV || hasHeader) {
    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows.map((row) => {
      const cols = row.includes("\t")
        ? row.split("\t").map((c) => c.trim())
        : row.split(",").map((c) => c.trim());
      return {
        competitor: cols[0] ?? "",
        url: cols[1] ?? "",
        theme: cols[2] ?? "",
        purpose: cols[3] ?? "",
      };
    });
  }

  const entries: BulkEntry[] = [];
  for (const row of rows) {
    const detected = detectFromUrl(row);
    if (detected) {
      entries.push(detected);
    } else {
      entries.push({ competitor: "", url: row, theme: "", purpose: "" });
    }
  }
  return entries;
}

const EXAMPLE_URLS = `https://www.docusign.com/products/esignature/pricing
https://www.docusign.com/blog
https://www.adobe.com/sign/pricing/plans.html
https://yousign.com/pricing
https://yousign.com/blog`;

export function AllekirjoitusBulkImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [importDone, setImportDone] = useState(false);

  async function handlePreview() {
    setPreviewing(true);
    setError("");
    setPreview(null);
    setImportDone(false);

    const entries = parseInput(text);
    if (entries.length === 0) {
      setError("No rows parsed. Paste at least one URL.");
      setPreviewing(false);
      return;
    }

    const res = await fetch("/api/sources/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: "allekirjoitus",
        entries,
        action: "preview",
      }),
    });

    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setPreview(data);
    }
    setPreviewing(false);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    const entries = parseInput(text);

    const res = await fetch("/api/sources/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: "allekirjoitus",
        entries,
        action: "import",
      }),
    });

    const data = await res.json();
    setPreview(data);
    setImporting(false);
    setImportDone(true);
  }

  const statusColors = {
    new: "bg-emerald-50 text-emerald-700",
    duplicate: "bg-amber-50 text-amber-700",
    invalid: "bg-red-50 text-red-700",
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Paste URLs (one per line). Competitor name and theme are auto-detected
        from the URL. You can also paste tab-separated rows if you want to
        override.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">
            Competitor URLs
          </label>
          <button
            type="button"
            onClick={() => {
              setText(EXAMPLE_URLS);
              setPreview(null);
              setImportDone(false);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            Load example
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setImportDone(false);
          }}
          rows={12}
          placeholder={`Paste URLs, one per line:\nhttps://www.docusign.com/products/esignature/pricing\nhttps://yousign.com/pricing\nhttps://penneo.com/blog/`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={handlePreview}
            disabled={previewing || !text.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {previewing ? "Detecting..." : "Preview import"}
          </button>
        </div>
      </div>

      {preview && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-600">{preview.summary.new} new</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-600">
                {preview.summary.duplicate} duplicate
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-600">
                {preview.summary.invalid} invalid
              </span>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-8">
                    #
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Competitor / URL
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Theme
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Note
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.results.map((r) => (
                  <tr
                    key={r.index}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-2 text-gray-400 font-mono">
                      {r.index + 1}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">
                        {r.entry?.competitor || "—"}
                      </div>
                      <div className="text-xs text-gray-400 truncate max-w-[300px]">
                        {r.entry?.url || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">
                        {r.entry?.theme || "?"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {r.status === "duplicate" && r.matchedSource
                        ? `Already exists as "${r.matchedSource}"`
                        : r.reason || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!importDone && preview.summary.new > 0 && (
            <div className="mt-4">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {importing
                  ? "Importing..."
                  : `Import ${preview.summary.new} new source${preview.summary.new === 1 ? "" : "s"}`}
              </button>
            </div>
          )}

          {importDone && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              Imported {preview.summary.inserted} source
              {preview.summary.inserted === 1 ? "" : "s"}.{" "}
              {preview.summary.duplicate > 0 &&
                `Skipped ${preview.summary.duplicate} duplicate${preview.summary.duplicate === 1 ? "" : "s"}. `}
              {preview.summary.invalid > 0 &&
                `${preview.summary.invalid} invalid. `}
              <button
                onClick={() => {
                  router.push("/admin");
                  router.refresh();
                }}
                className="underline underline-offset-2 font-medium"
              >
                Back to sources
              </button>
            </div>
          )}

          {!importDone && preview.summary.new === 0 && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              Nothing to import — all entries are duplicates or invalid.
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          How it works
        </h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>Paste URLs one per line. The importer auto-detects:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>
              <strong>Competitor</strong> — from the domain (e.g. docusign.com → docusign)
            </li>
            <li>
              <strong>Theme</strong> — from the URL path (e.g. /pricing → pricing, /blog → market)
            </li>
          </ul>
          <p className="mt-2">
            You can also paste tab-separated rows to override:{" "}
            <code className="bg-gray-100 px-1 rounded">competitor → url → theme → purpose</code>
          </p>
        </div>
      </div>
    </div>
  );
}
