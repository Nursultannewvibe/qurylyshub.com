import { NextResponse, type NextRequest } from "next/server";
const PROTECTED = ["/dashboard", "/projects", "/inbox", "/outbox", "/deals", "/threads", "/supplier", "/admin", "/supervisor", "/settings", "/notifications", "/requests", "/broadcast"];
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (PROTECTED.some((x) => p === x || p.startsWith(x + "/")) && !req.cookies.get("qh_session")) {
    const url = new URL("/login", req.url); url.searchParams.set("next", p); return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next|uploads|favicon.ico).*)"] };
