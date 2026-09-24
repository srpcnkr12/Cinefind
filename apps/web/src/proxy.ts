// Next.js 16'da "middleware.ts" kaldırılıp "proxy.ts" ile değiştirildi (bkz. Next.js
// sürüm notları v16.0.0, bu oturumda doğrulandı). Fonksiyon çoğunlukla next-intl'in
// üretimi; `/admin` altında (Faz 9) ek olarak Supabase oturumu yenileniyor.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";

const intlProxy = createMiddleware(routing);

/**
 * Admin panel `[locale]` dışında, düz `/admin` altında yaşıyor (ADR-0015 —
 * i18n yok). Bu yollarda next-intl'in locale yönlendirmesi yerine Supabase
 * oturum yenilemesi çalışır (bkz. `@supabase/ssr`'ın Server Component'lerin
 * çerez yazamaması yüzünden önerdiği proxy deseni, bu oturumda doğrulandı).
 */
async function refreshAdminSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return refreshAdminSession(request);
  }
  return intlProxy(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
