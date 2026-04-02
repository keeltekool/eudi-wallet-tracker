"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "All articles" },
  { href: "/filtered", label: "Filtered" },
  { href: "/curated", label: "Curated" },
];

export function Header() {
  const pathname = usePathname();

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

          <nav className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive =
                tab.href === "/"
                  ? pathname === "/" || pathname === ""
                  : pathname === tab.href;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-[#1A1A2E] text-white"
                      : "text-[#4A5568] hover:text-[#1A1A2E] hover:bg-[#E3E0D9]/50"
                  }`}
                  style={{ fontFamily: "var(--font-label)" }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/strategy"
            className={`text-xs font-semibold uppercase tracking-wider transition-colors ${
              pathname === "/strategy"
                ? "text-[#1A1A2E]"
                : "text-[#4A5568] hover:text-[#1A1A2E]"
            }`}
            style={{ fontFamily: "var(--font-label)" }}
          >
            Strategy Brief
          </Link>
        </nav>
      </div>
    </header>
  );
}
