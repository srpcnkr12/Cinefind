import { redirect } from "next/navigation";
import { getUser360, moderateUser } from "@movieholix/api/admin";
import { createAdminServerClient } from "@/lib/supabase-server";

type Props = { params: Promise<{ id: string }> };

export default async function AdminUser360Page({ params }: Props) {
  const { id } = await params;
  const supabase = await createAdminServerClient();
  const user360 = await getUser360(supabase, id);
  const profile = user360.profile as Record<string, unknown>;

  async function handleModerate(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    const action = String(formData.get("action")) as
      "warn" | "suspend" | "ban" | "unban";
    const reason = String(formData.get("reason") ?? "");
    await moderateUser(supabase, id, action, reason);
    redirect(`/admin/users/${id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-bold">Kullanıcı 360°</h1>
      <dl className="mb-6 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-ink/60">Ad</dt>
        <dd>{String(profile.display_name ?? "—")}</dd>
        <dt className="text-ink/60">Kullanıcı adı</dt>
        <dd>{String(profile.username ?? "—")}</dd>
        <dt className="text-ink/60">Kayıt tarihi</dt>
        <dd>
          {profile.created_at
            ? new Date(String(profile.created_at)).toLocaleDateString("tr-TR")
            : "—"}
        </dd>
        <dt className="text-ink/60">Banlı mı</dt>
        <dd>{profile.banned_at ? "Evet" : "Hayır"}</dd>
        <dt className="text-ink/60">Askıya alınma</dt>
        <dd>
          {profile.suspended_until ? String(profile.suspended_until) : "—"}
        </dd>
        <dt className="text-ink/60">Hakkındaki şikâyet sayısı</dt>
        <dd>{user360.reportsAgainst}</dd>
        <dt className="text-ink/60">Yaptığı şikâyet sayısı</dt>
        <dd>{user360.reportsBy}</dd>
        <dt className="text-ink/60">Eşleşme sayısı</dt>
        <dd>{user360.matchCount}</dd>
        <dt className="text-ink/60">Gönderi sayısı</dt>
        <dd>{user360.postCount}</dd>
      </dl>

      <h2 className="mb-2 font-semibold">Moderasyon geçmişi</h2>
      <ul className="mb-6 text-sm">
        {user360.moderationHistory.length === 0 ? (
          <li className="text-ink/60">Yok.</li>
        ) : (
          user360.moderationHistory.map((action, i) => (
            <li key={i}>
              {String(action.action)} — {String(action.reason ?? "")} (
              {String(action.created_at)})
            </li>
          ))
        )}
      </ul>

      <form action={handleModerate} className="flex flex-col gap-3">
        <textarea
          name="reason"
          placeholder="Gerekçe"
          required
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            name="action"
            value="warn"
            className="rounded-md bg-popcorn px-3 py-2 text-sm"
          >
            Uyar
          </button>
          <button
            name="action"
            value="suspend"
            className="rounded-md bg-danger px-3 py-2 text-sm text-white"
          >
            Askıya al
          </button>
          <button
            name="action"
            value="ban"
            className="rounded-md bg-danger px-3 py-2 text-sm text-white"
          >
            Banla
          </button>
          <button
            name="action"
            value="unban"
            className="rounded-md bg-success px-3 py-2 text-sm text-white"
          >
            Yasağı kaldır
          </button>
        </div>
      </form>
    </div>
  );
}
