import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function middleware(req: Request) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  const session = await auth();
  const isAuthPage = pathname.startsWith("/auth/");
  const isPublicStorefront =
    pathname === "/" ||
    pathname === "/homepage" ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/product/");
  const isPublic = isAuthPage || isPublicStorefront;
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.isAdmin === true;
  const isOperator = session?.user?.role === "OPERATOR";

  // Rule 1: Not authenticated — only allow public pages
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/auth/login", url));
  }

  // Rule 2: Authenticated but visiting an auth page — redirect to dashboard
  // For regular users, honor ?callbackUrl=/<relative-path> if present.
  if (session && isAuthPage) {
    if (isAdmin) return NextResponse.redirect(new URL("/admin", url));
    if (isOperator) return NextResponse.redirect(new URL("/staff", url));
    const callbackUrl = url.searchParams.get("callbackUrl");
    if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
      return NextResponse.redirect(new URL(callbackUrl, url));
    }
    return NextResponse.redirect(new URL("/homepage", url));
  }

  // Rule 3: ADMIN must stay on /admin
  if (isAdmin && !pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/admin", url));
  }

  // Rule 4: OPERATOR must stay on /staff
  if (isOperator && !pathname.startsWith("/staff")) {
    return NextResponse.redirect(new URL("/staff", url));
  }

  // Rule 5: Regular user blocked from /admin and /staff
  if (session && !isAdmin && !isOperator) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
      return NextResponse.redirect(new URL("/homepage", url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|eot)).*)"],
};
