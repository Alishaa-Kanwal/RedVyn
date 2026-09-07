import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard"];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const token = request.cookies.get("redvyn_token")?.value;
    if (!token) {
      const signin = new URL("/auth/signin", request.url);
      signin.searchParams.set("from", pathname);
      return NextResponse.redirect(signin);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
