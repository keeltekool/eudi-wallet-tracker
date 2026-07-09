"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormProject = "allekirjoitus" | "eewatch";

const THEMES_BY_PROJECT: Record<FormProject, { value: string; label: string }[]> = {
  allekirjoitus: [
    { value: "pricing", label: "Pricing & Packaging" },
    { value: "features", label: "Features & Product" },
    { value: "integrations", label: "Integrations" },
    { value: "eid", label: "eID & Auth" },
    { value: "compliance", label: "Compliance & Trust" },
    { value: "market", label: "Market Signals" },
    { value: "eudi-wallet", label: "EUDI Wallet & eIDAS 2.0 Readiness" },
  ],
  eewatch: [
    { value: "home", label: "Homepage" },
    { value: "services", label: "Services / Courses" },
    { value: "pricing", label: "Pricing" },
    { value: "blog", label: "Blog / News" },
    { value: "about", label: "About / Team" },
    { value: "other", label: "Other" },
  ],
};

const COMPETITOR_MAP: Record<string, string> = {
  "docusign.com": "docusign",
  "adobe.com": "adobe-sign",
  "dropboxsign.com": "dropbox-sign",
  "pandadoc.com": "pandadoc",
  "namirial.com": "namirial",
  "yousign.com": "yousign",
  "universign.com": "universign",
  "skribble.com": "skribble",
  "sproof.io": "sproof",
  "penneo.com": "penneo",
  "scrive.com": "scrive",
  "dokobit.com": "dokobit",
  "signicat.com": "signicat",
  "vismasign.fi": "visma-sign",
  "contractbook.com": "scrive",
};

const THEME_HINTS_BY_PROJECT: Record<FormProject, Record<string, string>> = {
  allekirjoitus: {
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
  },
  eewatch: {
    koolitus: "services",
    kursus: "services",
    teenus: "services",
    service: "services",
    advisory: "services",
    hinnad: "pricing",
    hind: "pricing",
    pricing: "pricing",
    blog: "blog",
    blogi: "blog",
    uudised: "blog",
    news: "blog",
    post: "blog",
    meist: "about",
    minust: "about",
    kontakt: "about",
    about: "about",
    tiim: "about",
  },
};

const DEFAULT_THEME: Record<FormProject, string> = {
  allekirjoitus: "market",
  eewatch: "other",
};

function detectFromUrl(
  rawUrl: string,
  project: FormProject,
): { competitor: string; theme: string; purpose: string } | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.toLowerCase();

    const competitor =
      project === "eewatch"
        ? host.split(".")[0]
        : COMPETITOR_MAP[host] || host.split(".")[0];

    let theme =
      project === "eewatch" && (path === "/" || path === "")
        ? "home"
        : DEFAULT_THEME[project];
    for (const [hint, t] of Object.entries(THEME_HINTS_BY_PROJECT[project])) {
      if (path.includes(hint)) {
        theme = t;
        break;
      }
    }

    const pathLabel = path.replace(/^\/|\/$/g, "").replace(/\//g, " › ") || "homepage";
    const purpose = `${competitor} ${pathLabel}`;

    return { competitor, theme, purpose };
  } catch {
    return null;
  }
}

export function AllekirjoitusCreateForm({
  project = "allekirjoitus",
}: {
  project?: FormProject;
}) {
  const THEMES = THEMES_BY_PROJECT[project];
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [theme, setTheme] = useState(DEFAULT_THEME[project]);
  const [purpose, setPurpose] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState(false);

  function handleUrlChange(value: string) {
    setUrl(value);
    setDetected(false);
    const result = detectFromUrl(value, project);
    if (result) {
      setCompetitor(result.competitor);
      setTheme(result.theme);
      setPurpose(result.purpose);
      setDetected(true);
    }
  }

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

    if (!isHttpsUrl(url)) {
      setError("URL must be a valid https:// URL.");
      return;
    }
    if (!competitor.trim()) {
      setError("Competitor could not be detected. Please enter manually.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
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
          URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://scrive.com/pricing"
          required
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-500">
          Paste a URL — competitor and theme are auto-detected.
        </p>
      </div>

      {detected && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
          Detected: <strong>{competitor}</strong> · {THEMES.find((t) => t.value === theme)?.label || theme}
        </div>
      )}

      <details className="group" open={!detected && url.length > 0}>
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors">
          Override detected values
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Competitor
            </label>
            <input
              type="text"
              value={competitor}
              onChange={(e) => setCompetitor(e.target.value)}
              placeholder="e.g. scrive"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
            />
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
        </div>
      </details>

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
