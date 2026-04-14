"use client";

import { useState } from "react";

type Update = {
  content: string;
  runDate: string;
  articlesProcessed: number;
  sectionsTouched: string[];
};

type Props = {
  bible: string;
  updates: Update[];
};

function parseBibleSections(
  markdown: string
): { title: string; content: string }[] {
  const lines = markdown.split("\n");
  const sections: { title: string; content: string }[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.match(/^## /)) {
      if (inSection) {
        sections.push({
          title: currentTitle,
          content: currentLines.join("\n").trim(),
        });
      }
      currentTitle = line.replace(/^## /, "").trim();
      currentLines = [];
      inSection = true;
    } else if (inSection) {
      currentLines.push(line);
    }
  }
  if (inSection) {
    sections.push({
      title: currentTitle,
      content: currentLines.join("\n").trim(),
    });
  }

  // Filter out non-content sections (subtitle, empty)
  return sections.filter(
    (s) =>
      s.content.length > 0 &&
      !s.title.toLowerCase().includes("strategic intelligence reference")
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
    const codeMatch = remaining.match(/`(.+?)`/);

    const matches = [
      boldMatch
        ? { type: "bold", index: remaining.indexOf(boldMatch[0]), match: boldMatch }
        : null,
      linkMatch
        ? { type: "link", index: remaining.indexOf(linkMatch[0]), match: linkMatch }
        : null,
      codeMatch
        ? { type: "code", index: remaining.indexOf(codeMatch[0]), match: codeMatch }
        : null,
    ]
      .filter(Boolean)
      .sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = matches[0]!;
    if (first.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, first.index)}</span>);
    }

    if (first.type === "bold") {
      parts.push(
        <strong key={key++} className="font-semibold text-[#1A1A2E]">
          <InlineMarkdown text={first.match![1]} />
        </strong>
      );
    } else if (first.type === "link") {
      parts.push(
        <a
          key={key++}
          href={first.match![2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#6366F1] underline hover:text-[#4338CA]"
        >
          {first.match![1]}
        </a>
      );
    } else if (first.type === "code") {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-[#E3E0D9] rounded text-xs"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {first.match![1]}
        </code>
      );
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return <>{parts}</>;
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !l.match(/^\|[\s-|]+\|$/))
    .map((l) =>
      l
        .split("|")
        .filter((cell) => cell.trim() !== "")
        .map((cell) => cell.trim())
    );

  if (rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 text-xs font-semibold text-[#1A1A2E] bg-[#E3E0D9]/50 border-b border-[#E3E0D9]"
                style={{ fontFamily: "var(--font-label)" }}
              >
                <InlineMarkdown text={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2 text-[#4A5568] border-b border-[#E3E0D9]/50"
                >
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-base font-bold text-[#1A1A2E] mt-5 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <InlineMarkdown text={line.replace(/^### /, "")} />
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("  - ")) {
      const indent = line.startsWith("  - ");
      const text = line.replace(/^\s*- /, "");
      elements.push(
        <li
          key={i}
          className={`text-sm text-[#4A5568] leading-relaxed list-disc ml-4 ${indent ? "ml-9" : ""}`}
        >
          <InlineMarkdown text={text} />
        </li>
      );
    } else if (line.startsWith("|") && line.includes("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      i--;
      elements.push(<MarkdownTable key={i} lines={tableLines} />);
    } else if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^> /, ""));
        i++;
      }
      i--;
      elements.push(
        <blockquote
          key={i}
          className="border-l-3 border-[#E3E0D9] pl-4 py-1 my-3 italic text-sm text-[#4A5568]"
        >
          <InlineMarkdown text={quoteLines.join(" ")} />
        </blockquote>
      );
    } else if (line.trim() === "" || line.startsWith("---")) {
      // skip
    } else if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <p key={i} className="text-sm font-semibold text-[#1A1A2E] mt-3 mb-1">
          <InlineMarkdown text={line.replace(/\*\*/g, "")} />
        </p>
      );
    } else if (line.trim()) {
      elements.push(
        <p key={i} className="text-sm text-[#4A5568] leading-relaxed mb-1">
          <InlineMarkdown text={line} />
        </p>
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

export function StrategyContent({ bible, updates }: Props) {
  const sections = parseBibleSections(bible);
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [openUpdates, setOpenUpdates] = useState<Set<number>>(
    new Set(updates.map((_, i) => i))
  );

  const allOpen = openSections.size === sections.length;
  const allUpdatesOpen = openUpdates.size === updates.length;

  const toggleSection = (index: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleUpdate = (index: number) => {
    setOpenUpdates((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (allOpen) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(sections.map((_, i) => i)));
    }
  };

  const toggleAllUpdates = () => {
    if (allUpdatesOpen) {
      setOpenUpdates(new Set());
    } else {
      setOpenUpdates(new Set(updates.map((_, i) => i)));
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-10">
        <h1
          className="text-3xl font-bold text-[#1A1A2E] mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          EUDI Wallet Strategy Brief
        </h1>
        <p className="text-sm text-[#4A5568] mb-1">
          AI-maintained intelligence reference · Updated twice monthly
        </p>
        <p className="text-xs text-[#94A3B8] mb-3">
          This document is continuously updated by an automated curation
          pipeline monitoring 36+ EUDI Wallet sources.
        </p>
      </div>

      {/* Collapsible sections */}
      <div className="space-y-2 mb-12">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Strategic Reference
          </h2>
          <button
            onClick={toggleAll}
            className="text-xs font-medium text-[#4A5568] hover:text-[#1A1A2E] transition-colors"
            style={{ fontFamily: "var(--font-label)" }}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {sections.map((section, i) => (
          <div
            key={i}
            className="bg-white border border-[#E3E0D9] rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleSection(i)}
              className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#F9F8F5] transition-colors"
            >
              <span
                className="text-sm font-bold text-[#1A1A2E]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {section.title}
              </span>
              <span className="text-[#94A3B8] text-xs ml-2 shrink-0">
                {openSections.has(i) ? "▲" : "▼"}
              </span>
            </button>
            {openSections.has(i) && (
              <div className="px-5 pb-4 border-t border-[#E3E0D9]">
                <MarkdownBlock content={section.content} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t-2 border-[#E3E0D9] mb-10" />

      {/* Intelligence Updates */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Intelligence Updates
          </h2>
          {updates.length > 0 && (
            <button
              onClick={toggleAllUpdates}
              className="text-xs font-medium text-[#4A5568] hover:text-[#1A1A2E] transition-colors"
              style={{ fontFamily: "var(--font-label)" }}
            >
              {allUpdatesOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>

        {updates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#94A3B8]">
              No intelligence updates yet. The first update will appear after
              the curation loop processes new articles against the strategy
              brief.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {updates.map((update, i) => (
              <div
                key={i}
                className="bg-white border border-[#E3E0D9] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleUpdate(i)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[#F9F8F5] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold text-[#1A1A2E]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Update:{" "}
                      {new Date(update.runDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      className="text-[10px] text-[#94A3B8] uppercase tracking-wider"
                      style={{ fontFamily: "var(--font-label)" }}
                    >
                      {update.articlesProcessed} articles reviewed
                    </span>
                  </div>
                  <span className="text-[#94A3B8] text-xs ml-2 shrink-0">
                    {openUpdates.has(i) ? "▲" : "▼"}
                  </span>
                </button>
                {openUpdates.has(i) && (
                  <div className="px-5 pb-4 border-t border-[#E3E0D9]">
                    {update.sectionsTouched.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                        {update.sectionsTouched.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#E8E8F4] text-[#1A1A2E]"
                            style={{ fontFamily: "var(--font-label)" }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <MarkdownBlock content={update.content} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
