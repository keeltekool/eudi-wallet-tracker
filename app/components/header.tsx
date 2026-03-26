"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const pathname = usePathname();
  const isRaw = pathname === "/" || pathname === "";
  const isCurated = pathname === "/curated";

  return (
    <header className="sticky top-0 z-30 bg-[#F5F3EE]/80 backdrop-blur-xl border-b border-[#E3E0D9]">
      <div className="max-w-4xl mx-auto px-4 sm:px-10 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="text-lg font-bold tracking-tight text-[#1A1A2E]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              EUDI Tracker
            </span>
          </Link>

          {/* View tabs */}
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                isRaw
                  ? "bg-[#1A1A2E] text-white"
                  : "text-[#4A5568] hover:text-[#1A1A2E] hover:bg-[#E3E0D9]/50"
              }`}
              style={{ fontFamily: "var(--font-label)" }}
            >
              All articles
            </Link>
            <Link
              href="/curated"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                isCurated
                  ? "bg-[#1A1A2E] text-white"
                  : "text-[#4A5568] hover:text-[#1A1A2E] hover:bg-[#E3E0D9]/50"
              }`}
              style={{ fontFamily: "var(--font-label)" }}
            >
              Curated
            </Link>
          </nav>
        </div>

        <nav className="flex items-center gap-4">
          <a
            href="#"
            className="text-xs font-semibold uppercase tracking-wider text-[#4A5568] hover:text-[#1A1A2E] transition-colors"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Living Doc
          </a>
        </nav>
      </div>
    </header>
  );
}
