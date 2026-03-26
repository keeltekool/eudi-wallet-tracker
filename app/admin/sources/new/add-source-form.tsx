"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "regulation",
  "technical-standards",
  "national-implementation",
  "industry",
  "security-privacy",
  "interoperability",
  "market-analysis",
];

type ExistingSource = { url: string; name: string };
type PreviewArticle = {
  title: string;
  url: string;
  publishedAt?: string | null;
  author?: string | null;
};

export function AddSourceForm({
  existingSources,
}: {
  existingSources: ExistingSource[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    url: "",
    type: "rss" as "rss" | "css",
    category: "",
    config: "{}",
  });
  const [saving, setSaving] = useState(false);
  const [forceAdd, setForceAdd] = useState(false);

  // Dry-run preview
  const [preview, setPreview] = useState<PreviewArticle[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [testing, setTesting] = useState(false);

  // AI analyze
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Duplicate detection — normalize URLs for comparison
  const duplicateMatch = useMemo(() => {
    if (!form.url.trim()) return null;
    const normalized = form.url.replace(/\/+$/, "").toLowerCase();
    return existingSources.find(
      (s) => s.url.replace(/\/+$/, "").toLowerCase() === normalized
    );
  }, [form.url, existingSources]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Block if duplicate and user hasn't confirmed
    if (duplicateMatch && !forceAdd) return;

    setSaving(true);
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      alert("Invalid JSON in config");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, config: parsedConfig }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDryRun() {
    setTesting(true);
    setPreviewError("");
    setPreview([]);

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      setPreviewError("Invalid JSON in config");
      setTesting(false);
      return;
    }

    const res = await fetch("/api/sources/dry-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        url: form.url,
        config: parsedConfig,
      }),
    });

    const data = await res.json();
    if (data.error) {
      setPreviewError(data.error);
    } else {
      setPreview(data.articles);
    }
    setTesting(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError("");

    const res = await fetch("/api/sources/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: form.url }),
    });

    const data = await res.json();
    if (data.error) {
      setAnalyzeError(data.error);
    } else {
      setForm({ ...form, config: JSON.stringify(data.config, null, 2) });
    }
    setAnalyzing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Biometric Update — EUDI"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        />
      </div>

      {/* URL + duplicate warning */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <input
          required
          type="url"
          value={form.url}
          onChange={(e) => {
            setForm({ ...form, url: e.target.value });
            setForceAdd(false);
          }}
          placeholder="https://example.com/news"
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono ${
            duplicateMatch
              ? "border-amber-400 bg-amber-50"
              : "border-gray-300"
          }`}
        />
        {duplicateMatch && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              This URL is already registered as{" "}
              <strong>{duplicateMatch.name}</strong>
            </p>
            <button
              type="button"
              onClick={() => setForceAdd(true)}
              className="mt-2 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Add anyway
            </button>
            {forceAdd && (
              <span className="ml-2 text-xs text-emerald-700">
                OK, will add as duplicate
              </span>
            )}
          </div>
        )}
      </div>

      {/* Type + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as "rss" | "css" })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="rss">RSS</option>
            <option value="css">CSS</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Config JSON */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Config (JSON)
          </label>
          {form.type === "css" && form.url && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="text-xs font-medium text-gray-900 hover:text-gray-700 underline underline-offset-2 disabled:opacity-50"
            >
              {analyzing ? "Analyzing..." : "Analyze with AI"}
            </button>
          )}
        </div>
        <textarea
          value={form.config}
          onChange={(e) => setForm({ ...form, config: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
        {analyzeError && (
          <p className="mt-1 text-xs text-red-600">{analyzeError}</p>
        )}
      </div>

      {/* Test scrape */}
      <div>
        <button
          type="button"
          onClick={handleDryRun}
          disabled={testing || !form.url}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {testing ? "Testing..." : "Test scrape"}
        </button>

        {previewError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {previewError}
          </div>
        )}

        {preview.length > 0 && (
          <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
              Preview ({preview.length} articles)
            </div>
            {preview.map((article, i) => (
              <div
                key={i}
                className="px-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="text-sm font-medium text-gray-900">
                  {article.title}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {article.url}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving || (!!duplicateMatch && !forceAdd)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Adding..." : "Add source"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
