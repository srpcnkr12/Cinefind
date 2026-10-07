import Link from "next/link";
import { getReportQueue } from "@movieholix/api/admin";
import { createAdminServerClient } from "@/lib/supabase-server";

export default async function AdminReportsPage() {
  const supabase = await createAdminServerClient();
  const reports = await getReportQueue(supabase, "open");

  return (
    <div>
      <h1 className="mb-4 font-display text-2xl font-bold">Şikâyet kuyruğu</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-ink/60">
            <th className="py-2">Sebep</th>
            <th>Tür</th>
            <th>Bildiren</th>
            <th>Tarih</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-b border-ink/5">
              <td className="py-2">{r.reason}</td>
              <td>{r.targetType}</td>
              <td>{r.reporterDisplayName}</td>
              <td>{new Date(r.createdAt).toLocaleString("tr-TR")}</td>
              <td>
                <Link
                  href={`/admin/reports/${r.id}`}
                  className="font-semibold text-reel"
                >
                  İncele →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 ? (
        <p className="mt-4 text-ink/60">Açık şikâyet yok.</p>
      ) : null}
    </div>
  );
}
