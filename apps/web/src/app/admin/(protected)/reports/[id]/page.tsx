import { redirect } from "next/navigation";
import {
  getReport,
  resolveReport,
  moderateUser,
  removeContent,
} from "@movieholix/api/admin";
import { createAdminServerClient } from "@/lib/supabase-server";

type Props = { params: Promise<{ id: string }> };

/** 3 tıklama: kuyruk → detay (bu sayfa) → çöz/reddet düğmesi. */
export default async function AdminReportDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createAdminServerClient();
  const report = await getReport(supabase, id);

  async function handleResolve(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    const action = String(formData.get("action"));
    const resolution = String(formData.get("resolution") ?? "");

    if (action === "remove_content" && report.targetType !== "user") {
      await removeContent(
        supabase,
        report.targetType as "photo" | "post" | "comment" | "line",
        report.targetId,
      );
    }
    if (action === "warn" || action === "suspend" || action === "ban") {
      const targetUserId =
        report.targetType === "user" ? report.targetId : report.reporterId;
      await moderateUser(supabase, targetUserId, action, resolution);
    }

    await resolveReport(supabase, id, resolution, action === "dismiss");
    redirect("/admin/reports");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-bold">Şikâyet detayı</h1>
      <dl className="mb-6 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-ink/60">Sebep</dt>
        <dd>{report.reason}</dd>
        <dt className="text-ink/60">Hedef türü</dt>
        <dd>{report.targetType}</dd>
        <dt className="text-ink/60">Hedef id</dt>
        <dd className="font-mono text-xs">{report.targetId}</dd>
        <dt className="text-ink/60">Bildiren</dt>
        <dd>{report.reporterDisplayName}</dd>
        <dt className="text-ink/60">Detaylar</dt>
        <dd>{report.details ?? "—"}</dd>
      </dl>

      {report.contextSnapshot ? (
        <div className="mb-6">
          <h2 className="mb-2 font-semibold">Mesaj bağlamı (son 20)</h2>
          <div className="max-h-64 overflow-y-auto rounded-md border border-ink/10 p-3 text-xs">
            {report.contextSnapshot.map((m, i) => (
              <p key={i} className="mb-1">
                {String(m.body ?? "")}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <form action={handleResolve} className="flex flex-col gap-3">
        <textarea
          name="resolution"
          placeholder="Karar notu"
          required
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            name="action"
            value="dismiss"
            className="rounded-md bg-surface-1-light px-3 py-2 text-sm"
          >
            Reddet (asılsız)
          </button>
          <button
            name="action"
            value="warn"
            className="rounded-md bg-popcorn px-3 py-2 text-sm"
          >
            Uyar
          </button>
          <button
            name="action"
            value="remove_content"
            className="rounded-md bg-popcorn px-3 py-2 text-sm"
          >
            İçeriği kaldır
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
        </div>
      </form>
    </div>
  );
}
