import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // --- Dashboard routes: require session + validate user has a tenant ---
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify user exists in users table with a tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!userData || (!userData.tenant_id && userData.role !== "superadmin")) {
      // User is authenticated but has no tenant — redirect to login
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "no_tenant");
      return NextResponse.redirect(loginUrl);
    }
  }

  // --- Admin routes: require session + superadmin role ---
  if (pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/admin", req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Verify superadmin role
    const { data: adminData } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (adminData?.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // --- API routes: require auth (session, bearer token, or cron secret) ---
  if (pathname.startsWith("/api/")) {
    const authHeader = req.headers.get("authorization");
    const hasBearerToken = authHeader?.startsWith("Bearer ");
    const cronSecret = req.headers.get("x-cron-secret");
    const hasCronSecret = !!cronSecret && cronSecret === process.env.CRON_SECRET;

    if (!session && !hasBearerToken && !hasCronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/:path*",
  ],
};
