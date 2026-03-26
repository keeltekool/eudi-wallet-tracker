import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-30 bg-[#F5F3EE]/80 backdrop-blur-xl border-b border-[#E3E0D9]">
      <div className="max-w-4xl mx-auto px-4 sm:px-10 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="text-lg font-bold tracking-tight text-[#1A1A2E]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            EUDI Tracker
          </span>
        </Link>

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
