import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createModerationProvider } from "../_shared/moderation/mock-provider.ts";

/**
 * İstemci, Storage'a yükleme bittikten hemen sonra bu fonksiyonu çağırır
 * (bkz. Faz 3 planı — gerçek bir Storage webhook yerine, yerel geliştirmede test
 * edilebilir olması için istemci tarafından tetiklenen bir çağrı tercih edildi).
 * `ctx.supabase` (RLS'e tabi) ile fotoğrafın çağıran kullanıcıya ait olduğu
 * doğrulanır; yazma `ctx.supabaseAdmin` ile yapılır (RLS moderation_status'ü
 * istemciye açmıyor).
 */
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { photoId } = (await req.json()) as { photoId?: string };
    if (!photoId) {
      return Response.json({ message: "photoId gerekli" }, { status: 400 });
    }

    const { data: photo, error: photoError } = await ctx.supabase
      .from("profile_photos")
      .select("id, storage_path, user_id")
      .eq("id", photoId)
      .maybeSingle();

    if (photoError || !photo) {
      return Response.json({ message: "Fotoğraf bulunamadı" }, { status: 404 });
    }

    const { data: signed, error: signError } = await ctx.supabaseAdmin.storage
      .from("profile-photos")
      .createSignedUrl(photo.storage_path, 60);

    if (signError || !signed) {
      return Response.json(
        { message: "İmzalı URL üretilemedi" },
        { status: 500 },
      );
    }

    const provider = createModerationProvider();
    const result = await provider.moderateImage(signed.signedUrl);

    const { error: updateError } = await ctx.supabaseAdmin
      .from("profile_photos")
      .update({
        moderation_status: result.status,
        moderation_labels: result.labels ?? {},
      })
      .eq("id", photoId);

    if (updateError) {
      return Response.json({ message: updateError.message }, { status: 500 });
    }

    return Response.json({ status: result.status });
  }),
};

/* Yerelde çağırmak için:

  curl -i --request POST 'http://127.0.0.1:55321/functions/v1/on-photo-upload' \
    --header 'Authorization: Bearer <kullanıcı access_token>' \
    --header 'Content-Type: application/json' \
    --data '{"photoId":"<uuid>"}'

*/
