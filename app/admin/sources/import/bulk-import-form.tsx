"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type ValidationResult = {
  entry: {
    name: string;
    url: string;
    type: string;
    category?: string;
  };
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

const EXAMPLE = `[
  {
    "name": "Example Blog",
    "url": "https://example.com/blog",
    "type": "rss",
    "category": "industry",
    "config": { "feedUrl": "https://example.com/blog/feed" }
  },
  {
    "name": "Another Source",
    "url": "https://another.com/news",
    "type": "css",
    "category": "regulation",
    "config": {}
  }
]`;

export function BulkImportForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");
  const [importDone, setImportDone] = useState(false);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonText(text);
      setPreview(null);
      setError("");
      setImportDone(false);
    };
    reader.readAsText(file);
  }

  async function handlePreview() {
    setPreviewing(true);
    setError("");
    setPreview(null);
    setImportDone(false);

    let entries;
    try {
      entries = JSON.parse(jsonText);
    } catch {
      setError("Invalid JSON. Paste a valid JSON array.");
      setPreviewing(false);
      return;
    }

    if (!Array.isArray(entries)) {
      setError("JSON must be an array of source objects.");
      setPreviewing(false);
      return;
    }

    const res = await fetch("/api/sources/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, action: "preview" }),
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

    let entries;
    try {
      entries = JSON.parse(jsonText);
    } catch {
      return;
    }

    const res = await fetch("/api/sources/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, action: "import" }),
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
      {/* Input area */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700">
            Source data (JSON array)
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setJsonText(EXAMPLE);
                setPreview(null);
                setImportDone(false);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Load example
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Upload .json file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setPreview(null);
            setImportDone(false);
          }}
          rows={12}
          placeholder={`Paste a JSON array:\n${EXAMPLE}`}
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
            disabled={previewing || !jsonText.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {previewing ? "Validating..." : "Preview import"}
          </button>
        </div>
      </div>

      {/* Preview results */}
      {preview && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {/* Summary */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-600">
                {preview.summary.new} new
              </span>
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

          {/* Results table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-8">
                    #
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Source
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">
                    Type
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
                        {r.entry?.name || "—"}
                      </div>
                      <div className="text-xs text-gray-400 truncate max-w-[300px]">
                        {r.entry?.url || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">
                        {r.entry?.type || "?"}
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

          {/* Import button */}
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

          {/* Import done */}
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

      {/* Format spec */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Expected format
        </h3>
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            JSON array of objects. Each object must have:
          </p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>
              <code className="bg-gray-100 px-1 rounded">name</code> (string, required)
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">url</code> (string, required, valid URL)
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">type</code> (string, required: "rss" or "css")
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">category</code> (string, optional: regulation, technical-standards, national-implementation, industry, security-privacy, interoperability, market-analysis)
            </li>
            <li>
              <code className="bg-gray-100 px-1 rounded">config</code> (object, optional: {"{"} feedUrl, articleSelector, titleSelector, linkSelector, dateSelector, authorSelector, excerptSelector, baseUrl {"}"})
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
