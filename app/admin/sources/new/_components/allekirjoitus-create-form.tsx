"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const THEMES: { value: string; label: string }[] = [
  { value: "pricing", label: "Pricing & Packaging" },
  { value: "features", label: "Features & Product" },
  { value: "integrations", label: "Integrations" },
  { value: "eid", label: "eID & Auth" },
  { value: "compliance", label: "Compliance & Trust" },
  { value: "market", label: "Market Signals" },
  { value: "eudi-wallet", label: "EUDI Wallet & eIDAS 2.0 Readiness" },
];

export function AllekirjoitusCreateForm() {
  const router = useRouter();
  const [competitor, setCompetitor] = useState("");
  const [url, setUrl] = useState("");
  const [theme, setTheme] = useState("pricing");
  const [purpose, setPurpose] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function isHttpsUrl(value: string): boolean {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!competitor.trim()) {
      setError("Competitor is required.");
      return;
    }
    if (!isHttpsUrl(url)) {
      setError("URL must be a valid https:// URL.");
      return;
    }
    if (!THEMES.some((t) => t.value === theme)) {
      setError("Invalid theme.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: "allekirjoitus",
        competitor: competitor.trim(),
        url: url.trim(),
        theme,
        purpose: purpose.trim() || null,
        active,
      }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save source.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Competitor
        </label>
        <input
          type="text"
          value={competitor}
          onChange={(e) => setCompetitor(e.target.value)}
          placeholder="e.g. scrive"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Free-form label grouping multiple URLs for the same competitor.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://scrive.com/pricing"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">Must be https://.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Theme
        </label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Purpose <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. Scrive main pricing page"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="active"
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        <label htmlFor="active" className="text-sm text-gray-700">
          Active
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Add source"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
