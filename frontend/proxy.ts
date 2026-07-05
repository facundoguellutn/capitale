import { NextResponse, type NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/registro"];

// Chequeo optimista: solo verifica la cookie (sin tocar la DB).
// El control real lo hacen requireUser() en layouts, actions y handlers.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const session = await decrypt(request.cookies.get("session")?.value);

  if (!isPublic && !session?.userId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$).*)"],
};
