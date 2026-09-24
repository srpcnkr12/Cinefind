import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase-server";

/**
 * PRD 14.1 "Admin paneli (rol korumalı)". Metinler bilinçli olarak sabit
 * Türkçe (bkz. docs/adr/0015-admin-panel-no-i18n.md) — bu panel yalnızca
 * ekip içi kullanılıyor, son kullanıcıya hiç görünmüyor.
 *
 * `(protected)` route group'u yalnızca oturum açmış + moderatör/admin
 * rolündeki kullanıcıları geçirir; `/admin/sign-in` bu grubun dışında,
 * yoksa yönlendirme döngüsü oluşurdu.
 *
 * Yetkilendirme `getSession()` değil `getClaims()` ile yapılır (bkz.
 * supabase.com/docs/guides/auth/server-side/nextjs, bu oturumda doğrulandı) —
 * `getSession()` çerezdeki JWT'yi doğrulamadan güvenir, `getClaims()` gerçekten
 * doğrular.
 *
 * Rol kontrolü `is_moderator_or_admin` RPC'si yerine `admin_roles` tablosunu
 * doğrudan okuyarak yapılır (owner-select RLS'i zaten kendi satırını görmeye
 * izin veriyor) — Faz 10 güvenlik taramasında bu RPC'nin `authenticated`'e
 * örtük EXECUTE'unun herhangi bir kullanıcının BAŞKA birinin admin durumunu
 * sorgulamasına izin verdiği bulundu; RPC artık yalnızca iç (SECURITY
 * DEFINER) çağrılar için erişilebilir (bkz. Faz 10 migration'ı).
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createAdminServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    redirect("/admin/sign-in");
  }

  const { data: roles } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId);
  const isModOrAdmin = (roles ?? []).some(
    (r) => r.role === "moderator" || r.role === "admin",
  );

  if (!isModOrAdmin) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center font-body">
        <h1 className="mb-2 font-display text-2xl font-bold">Yetkisiz</h1>
        <p>Bu hesabın admin paneline erişimi yok.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-screen font-body text-ink">
      <nav className="flex gap-4 border-b border-ink/10 px-6 py-4">
        <Link href="/admin/reports" className="font-body-semibold text-sm">
          Şikâyetler
        </Link>
        <Link href="/admin/config" className="font-body-semibold text-sm">
          Yapılandırma
        </Link>
        <Link href="/admin/testimonials" className="font-body-semibold text-sm">
          Testimoniallar
        </Link>
        <Link href="/admin/collections" className="font-body-semibold text-sm">
          Koleksiyonlar
        </Link>
      </nav>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
