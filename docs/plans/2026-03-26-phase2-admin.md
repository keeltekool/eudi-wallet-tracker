# Phase 2: Admin UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the password-protected admin interface for source management — add, edit, pause, delete, health monitoring, dry-run testing, and Claude API-powered CSS selector generation.

**Architecture:** Next.js 15 App Router on Vercel. Admin routes behind cookie-based password gate (env var, no Clerk). Shared Drizzle schema from `src/db/`. API routes handle CRUD + dry-run + Claude API analysis. This same Next.js app will serve the public dashboard in Phase 3.

**Tech Stack:** Next.js 15, Tailwind CSS 4, Drizzle ORM, Neon Postgres, Anthropic SDK (source onboarding only).

---

## Phase Structure

| Phase | Tasks | What's Verified |
|-------|-------|-----------------|
| **Scaffold** | Tasks 1–2 | Next.js app running, DB connected, Tailwind working |
| **Auth** | Task 3 | Password gate protects `/admin` routes |
| **Source CRUD** | Tasks 4–6 | List view, add/edit forms, pause/delete actions |
| **Smart Onboarding** | Tasks 7–8 | RSS auto-detect, Claude API selector gen, dry-run preview |
| **Health & Status** | Task 9 | Health indicators, loop status widget |
| **CHECKPOINT** | — | Full admin E2E via browser |

---

## Task 1: Next.js Scaffold

**Files:**
- Modify: `package.json` (add Next.js deps)
- Create: `next.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (placeholder — becomes dashboard in Phase 3)
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`

**Step 1: Install Next.js + Tailwind**

```bash
npm install next@latest react@latest react-dom@latest
npm install -D tailwindcss @tailwindcss/postcss postcss
```

**Step 2: Create `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Worker lives in separate deploy — exclude from Next.js build
  typescript: {
    // Allow build even if worker code has different tsconfig
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
```

**Step 3: Create `postcss.config.mjs`**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**Step 4: Create `app/globals.css`**

```css
@import "tailwindcss";
```

**Step 5: Create `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EUDI Wallet Tracker",
  description: "Automated intelligence monitoring for EU Digital Identity Wallet developments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Step 6: Create `app/page.tsx`**

```tsx
export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">EUDI Wallet Tracker</h1>
        <p className="mt-2 text-gray-500">Dashboard coming in Phase 3</p>
      </div>
    </div>
  );
}
```

**Step 7: Add scripts to `package.json`**

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start"
}
```

**Step 8: Update root `tsconfig.json` for Next.js**

Next.js auto-generates its own tsconfig on first run. Run `npm run dev` once, let it set up, then verify.

**Step 9: Verify**

```bash
npm run dev
```

Open http://localhost:3000 — see placeholder page.

**Step 10: Commit**

```bash
git add -A && git commit -m "feat: Next.js 15 scaffold with Tailwind"
```

---

## Task 2: DB Connection for Next.js

The shared `src/db/` already exists. Next.js needs to use it via server components and API routes.

**Files:**
- Create: `src/db/client.ts` (singleton for Next.js server-side)

**Step 1: Create `src/db/client.ts`**

```typescript
import { createDb } from "./index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const db = createDb(process.env.DATABASE_URL);
```

**Step 2: Add DATABASE_URL to `.env.local`**

Already done from Phase 1.

**Step 3: Verify — create a test server component**

Create `app/admin/page.tsx` that queries source count:

```tsx
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { count } from "drizzle-orm";

export default async function AdminPage() {
  const [result] = await db.select({ count: count() }).from(sources);
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-2 text-gray-500">{result.count} sources configured</p>
    </div>
  );
}
```

Open http://localhost:3000/admin — should show "36 sources configured".

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: DB client singleton for Next.js"
```

---

## Task 3: Admin Password Gate

Simple cookie-based auth. No Clerk, no OAuth. ENV var `ADMIN_PASSWORD`, login form sets a cookie, middleware checks it.

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/api/admin/login/route.ts`
- Create: `middleware.ts`

**Step 1: Add ADMIN_PASSWORD to `.env.local`**

```
ADMIN_PASSWORD=eudi-admin-2026
```

**Step 2: Create `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes (not /admin/login)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = request.cookies.get("admin_token")?.value;
    const expected = process.env.ADMIN_PASSWORD;

    if (!token || token !== expected) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

**Step 3: Create `app/api/admin/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_token", process.env.ADMIN_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
```

**Step 4: Create `app/admin/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Wrong password");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-8"
      >
        <h1 className="text-xl font-bold text-center mb-6">EUDI Admin</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          autoFocus
        />
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

**Step 5: Verify**

- http://localhost:3000/admin → redirects to `/admin/login`
- Enter wrong password → "Wrong password"
- Enter correct password → redirects to `/admin`, shows source count

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: admin password gate with cookie auth"
```

---

## ── CHECKPOINT: Scaffold ──

**Verify via browser:**
- [ ] http://localhost:3000 — placeholder page loads
- [ ] http://localhost:3000/admin — redirects to login
- [ ] Login with correct password → admin page with "36 sources"
- [ ] Login with wrong password → error message

---

## Task 4: Source List View

The main admin page — table of all sources with health indicators.

**Files:**
- Create: `app/admin/page.tsx` (replace placeholder)
- Create: `app/admin/components/source-table.tsx`
- Create: `app/admin/components/status-badge.tsx`

**Step 1: Create `app/admin/components/status-badge.tsx`**

```tsx
type Props = {
  active: boolean;
  lastArticleCount: number | null;
  lastScrapedAt: Date | null;
};

export function StatusBadge({ active, lastArticleCount, lastScrapedAt }: Props) {
  if (!active) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Paused
      </span>
    );
  }

  if (!lastScrapedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        New
      </span>
    );
  }

  if (lastArticleCount === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        Broken
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
      Healthy
    </span>
  );
}
```

**Step 2: Create `app/admin/components/source-table.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "./status-badge";

type Source = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "css";
  category: string | null;
  active: boolean;
  lastScrapedAt: Date | null;
  lastArticleCount: number | null;
};

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SourceTable({ sources }: { sources: Source[] }) {
  const router = useRouter();

  const healthy = sources.filter(
    (s) => s.active && s.lastScrapedAt && s.lastArticleCount !== 0
  ).length;
  const broken = sources.filter(
    (s) => s.active && s.lastScrapedAt && s.lastArticleCount === 0
  ).length;
  const paused = sources.filter((s) => !s.active).length;

  return (
    <div>
      {/* Health summary */}
      <div className="flex gap-4 mb-6">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-gray-600">{healthy} healthy</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-gray-600">{broken} broken</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-gray-600">{paused} paused</span>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Source</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Last Scraped</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Articles</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.id}
                onClick={() => router.push(`/admin/sources/${source.id}`)}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{source.name}</div>
                  <div className="text-xs text-gray-400 truncate max-w-[300px]">
                    {source.url}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">
                    {source.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{source.category || "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    active={source.active}
                    lastArticleCount={source.lastArticleCount}
                    lastScrapedAt={source.lastScrapedAt}
                  />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {timeAgo(source.lastScrapedAt)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">
                  {source.lastArticleCount ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Update `app/admin/page.tsx`**

```tsx
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { desc } from "drizzle-orm";
import { SourceTable } from "./components/source-table";
import Link from "next/link";

export default async function AdminPage() {
  const allSources = await db
    .select()
    .from(sources)
    .orderBy(desc(sources.lastScrapedAt));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Sources</h1>
            <p className="text-sm text-gray-500 mt-1">
              {allSources.length} sources configured
            </p>
          </div>
          <Link
            href="/admin/sources/new"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Add source
          </Link>
        </div>
        <SourceTable sources={allSources} />
      </div>
    </div>
  );
}
```

**Step 4: Verify**

Open http://localhost:3000/admin — see table with 36 sources, health badges, article counts.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin source list with health indicators"
```

---

## Task 5: Source Detail + Edit + Pause/Delete

**Files:**
- Create: `app/admin/sources/[id]/page.tsx`
- Create: `app/admin/sources/[id]/source-form.tsx`
- Create: `app/api/sources/[id]/route.ts`

**Step 1: Create `app/api/sources/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { eq } from "drizzle-orm";

// GET source by ID
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, parseInt(id)));

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(source);
}

// PATCH — update source fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(sources)
    .set({
      name: body.name,
      url: body.url,
      type: body.type,
      category: body.category,
      config: body.config,
      active: body.active,
    })
    .where(eq(sources.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}

// DELETE — remove source (articles preserved)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(sources).where(eq(sources.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
```

**Step 2: Create `app/admin/sources/[id]/source-form.tsx`**

Client component with edit form, pause/resume toggle, delete button. Includes JSON config editor for CSS selectors.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Source = {
  id: number;
  name: string;
  url: string;
  type: "rss" | "css";
  category: string | null;
  config: any;
  active: boolean;
  lastScrapedAt: Date | null;
  lastArticleCount: number | null;
};

const CATEGORIES = [
  "regulation",
  "technical-standards",
  "national-implementation",
  "industry",
  "security-privacy",
  "interoperability",
  "market-analysis",
];

export function SourceForm({ source }: { source: Source }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: source.name,
    url: source.url,
    type: source.type,
    category: source.category || "",
    config: JSON.stringify(source.config || {}, null, 2),
    active: source.active,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      alert("Invalid JSON in config");
      setSaving(false);
      return;
    }

    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, config: parsedConfig }),
    });
    setSaving(false);
    router.push("/admin");
    router.refresh();
  }

  async function handleToggleActive() {
    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !source.active }),
    });
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${source.name}"? Articles from this source will be preserved.`)) return;
    setDeleting(true);
    await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        />
      </div>

      {/* URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
      </div>

      {/* Type + Category row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "rss" | "css" })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="rss">RSS</option>
            <option value="css">CSS</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Config JSON */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Config (JSON)
        </label>
        <textarea
          value={form.config}
          onChange={(e) => setForm({ ...form, config: e.target.value })}
          rows={8}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
        <p className="mt-1 text-xs text-gray-400">
          RSS: {`{ "feedUrl": "..." }`} · CSS: {`{ "articleSelector": "...", "titleSelector": "...", ... }`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            onClick={handleToggleActive}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {source.active ? "Pause" : "Resume"}
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete source
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Create `app/admin/sources/[id]/page.tsx`**

```tsx
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SourceForm } from "./source-form";
import Link from "next/link";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, parseInt(id)));

  if (!source) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">{source.name}</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <SourceForm source={source} />
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Verify**

- Click a source row in the table → detail page with form
- Edit name → Save → back to list, name updated
- Pause → badge changes to "Paused"
- Delete → confirm → source removed from list

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: source detail page with edit, pause, delete"
```

---

## Task 6: Add Source Page

**Files:**
- Create: `app/admin/sources/new/page.tsx`
- Create: `app/admin/sources/new/add-source-form.tsx`
- Create: `app/api/sources/route.ts`

**Step 1: Create `app/api/sources/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { sources } from "@/src/db/schema";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const [created] = await db
    .insert(sources)
    .values({
      name: body.name,
      url: body.url,
      type: body.type,
      category: body.category || null,
      config: body.config || {},
      active: body.active ?? true,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
```

**Step 2: Create `app/admin/sources/new/add-source-form.tsx`**

```tsx
"use client";

import { useState } from "react";
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

export function AddSourceForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    url: "",
    type: "rss" as "rss" | "css",
    category: "",
    config: "{}",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(form.config);
    } catch {
      alert("Invalid JSON in config");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, config: parsedConfig }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Biometric Update — EUDI"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input
          required
          type="url"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="https://example.com/news"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as "rss" | "css" })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="rss">RSS</option>
            <option value="css">CSS</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="">—</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Config (JSON)</label>
        <textarea
          value={form.config}
          onChange={(e) => setForm({ ...form, config: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm font-mono"
        />
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? "Adding..." : "Add source"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

**Step 3: Create `app/admin/sources/new/page.tsx`**

```tsx
import Link from "next/link";
import { AddSourceForm } from "./add-source-form";

export default function NewSourcePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back to sources
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-6">Add Source</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <AddSourceForm />
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Verify**

- Click "Add source" from admin → form page
- Fill in → submit → back to list with new source

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add source page with form"
```

---

## Task 7: Dry Run Preview

Test what a source would scrape without writing to DB.

**Files:**
- Create: `app/api/sources/dry-run/route.ts`
- Modify: `app/admin/sources/[id]/source-form.tsx` (add dry-run button)

**Step 1: Create `app/api/sources/dry-run/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

// Dynamic import to avoid bundling worker code in Next.js
async function runDryRun(type: string, url: string, config: any) {
  // Inline the parsing logic (same as worker parsers but without store)
  if (type === "rss") {
    const RssParser = (await import("rss-parser")).default;
    const parser = new RssParser({ timeout: 15000 });
    const feedUrl = config.feedUrl || url;
    const feed = await parser.parseURL(feedUrl);
    return feed.items
      .filter((item: any) => item.title?.trim() && item.link)
      .slice(0, 10)
      .map((item: any) => ({
        title: item.title?.trim(),
        url: item.link,
        publishedAt: item.pubDate || null,
        author: item.creator || item["dc:creator"] || null,
      }));
  }

  if (type === "css") {
    const cheerio = await import("cheerio");
    const response = await fetch(url, {
      headers: { "User-Agent": "EUDI-Wallet-Tracker/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    if (!config.articleSelector) {
      throw new Error("No articleSelector in config");
    }

    const articles: any[] = [];
    $(config.articleSelector).each((_: number, el: any) => {
      const $el = $(el);
      const titleEl = config.titleSelector ? $el.find(config.titleSelector) : $el;
      const title = titleEl.text().trim();
      const linkEl = config.linkSelector ? $el.find(config.linkSelector) : titleEl;
      const href = linkEl.attr("href") || "";

      if (!title || !href) return;
      const resolvedUrl = new URL(href, config.baseUrl || url).toString();

      articles.push({
        title,
        url: resolvedUrl,
        publishedAt: config.dateSelector
          ? $el.find(config.dateSelector).text().trim() || null
          : null,
        author: config.authorSelector
          ? $el.find(config.authorSelector).text().trim() || null
          : null,
      });
    });

    return articles.slice(0, 10);
  }

  throw new Error(`Unknown type: ${type}`);
}

export async function POST(request: NextRequest) {
  const { type, url, config } = await request.json();

  try {
    const articles = await runDryRun(type, url, config);
    return NextResponse.json({ articles, count: articles.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message, articles: [] }, { status: 400 });
  }
}
```

**Step 2: Add dry-run button + preview to source-form.tsx**

Add a "Test scrape" button that calls the dry-run endpoint and shows preview articles below the form. Shows first 10 articles with title + URL.

```tsx
// Add to SourceForm component state:
const [preview, setPreview] = useState<any[]>([]);
const [previewError, setPreviewError] = useState("");
const [testing, setTesting] = useState(false);

async function handleDryRun() {
  setTesting(true);
  setPreviewError("");
  setPreview([]);

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(form.config);
  } catch {
    setPreviewError("Invalid JSON in config");
    setTesting(false);
    return;
  }

  const res = await fetch("/api/sources/dry-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: form.type, url: form.url, config: parsedConfig }),
  });

  const data = await res.json();
  if (data.error) {
    setPreviewError(data.error);
  } else {
    setPreview(data.articles);
  }
  setTesting(false);
}

// Add button after the config textarea and before the save/pause/delete actions:
// <button onClick={handleDryRun}>Test scrape</button>
// <PreviewResults preview={preview} error={previewError} />
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: dry-run preview for source testing"
```

---

## Task 8: Claude API Selector Analysis

When adding a CSS source, allow the owner to click "Analyze with AI" — fetches the page HTML, sends to Claude API, gets back CSS selectors.

**Files:**
- Create: `app/api/sources/analyze/route.ts`
- Modify: Add source form / source detail form (add "Analyze" button)

**Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

Add `ANTHROPIC_API_KEY` to `.env.local`.

**Step 2: Create `app/api/sources/analyze/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  // 1. Fetch the page HTML
  const response = await fetch(url, {
    headers: { "User-Agent": "EUDI-Wallet-Tracker/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `HTTP ${response.status} from ${url}` },
      { status: 400 }
    );
  }

  const html = await response.text();
  // Truncate to ~50k chars to stay within token limits
  const truncatedHtml = html.slice(0, 50000);

  // 2. Ask Claude to generate CSS selectors
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this HTML page and generate CSS selectors to extract news/blog articles.

The page URL is: ${url}

Return ONLY a JSON object with these fields:
- articleSelector: CSS selector for each article/post container
- titleSelector: CSS selector for the title within each article (relative to articleSelector)
- linkSelector: CSS selector for the link within each article (relative to articleSelector)
- dateSelector: CSS selector for the date within each article (or null if not available)
- authorSelector: CSS selector for the author within each article (or null if not available)
- excerptSelector: CSS selector for the excerpt/summary within each article (or null if not available)
- baseUrl: the base URL for resolving relative links (usually the origin of the page URL)

Important:
- All selectors except articleSelector should be RELATIVE to the article container
- Prefer selectors that are stable (class-based over position-based)
- Only return the JSON, no explanation

HTML:
${truncatedHtml}`,
      },
    ],
  });

  // 3. Parse the response
  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  try {
    // Extract JSON from response (Claude might wrap it in backticks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const config = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ config });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: text },
      { status: 500 }
    );
  }
}
```

**Step 3: Add "Analyze with AI" button to forms**

Both add-source and edit-source forms get a button: when type is `css`, show "Analyze with AI" that calls `/api/sources/analyze`, populates the config textarea with the returned selectors.

**Step 4: Verify**

- Set type to CSS, enter a source URL
- Click "Analyze with AI" → config field populates with selectors
- Click "Test scrape" → preview shows extracted articles

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: Claude API CSS selector analysis for source onboarding"
```

---

## Task 9: Loop Status Widget + Scrape Runs View

**Files:**
- Create: `app/admin/components/loop-status.tsx`
- Create: `app/admin/runs/page.tsx`
- Create: `app/api/runs/route.ts`

**Step 1: Create `app/api/runs/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { scrapeRuns } from "@/src/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const runs = await db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.startedAt))
    .limit(20);

  return NextResponse.json(runs);
}
```

**Step 2: Create loop status widget**

Shows last scrape run info + link to Loop Control Center. Server component that queries `scrape_runs` table.

**Step 3: Create scrape runs page**

Table showing recent runs: timestamp, status, sources scraped, articles found, errors.

**Step 4: Add widget to admin layout**

Show loop status at top of admin page, link to runs page.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: loop status widget + scrape runs view"
```

---

## ── FINAL CHECKPOINT: Phase 2 Complete ──

**Verify via chrome-devtools MCP:**
- [ ] `/admin/login` — password form works
- [ ] `/admin` — source list with 36 sources, health badges
- [ ] Click source → edit form, save works
- [ ] Pause/resume toggles active state
- [ ] Delete removes source
- [ ] "Add source" → form → saves new source
- [ ] Dry-run preview shows articles
- [ ] AI analyze populates CSS selectors (needs ANTHROPIC_API_KEY)
- [ ] Scrape runs page shows run history
- [ ] No console errors, responsive layout

---

## File Tree Summary (Phase 2 additions)

```
app/
├── globals.css
├── layout.tsx
├── page.tsx                          # Placeholder (→ dashboard in Phase 3)
├── admin/
│   ├── page.tsx                      # Source list
│   ├── login/
│   │   └── page.tsx                  # Password login
│   ├── components/
│   │   ├── source-table.tsx          # Source list table
│   │   ├── status-badge.tsx          # Health badge
│   │   └── loop-status.tsx           # LCC status widget
│   ├── sources/
│   │   ├── new/
│   │   │   ├── page.tsx
│   │   │   └── add-source-form.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── source-form.tsx
│   └── runs/
│       └── page.tsx                  # Scrape run history
├── api/
│   ├── admin/
│   │   └── login/
│   │       └── route.ts
│   ├── sources/
│   │   ├── route.ts                  # POST create
│   │   ├── [id]/
│   │   │   └── route.ts             # GET/PATCH/DELETE
│   │   ├── dry-run/
│   │   │   └── route.ts             # POST test scrape
│   │   └── analyze/
│   │       └── route.ts             # POST Claude AI analysis
│   └── runs/
│       └── route.ts                  # GET scrape history
├── middleware.ts                      # Admin auth guard
├── next.config.ts
├── postcss.config.mjs
└── src/db/
    └── client.ts                     # Next.js DB singleton
```
