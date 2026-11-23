import { NextResponse, type NextRequest } from "next/server";
import { type Role, SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { clientIpFrom, floodCheck } from "@/lib/flood";

const AREAS: { prefix: string; role: Role }[] = [
  { prefix: "/customer", role: "CUSTOMER" },
  { prefix: "/supplier", role: "SUPPLIER" },
  { prefix: "/admin", role: "ADMIN" },
];

export async function middleware(request: NextRequest) {
  // בייצור רק https: בקשה שהגיעה ב-http (לפי השרת המתווך) עוברת לכתובת המאובטחת
  if (process.env.NODE_ENV === "production" && request.headers.get("x-forwarded-proto") === "http") {
    const secure = request.nextUrl.clone();
    secure.protocol = "https:";
    return NextResponse.redirect(secure, 308);
  }
  // הגבלה כללית לדקה לכל כתובת, נגד הצפה בבקשות (בנוסף למגבלות של כניסה, הרשמה ו-AI)
  const ip = clientIpFrom(request.headers) ?? "unknown";
  const flood = floodCheck(ip, request.method !== "GET" && request.method !== "HEAD");
  if (flood) {
    return new NextResponse("יותר מדי בקשות. נסו שוב בעוד דקה.", {
      status: 429,
      headers: { "Retry-After": String(flood), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const area = AREAS.find((a) => request.nextUrl.pathname.startsWith(a.prefix));
  if (!area) return NextResponse.next();
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session?.role === area.role) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // כל הבקשות חוץ מקבצים סטטיים של האתר
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
