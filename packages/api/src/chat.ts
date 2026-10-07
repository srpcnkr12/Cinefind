import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { trackEvent } from "@movieholix/core/domain/analytics";

export type MessageKind =
  "text" | "film_card" | "line_card" | "system" | "icebreaker";

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body: string | null;
  filmId: string | null;
  lineId: string | null;
  moderationFlag: boolean;
  createdAt: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  film_id: string | null;
  line_id: string | null;
  moderation_flag: boolean;
  created_at: string;
};

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    kind: row.kind,
    body: row.body,
    filmId: row.film_id,
    lineId: row.line_id,
    moderationFlag: row.moderation_flag,
    createdAt: row.created_at,
  };
}

export type ConversationSummary = {
  conversationId: string;
  matchId: string;
  otherUserId: string;
  otherDisplayName: string | null;
  lastMessage: ChatMessage | null;
};

type ConversationRow = {
  id: string;
  match_id: string | null;
  matches: { user_low: string; user_high: string } | null;
};

/** Kullanıcının aktif konuşmalarını, karşı tarafın adı ve son mesajla birlikte döner. */
export async function getConversations(
  db: SupabaseClient,
  myUserId: string,
): Promise<ConversationSummary[]> {
  const { data, error } = await db
    .from("conversations")
    .select("id, match_id, matches(user_low, user_high)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getConversations failed: ${error.message}`);

  const rows = (data ?? []) as unknown as ConversationRow[];
  const summaries: ConversationSummary[] = [];

  for (const row of rows) {
    if (!row.matches) continue;
    const otherUserId =
      row.matches.user_low === myUserId
        ? row.matches.user_high
        : row.matches.user_low;

    const [{ data: profile }, { data: lastMessageRow }] = await Promise.all([
      db
        .from("profiles")
        .select("display_name")
        .eq("id", otherUserId)
        .maybeSingle(),
      db
        .from("messages")
        .select(
          "id, conversation_id, sender_id, kind, body, film_id, line_id, moderation_flag, created_at",
        )
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    summaries.push({
      conversationId: row.id,
      matchId: row.match_id ?? "",
      otherUserId,
      otherDisplayName: profile?.display_name ?? null,
      lastMessage: lastMessageRow
        ? mapMessage(lastMessageRow as MessageRow)
        : null,
    });
  }

  return summaries;
}

export type PendingSuperMessage = {
  conversationId: string;
  senderId: string;
  senderDisplayName: string | null;
  body: string | null;
};

type PendingConversationRow = {
  id: string;
  conversation_members: { user_id: string }[];
};

/** Kabul/red bekleyen, bana gönderilmiş süper mesajlar (PRD 13.2). */
export async function getPendingSuperMessages(
  db: SupabaseClient,
  myUserId: string,
): Promise<PendingSuperMessage[]> {
  const { data, error } = await db
    .from("conversations")
    .select("id, conversation_members(user_id)")
    .eq("kind", "super_message")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error)
    throw new Error(`getPendingSuperMessages failed: ${error.message}`);

  const rows = (data ?? []) as unknown as PendingConversationRow[];
  const result: PendingSuperMessage[] = [];

  for (const row of rows) {
    const isMember = row.conversation_members.some(
      (m) => m.user_id === myUserId,
    );
    if (!isMember) continue;

    const { data: firstMessage } = await db
      .from("messages")
      .select("sender_id, body")
      .eq("conversation_id", row.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstMessage || firstMessage.sender_id === myUserId) continue;

    const { data: profile } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", firstMessage.sender_id)
      .maybeSingle();

    result.push({
      conversationId: row.id,
      senderId: firstMessage.sender_id,
      senderDisplayName: profile?.display_name ?? null,
      body: firstMessage.body,
    });
  }

  return result;
}

const MESSAGES_PAGE_SIZE = 30;

/** Sayfalanmış mesaj geçmişi — en yeniden eskiye, `cursor` bir sonraki sayfa için offset. */
export async function getMessages(
  db: SupabaseClient,
  conversationId: string,
  cursor = 0,
): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("messages")
    .select(
      "id, conversation_id, sender_id, kind, body, film_id, line_id, moderation_flag, created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(cursor, cursor + MESSAGES_PAGE_SIZE - 1);
  if (error) throw new Error(`getMessages failed: ${error.message}`);
  return ((data ?? []) as MessageRow[]).map(mapMessage);
}

export async function sendMessage(
  db: SupabaseClient,
  conversationId: string,
  kind: MessageKind,
  body?: string,
  filmId?: string,
  lineId?: string,
): Promise<ChatMessage> {
  const { data, error } = await db.rpc("send_message", {
    p_conversation_id: conversationId,
    p_kind: kind,
    p_body: body ?? null,
    p_film_id: filmId ?? null,
    p_line_id: lineId ?? null,
  });
  if (error) throw error;
  trackEvent("message_sent", { kind, isFirst: false });
  return mapMessage(data as MessageRow);
}

export async function markConversationRead(
  db: SupabaseClient,
  conversationId: string,
): Promise<void> {
  const { error } = await db.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(`markConversationRead failed: ${error.message}`);
}

export async function unmatch(
  db: SupabaseClient,
  matchId: string,
): Promise<void> {
  const { error } = await db.rpc("unmatch", { p_match_id: matchId });
  if (error) throw new Error(`unmatch failed: ${error.message}`);
}

export async function addSharedWatchlistItem(
  db: SupabaseClient,
  matchId: string,
  filmId: string,
): Promise<void> {
  const { error } = await db.rpc("add_shared_watchlist_item", {
    p_match_id: matchId,
    p_film_id: filmId,
  });
  if (error) throw new Error(`addSharedWatchlistItem failed: ${error.message}`);
  trackEvent("shared_watchlist_item_added", {});
}

export type SharedWatchlistItem = {
  id: string;
  filmId: string;
  addedBy: string;
};

export async function getSharedWatchlist(
  db: SupabaseClient,
  matchId: string,
): Promise<SharedWatchlistItem[]> {
  const { data, error } = await db
    .from("shared_watchlist_items")
    .select("id, film_id, added_by")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getSharedWatchlist failed: ${error.message}`);
  return (
    (data ?? []) as { id: string; film_id: string; added_by: string }[]
  ).map((row) => ({
    id: row.id,
    filmId: row.film_id,
    addedBy: row.added_by,
  }));
}

/** Realtime abonelik sarmalayıcısı — dönen kanalı `unsubscribe`/`removeChannel` ile kapatın. */
export function subscribeToMessages(
  db: SupabaseClient,
  conversationId: string,
  onInsert: (message: ChatMessage) => void,
): RealtimeChannel {
  return db
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onInsert(mapMessage(payload.new as MessageRow)),
    )
    .subscribe();
}
