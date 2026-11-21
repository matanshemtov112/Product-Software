import { NextResponse, type NextRequest } from "next/server";
import { type Role, SESSION_COOKIE, verifySession } from "@/lib/auth/session";

const AREAS: { prefix: string; role: Role }[] = [
  { prefix: "/customer", role: "CUSTOMER" },
  { prefix: "/supplier", role: "SUPPLIER" },
  { prefix: "/admin", role: "ADMIN" },
];

export async function middleware(request: NextRequest) {
  const area = AREAS.find((a) => request.nextUrl.pathname.startsWith(a.prefix));
  if (!area) return NextResponse.next();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session?.role === area.role) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/customer/:path*", "/supplier/:path*", "/admin/:path*"],
};
