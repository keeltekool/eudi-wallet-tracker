import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The admin UI's own API routes sit behind the same cookie gate as /admin.
  // /api/loop, /api/newsletter/* and /api/admin/login stay outside the matcher (own token or public).
  const isApi = pathname.startsWith("/api/");

  if (isApi || (pathname.startsWith("/admin") && pathname !== "/admin/login")) {
    const token = request.cookies.get("admin_token")?.value;
    const expected = process.env.ADMIN_PASSWORD;

    if (!token || token !== expected) {
      if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/sources/:path*", "/api/athlon/:path*", "/api/runs"],
};
