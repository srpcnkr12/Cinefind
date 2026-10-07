import { redirect } from "next/navigation";
import { listAppConfig, setAppConfig } from "@movieholix/api/admin";
import { createAdminServerClient } from "@/lib/supabase-server";

export default async function AdminConfigPage() {
  const supabase = await createAdminServerClient();
  const entries = await listAppConfig(supabase);

  async function handleSave(formData: FormData) {
    "use server";
    const supabase = await createAdminServerClient();
    const key = String(formData.get("key"));
    const rawValue = String(formData.get("value"));
    let value: unknown;
    try {
      value = JSON.parse(rawValue);
    } catch {
      value = rawValue;
    }
    await setAppConfig(supabase, key, value);
    redirect("/admin/config");
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 font-display text-2xl font-bold">app_config</h1>
      <table className="mb-8 w-full text-left text-sm">
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.key} className="border-b border-ink/5">
              <td className="py-2 font-mono text-xs">{entry.key}</td>
              <td className="font-mono text-xs">
                {JSON.stringify(entry.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 font-semibold">Değer güncelle</h2>
      <form action={handleSave} className="flex flex-col gap-3">
        <input
          name="key"
          placeholder="anahtar"
          required
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <input
          name="value"
          placeholder='değer (JSON, ör. 25 veya "metin")'
          required
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-reel px-3 py-2 text-sm font-semibold text-white"
        >
          Kaydet
        </button>
      </form>
    </div>
  );
}
