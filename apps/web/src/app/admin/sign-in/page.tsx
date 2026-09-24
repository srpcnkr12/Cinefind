import { redirect } from "next/navigation";
import { createAdminServerClient } from "@/lib/supabase-server";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const supabase = await createAdminServerClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/admin/auth/callback` },
  });
  redirect("/admin/sign-in?sent=1");
}

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-6 py-24 font-body">
      <h1 className="mb-6 font-display text-2xl font-bold text-ink">
        Admin girişi
      </h1>
      {sent ? (
        <p className="text-sm text-ink">
          E-postana bir giriş bağlantısı gönderdik.
        </p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="e-posta"
            className="rounded-md border border-ink/20 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-reel px-3 py-2 text-sm font-semibold text-white"
          >
            Giriş bağlantısı gönder
          </button>
        </form>
      )}
    </main>
  );
}
