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

type Step = "url" | "configuring" | "preview" | "saving";

export function AddSourceForm({
  existingSources,
}: {
  existingSources: ExistingSource[];
}) {
  const router = useRouter();

  // Core state
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"rss" | "css">("rss");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState<Step>("url");
  const [forceAdd, setForceAdd] = useState(false);

  // Preview
  const [preview, setPreview] = useState<PreviewArticle[]>([]);
  const [previewError, setPreviewError] = useState("");

  // Status messages
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  // Advanced toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Duplicate detection
  const duplicateMatch = useMemo(() => {
    if (!url.trim()) return null;
    const normalized = url.replace(/\/+$/, "").toLowerCase();
    return existingSources.find(
      (s) => s.url.replace(/\/+$/, "").toLowerCase() === normalized
    );
  }, [url, existingSources]);

  async function handleAnalyze() {
    if (!url.trim()) return;
    if (duplicateMatch && !forceAdd) return;

    setStep("configuring");
    setError("");
    setPreview([]);
    setPreviewError("");
    setStatusMessage("Checking for RSS feed...");

    try {
      // Step 0: YouTube URL detection
      // If it's a YouTube channel URL, extract channel ID and construct RSS feed
      const ytMatch = url.match(
        /youtube\.com\/(?:@[\w-]+|channel\/(UC[\w-]+))/
      );
      if (ytMatch) {
        setStatusMessage("Detected YouTube channel — extracting feed...");

        // Fetch the YouTube page to extract channel_id from HTML
        const ytRes = await fetch("/api/sources/dry-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "css",
            url: url.replace(/\/videos\/?$/, ""),
            config: {
              articleSelector: "nonexistent",
            },
          }),
        });
        // We don't care about the CSS result — we need to fetch the page ourselves
        // Use the analyze endpoint to get the page HTML and extract channel_id
        const pageRes = await fetch("/api/sources/youtube-feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.replace(/\/videos\/?$/, "") }),
        });
        const ytData = await pageRes.json();

        if (ytData.feedUrl) {
          const ytRssRes = await fetch("/api/sources/dry-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "rss",
              url: url,
              config: { feedUrl: ytData.feedUrl },
            }),
          });
          const ytRssData = await ytRssRes.json();

          if (!ytRssData.error && ytRssData.articles?.length > 0) {
            setType("rss");
            setConfig({ feedUrl: ytData.feedUrl });
            setPreview(ytRssData.articles);
            setStatusMessage("");
            if (!name) setName(ytData.channelName || "YouTube Channel");
            setStep("preview");
            return;
          }
        }

        setStatusMessage("Could not extract YouTube feed. Trying other methods...");
      }

      // Step 1: Try RSS auto-detection
      const feedPaths = ["/feed", "/feed/", "/rss", "/atom.xml", "/feed.xml"];
      const baseUrl = new URL(url);

      let rssFound = false;
      let feedUrl = "";
      let rssArticles: PreviewArticle[] = [];

      // First try the URL itself as a feed
      const directRes = await fetch("/api/sources/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rss",
          url: url,
          config: { feedUrl: url },
        }),
      });
      const directData = await directRes.json();
      if (!directData.error && directData.articles?.length > 0) {
        rssFound = true;
        feedUrl = url;
        rssArticles = directData.articles;
      }

      // Try common feed paths
      if (!rssFound) {
        for (const path of feedPaths) {
          const tryUrl = `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, "")}${path}`;
          setStatusMessage(`Trying ${path}...`);

          const res = await fetch("/api/sources/dry-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "rss",
              url: tryUrl,
              config: { feedUrl: tryUrl },
            }),
          });
          const data = await res.json();

          if (!data.error && data.articles?.length > 0) {
            rssFound = true;
            feedUrl = tryUrl;
            rssArticles = data.articles;
            break;
          }
        }
      }

      if (rssFound) {
        // RSS found — auto-configure
        setType("rss");
        setConfig({ feedUrl });
        setPreview(rssArticles);
        setStatusMessage("");

        // Try to extract a name from the feed if not set
        if (!name) {
          // Use domain name as fallback
          const domain = new URL(url).hostname.replace("www.", "");
          setName(domain.charAt(0).toUpperCase() + domain.slice(1));
        }

        setStep("preview");
        return;
      }

      // Step 2: No RSS found — use Claude AI to analyze CSS selectors
      setStatusMessage("No RSS feed found. Analyzing page with AI...");

      const analyzeRes = await fetch("/api/sources/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const analyzeData = await analyzeRes.json();

      if (analyzeData.error) {
        setError(`AI analysis failed: ${analyzeData.error}`);
        setStep("url");
        setStatusMessage("");
        return;
      }

      setType("css");
      setConfig(analyzeData.config);

      // Try dry-run with AI-generated selectors
      setStatusMessage("Testing AI-generated selectors...");

      const cssRes = await fetch("/api/sources/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "css",
          url,
          config: analyzeData.config,
        }),
      });
      const cssData = await cssRes.json();

      if (cssData.error) {
        setPreviewError(cssData.error);
      } else {
        setPreview(cssData.articles || []);
      }

      if (!name) {
        const domain = new URL(url).hostname.replace("www.", "");
        setName(domain.charAt(0).toUpperCase() + domain.slice(1));
      }

      setStatusMessage("");
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStep("url");
      setStatusMessage("");
    }
  }

  async function handleSave() {
    setStep("saving");

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        url,
        type,
        category: category || null,
        config,
        active: true,
      }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Failed to save source");
      setStep("preview");
    }
  }

  function handleReset() {
    setStep("url");
    setPreview([]);
    setPreviewError("");
    setError("");
    setStatusMessage("");
    setConfig({});
    setType("rss");
    setShowAdvanced(false);
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Enter URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Source URL
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setForceAdd(false);
              if (step !== "url") handleReset();
            }}
            placeholder="https://example.com/news"
            className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono ${
              duplicateMatch
                ? "border-amber-400 bg-amber-50"
                : "border-gray-300"
            }`}
            disabled={step === "configuring"}
            autoFocus
          />
          {step === "url" && (
            <button
              onClick={handleAnalyze}
              disabled={
                !url.trim() || (!!duplicateMatch && !forceAdd)
              }
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              Analyze source
            </button>
          )}
        </div>

        {/* Duplicate warning */}
        {duplicateMatch && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Already registered as{" "}
              <strong>{duplicateMatch.name}</strong>
            </p>
            <button
              type="button"
              onClick={() => setForceAdd(true)}
              className="mt-1 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
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

        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Configuring state */}
      {step === "configuring" && (
        <div className="flex items-center gap-3 py-8 justify-center text-gray-500">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Step 2: Preview + configure */}
      {step === "preview" && (
        <>
          {/* Detection result */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            {type === "rss" ? (
              <span className="text-emerald-700">
                RSS feed detected — auto-configured
              </span>
            ) : (
              <span className="text-blue-700">
                No RSS feed — CSS selectors generated by AI
              </span>
            )}
          </div>

          {/* Name + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Biometric Update — EUDI"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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

          {/* Preview articles */}
          {previewError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Preview failed: {previewError}
            </div>
          )}

          {preview.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                Preview — {preview.length} article{preview.length === 1 ? "" : "s"} found
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

          {preview.length === 0 && !previewError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              No articles found. The selectors might need manual adjustment — expand "Advanced" below.
            </div>
          )}

          {/* Advanced: show raw config */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              {showAdvanced ? "Hide advanced" : "Advanced: edit config"}
            </button>

            {showAdvanced && (
              <div className="mt-2">
                <div className="flex gap-3 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) =>
                        setType(e.target.value as "rss" | "css")
                      }
                      className="px-2 py-1 border border-gray-300 rounded text-xs"
                    >
                      <option value="rss">RSS</option>
                      <option value="css">CSS</option>
                    </select>
                  </div>
                </div>
                <textarea
                  value={JSON.stringify(config, null, 2)}
                  onChange={(e) => {
                    try {
                      setConfig(JSON.parse(e.target.value));
                    } catch {
                      // Let them type — will validate on save
                    }
                  }}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/sources/dry-run", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type, url, config }),
                    });
                    const data = await res.json();
                    if (data.error) {
                      setPreviewError(data.error);
                      setPreview([]);
                    } else {
                      setPreview(data.articles || []);
                      setPreviewError("");
                    }
                  }}
                  className="mt-2 px-3 py-1 border border-gray-300 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                >
                  Re-test with edited config
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Activate source
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Start over
            </button>
            <button
              onClick={() => {
                router.push("/admin");
              }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Saving state */}
      {step === "saving" && (
        <div className="flex items-center gap-3 py-8 justify-center text-gray-500">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">Adding source...</span>
        </div>
      )}
    </div>
  );
}
