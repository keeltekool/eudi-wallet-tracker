"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const COOKIE_NAME = "selected_project_id";

const OPTIONS = [
  { value: "eudi", label: "EUDI Wallet Tracker" },
  { value: "allekirjoitus", label: "Allekirjoitus Competitive Intel" },
] as const;

type Value = (typeof OPTIONS)[number]["value"];

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match?.split("=")[1];
}

function writeCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 90; // 90 days
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function ProjectSwitcher() {
  const router = useRouter();
  const [value, setValue] = useState<Value>("eudi");

  useEffect(() => {
    const cookieVal = readCookie(COOKIE_NAME);
    if (cookieVal === "eudi" || cookieVal === "allekirjoitus") {
      setValue(cookieVal);
    }
  }, []);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Value;
    setValue(next);
    writeCookie(COOKIE_NAME, next);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">Project:</span>
      <select
        value={value}
        onChange={onChange}
        className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900"
        aria-label="Select project for admin views"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
