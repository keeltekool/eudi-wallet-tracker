"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SetupResult = {
  sourceId: number;
  sourceName: string;
  status: "success" | "no-articles" | "failed";
  error?: string;
  articlesFound?: number;
};

export function SetupCssButton({ count }: { count: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SetupResult[]>([]);
  const [current, setCurrent] = useState("");
  const [progress, setProgress] = useState(0);

  if (count === 0) return null;

  async function handleSetupAll() {
    setRunning(true);
    setResults([]);
    setProgress(0);

    // Get list of sources needing setup
    const listRes = await fetch("/api/sources/setup-css");
    const listData = await listRes.json();

    const total = listData.sources.length;
    const allResults: SetupResult[] = [];

    for (let i = 0; i < listData.sources.length; i++) {
      const source = listData.sources[i];
      setCurrent(`${source.name} (${i + 1}/${total})`);
      setProgress(Math.round(((i + 1) / total) * 100));

      const res = await fetch("/api/sources/setup-css", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
      const result = await res.json();
      allResults.push(result);
      setResults([...allResults]);
    }

    setCurrent("");
    setRunning(false);
    router.refresh();
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const noArticles = results.filter((r) => r.status === "no-articles").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return (
    <div className="mb-6">
      {!running && results.length === 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-900">
                {count} CSS source{count === 1 ? "" : "s"} need selector setup
              </p>
              <p className="text-xs text-purple-600 mt-0.5">
                AI will analyze each page and generate CSS selectors
                (~$0.01/source)
              </p>
            </div>
            <button
              onClick={handleSetupAll}
              className="px-4 py-2 bg-purple-700 text-white text-sm font-medium rounded-lg hover:bg-purple-800 transition-colors"
            >
              Setup all with AI
            </button>
          </div>
        </div>
      )}

      {running && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <svg
              className="animate-spin h-4 w-4 text-purple-700"
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
            <span className="text-sm text-purple-900">{current}</span>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-1.5">
            <div
              className="bg-purple-700 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!running && results.length > 0 && (
        <div className="p-4 bg-white border border-gray-200 rounded-xl">
          <div className="flex gap-4 mb-3 text-sm">
            <span className="text-emerald-700">
              {succeeded} configured
            </span>
            {noArticles > 0 && (
              <span className="text-amber-700">
                {noArticles} selectors found but 0 articles
              </span>
            )}
            {failed > 0 && (
              <span className="text-red-700">{failed} failed</span>
            )}
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {results.map((r) => (
              <div
                key={r.sourceId}
                className="flex items-center justify-between text-xs py-1"
              >
                <span className="text-gray-700">{r.sourceName}</span>
                <span
                  className={
                    r.status === "success"
                      ? "text-emerald-600"
                      : r.status === "no-articles"
                        ? "text-amber-600"
                        : "text-red-600"
                  }
                >
                  {r.status === "success"
                    ? `${r.articlesFound} articles`
                    : r.status === "no-articles"
                      ? "0 articles"
                      : r.error || "Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
