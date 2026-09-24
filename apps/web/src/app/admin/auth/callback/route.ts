import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminServerClient } from "@/lib/supabase-server";

/** Magic link sign-in'in PKCE `code` parametresini oturuma çevirir. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createAdminServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/admin/reports", request.url));
}
