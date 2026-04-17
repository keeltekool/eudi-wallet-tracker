"use client";

import { usePathname } from "next/navigation";
import { ProjectSwitcher } from "./project-switcher";

/**
 * Sticky admin header strip. Hidden on the pre-auth login route so the
 * login page stays visually identical to before the multi-project work.
 */
export function AdminHeader() {
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;

  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-end">
        <ProjectSwitcher />
      </div>
    </div>
  );
}
