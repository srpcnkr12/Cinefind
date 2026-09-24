import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * PRD 10.2 `data-export`: `request_data_export()` RPC'si bir kuyruk satırı
 * oluşturduktan hemen sonra istemci bu fonksiyonu çağırır (Faz 6'nın
 * `send-push`/Faz 3'ün `on-photo-upload` "istemci tetikli" deseniyle aynı —
 * gizli anahtar SQL'e/trigger'a gömülmez).
 *
 * NOT (bkz. ADR-0016): Gerçek bir e-posta sağlayıcısı bu ortamda kurulu değil
 * (`RESEND_API_KEY` hiç kullanılmadı) — dosya e-postayla değil, uygulama içi
 * imzalı bağlantıyla teslim edilir. Ayrıca gerçek bir ZIP kütüphanesi yerine
 * (Deno'da resmi/stabil bir zip kütüphanesi doğrulanabilir değildi) tüm veri
 * tek bir `export.json` + fotoğraflar ayrı dosyalar olarak aynı klasöre
 * yüklenir — "kullanıcının tüm verisini içeriyor" kabul kriterini karşılar,
 * yalnızca sıkıştırma/tek-dosya biçimi basitleştirilmiştir.
 */
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { requestId } = (await req.json()) as { requestId?: string };
    if (!requestId) {
      return Response.json({ message: "requestId gerekli" }, { status: 400 });
    }

    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    if (!user) {
      return Response.json({ message: "Yetkisiz" }, { status: 401 });
    }

    const { data: exportRequest } = await ctx.supabase
      .from("data_export_requests")
      .select("id, user_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!exportRequest || exportRequest.user_id !== user.id) {
      return Response.json({ message: "İstek bulunamadı" }, { status: 404 });
    }

    await ctx.supabaseAdmin
      .from("data_export_requests")
      .update({ status: "processing" })
      .eq("id", requestId);

    const admin = ctx.supabaseAdmin;
    const uid = user.id;

    const [
      profile,
      userFilms,
      diaryEntries,
      filmLines,
      posts,
      comments,
      messages,
      matches,
      consents,
      photos,
    ] = await Promise.all([
      admin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      admin.from("user_films").select("*").eq("user_id", uid),
      admin.from("diary_entries").select("*").eq("user_id", uid),
      admin.from("film_lines").select("*").eq("user_id", uid),
      admin.from("posts").select("*").eq("author_id", uid),
      admin.from("comments").select("*").eq("author_id", uid),
      admin.from("messages").select("*").eq("sender_id", uid),
      admin
        .from("matches")
        .select("*")
        .or(`user_low.eq.${uid},user_high.eq.${uid}`),
      admin.from("consents").select("*").eq("user_id", uid),
      admin.from("profile_photos").select("*").eq("user_id", uid),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      user_films: userFilms.data ?? [],
      diary_entries: diaryEntries.data ?? [],
      film_lines: filmLines.data ?? [],
      posts: posts.data ?? [],
      comments: comments.data ?? [],
      messages_sent: messages.data ?? [],
      matches: matches.data ?? [],
      consents: consents.data ?? [],
    };

    const basePath = `${uid}/${requestId}`;
    const uploads: Promise<unknown>[] = [
      admin.storage.from("data-exports").upload(
        `${basePath}/export.json`,
        new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        }),
        {
          upsert: true,
        },
      ),
    ];

    for (const photo of photos.data ?? []) {
      uploads.push(
        (async () => {
          const { data: file } = await admin.storage
            .from("profile-photos")
            .download(photo.storage_path);
          if (file) {
            const fileName = photo.storage_path.split("/").pop();
            await admin.storage
              .from("data-exports")
              .upload(`${basePath}/photos/${fileName}`, file, { upsert: true });
          }
        })(),
      );
    }

    await Promise.all(uploads);

    const { data: signed, error: signError } = await admin.storage
      .from("data-exports")
      .createSignedUrl(`${basePath}/export.json`, 60 * 60 * 24 * 7);

    if (signError || !signed) {
      await admin
        .from("data_export_requests")
        .update({ status: "failed" })
        .eq("id", requestId);
      return Response.json(
        { message: "İmzalı URL üretilemedi" },
        { status: 500 },
      );
    }

    await admin
      .from("data_export_requests")
      .update({
        status: "done",
        storage_path: `${basePath}/export.json`,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return Response.json({ status: "done", downloadUrl: signed.signedUrl });
  }),
};
