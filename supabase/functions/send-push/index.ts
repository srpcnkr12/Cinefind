import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * İstemci, `send_message` RPC'si başarılı olduktan hemen sonra bu fonksiyonu
 * çağırır (bkz. Faz 6 planı gerekçe #2 — DB tetikleyicisi/`pg_net` yerine
 * istemci tetikli, gizli anahtarı SQL'e gömmemek için).
 *
 * NOT: Expo Go'da uzak push desteklenmiyor ve bu projede henüz bir EAS
 * `projectId` yok; bu fonksiyon doğru yazıldı ama gerçek bir cihaza push
 * düşmesi bu ortamda test edilemedi (bkz. Faz 6 raporu).
 */
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { conversationId, messageId } = (await req.json()) as {
      conversationId?: string;
      messageId?: string;
    };
    if (!conversationId || !messageId) {
      return Response.json(
        { message: "conversationId ve messageId gerekli" },
        { status: 400 },
      );
    }

    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    if (!user) {
      return Response.json({ message: "Yetkisiz" }, { status: 401 });
    }

    // RLS'e tabi istemciyle üyelik doğrulanır: üye değilsem 0 satır döner.
    const { data: members } = await ctx.supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);
    const otherMember = (members ?? []).find((m) => m.user_id !== user.id);
    if (!otherMember) {
      return Response.json(
        { message: "Konuşma üyesi değil veya karşı taraf yok" },
        { status: 403 },
      );
    }

    const { data: message } = await ctx.supabase
      .from("messages")
      .select("body, kind")
      .eq("id", messageId)
      .maybeSingle();

    const { data: senderProfile } = await ctx.supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: tokens } = await ctx.supabaseAdmin
      .from("device_tokens")
      .select("token")
      .eq("user_id", otherMember.user_id);

    if (!tokens || tokens.length === 0) {
      return Response.json({ sent: 0, reason: "no_device_tokens" });
    }

    const title = senderProfile?.display_name ?? "Movieholix";
    const body =
      message?.kind === "text" ? (message.body ?? "Yeni mesaj") : "Yeni mesaj";

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        tokens.map((t) => ({
          to: t.token,
          title,
          body,
          data: { conversationId },
        })),
      ),
    });

    const result = await response.json();
    return Response.json({ sent: tokens.length, expo: result });
  }),
};
