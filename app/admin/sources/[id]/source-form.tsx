"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Source = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "css";
  category: string | null;
  config: Record<string, unknown> | null;
  active: boolean;
  lastScrapedAt: Date | null;
  lastArticleCount: number | null;
};

const CATEGORIES = [
  "regulation",
  "technical-standards",
  "national-implementation",
  "industry",
  "security-privacy",
  "interoperability",
  "market-analysis",
];

type PreviewArticle = {
  title: string;
  url: string;
  publishedAt?: string | null;
  author?: string | null;
};

export function SourceForm({ source }: { source: Source }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: source.name,
    url: source.url,
    type: source.type,
    category: source.category || "",
    config: JSON.stringify(source.config || {}, null, 2),
    active: source.active,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dry-run preview state
  const [preview, setPreview] = useState<PreviewArticle[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [testing, setTesting] = useState(false);

  // AI analyze state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  async function handleSave() {
    setSaving(true);
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      alert("Invalid JSON in config");
      setSaving(false);
      return;
    }

    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, config: parsedConfig }),
    });
    setSaving(false);
    router.push("/admin");
    router.refresh();
  }

  async function handleToggleActive() {
    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !source.active }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${source.name}"? Articles from this source will be preserved.`
      )
    )
      return;
    setDeleting(true);
    await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    router.push("/admin");
    router.refresh();
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
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        />
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
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
          {form.type === "css" && (
            <button
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
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-400">
          RSS: {"{ \"feedUrl\": \"...\" }"} · CSS:{" "}
          {"{ \"articleSelector\": \"...\", \"titleSelector\": \"...\", ... }"}
        </p>
        {analyzeError && (
          <p className="mt-1 text-xs text-red-600">{analyzeError}</p>
        )}
      </div>

      {/* Test scrape */}
      <div>
        <button
          onClick={handleDryRun}
          disabled={testing}
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
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            onClick={handleToggleActive}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {source.active ? "Pause" : "Resume"}
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete source
        </button>
      </div>
    </div>
  );
}
