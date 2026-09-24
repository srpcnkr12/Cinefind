import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * PRD 10.2 `account-deletion`: günlük cron (bkz. Faz 1'in `tmdb-sync` deseni —
 * Vault secret'ları yalnızca staging/production'da tanımlı; yerelde doğrudan
 * HTTP çağrısıyla test edilir). `request_account_deletion()` RPC'si zaten
 * anında yerel anonimleştirme yapmıştı (bkz. Faz 9 migration); bu fonksiyon
 * yalnızca 30 günü dolmuş hesapları `auth.admin.deleteUser()` ile kalıcı siler
 * — FK `on delete cascade` tüm ilişkili satırları temizler.
 */
export default {
  fetch: withSupabase({ auth: "secret" }, async (_req, ctx) => {
    const cutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: dueForDeletion, error } = await ctx.supabaseAdmin
      .from("profiles")
      .select("id")
      .not("deletion_requested_at", "is", null)
      .lt("deletion_requested_at", cutoff);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    let deleted = 0;
    const failures: { id: string; message: string }[] = [];

    for (const row of dueForDeletion ?? []) {
      const { error: deleteError } =
        await ctx.supabaseAdmin.auth.admin.deleteUser(row.id);
      if (deleteError) {
        failures.push({ id: row.id, message: deleteError.message });
      } else {
        deleted += 1;
      }
    }

    return Response.json({ deleted, failures });
  }),
};
