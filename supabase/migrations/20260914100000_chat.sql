-- Faz 6: Sohbet (PRD bölüm 9.5, 9.6, 10.1, 10.2, 14.1, 19).
-- `conversations`/`conversation_members` Faz 5'te önden açılmıştı (ADR-0010).

-- ============================================================================
-- `conversation_members`in kendi üzerine self-referencing RLS politikası
-- (Faz 5) + `messages`in ona bakan politikası bir araya gelince Postgres
-- "infinite recursion detected in policy" hatası veriyor. SECURITY DEFINER bir
-- yardımcı fonksiyon RLS'i bu kontrol için by-pass ederek döngüyü kırar; hem
-- burada hem Faz 5'in politikalarını düzeltmek için kullanılıyor.
-- ============================================================================
create or replace function is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = p_user_id
  );
$$;

drop policy "conversation_members_participant_select" on conversation_members;
create policy "conversation_members_participant_select" on conversation_members for select using (
  is_conversation_member(conversation_id, auth.uid())
);

drop policy "conversations_member_select" on conversations;
create policy "conversations_member_select" on conversations for select using (
  is_conversation_member(id, auth.uid())
);

-- Faz 5'te yalnızca select politikası vardı; `mark_conversation_read` kendi
-- `last_read_message_id`/`muted_until`'ını güncelleyebilmeli.
create policy "conversation_members_self_update" on conversation_members for update using (
  auth.uid() = user_id
);

-- ============================================================================
-- messages
-- ============================================================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'film_card', 'line_card', 'system', 'icebreaker')),
  body text check (body is null or char_length(body) <= 2000),
  film_id uuid references films (id) on delete set null,
  line_id uuid references film_lines (id) on delete set null,
  payload jsonb not null default '{}',
  moderation_flag boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index messages_conversation_created_idx on messages (conversation_id, created_at desc);

alter table messages enable row level security;

create policy "messages_member_select" on messages for select using (
  is_conversation_member(conversation_id, auth.uid())
);

create policy "messages_member_insert" on messages for insert with check (
  sender_id = auth.uid() and is_conversation_member(conversation_id, auth.uid())
);

-- ============================================================================
-- shared_watchlist_items (PRD 9.5)
-- ============================================================================
create table shared_watchlist_items (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  film_id uuid not null references films (id) on delete cascade,
  added_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, film_id)
);

alter table shared_watchlist_items enable row level security;

create policy "shared_watchlist_items_member_all" on shared_watchlist_items for all using (
  exists (
    select 1 from matches m
    where m.id = shared_watchlist_items.match_id
      and (m.user_low = auth.uid() or m.user_high = auth.uid())
  )
);

-- ============================================================================
-- notifications (PRD 9.6) — bu fazda yalnızca `new_message`; Faz 7 kendi
-- tiplerini üzerine ekleyecek (bkz. docs/adr/0011-notifications-pulled-forward.md).
-- ============================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null check (type in ('new_message')),
  actor_id uuid references profiles (id) on delete set null,
  entity jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_read_created_idx on notifications (user_id, read_at, created_at desc);

alter table notifications enable row level security;
create policy "notifications_owner_select" on notifications for select using (auth.uid() = user_id);
create policy "notifications_owner_update" on notifications for update using (auth.uid() = user_id);
-- Yazma yalnızca `send_message` RPC'si (security invoker, auth.uid() = actor_id garantili) içinden.
create policy "notifications_actor_insert" on notifications for insert with check (auth.uid() = actor_id);

-- ============================================================================
-- Realtime: mesajlar anlık iletilsin.
-- ============================================================================
alter publication supabase_realtime add table messages;

-- ============================================================================
-- Dolandırıcılık kalıp kontrolü (PRD 14.1) — basit/temsili regex; tam kapsamlı
-- tespit Faz 9'un moderasyon işi.
-- ============================================================================
create or replace function contains_scam_signal(p_body text)
returns boolean
language sql
immutable
as $$
  select p_body is not null and (
    p_body ~* 'https?://|www\.'
    or p_body ~* '(\+?90|0)?\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}'
    or p_body ~* 'TR\d{2}[\s]?(\d{4}[\s]?){5}\d{2}'
    or p_body ~* '0x[a-fA-F0-9]{20,}|\b(bitcoin|btc|kripto|cüzdan adresi|wallet)\b'
    or p_body ~* '(whatsapp|telegram|instagram)(''?[dt][ae]n)? (yaz|devam|konuş)|başka (bir )?uygulama(ya)? geç'
  );
$$;

-- ============================================================================
-- RPC'ler
-- ============================================================================
create or replace function send_message(
  p_conversation_id uuid,
  p_kind text default 'text',
  p_body text default null,
  p_film_id uuid default null,
  p_line_id uuid default null
)
returns messages
language plpgsql
security invoker
as $$
declare
  v_me uuid := auth.uid();
  v_message_count int;
  v_flag boolean := false;
  v_other_id uuid;
  v_row messages;
begin
  if not exists (
    select 1 from conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = v_me
  ) then
    raise exception 'not_a_member';
  end if;

  select count(*) into v_message_count from messages where conversation_id = p_conversation_id;
  if v_message_count < 5 then
    v_flag := contains_scam_signal(p_body);
  end if;

  insert into messages (conversation_id, sender_id, kind, body, film_id, line_id, moderation_flag)
  values (p_conversation_id, v_me, p_kind, p_body, p_film_id, p_line_id, v_flag)
  returning * into v_row;

  select cm.user_id into v_other_id
  from conversation_members cm
  where cm.conversation_id = p_conversation_id and cm.user_id != v_me
  limit 1;

  if v_other_id is not null then
    insert into notifications (user_id, type, actor_id, entity)
    values (v_other_id, 'new_message', v_me, jsonb_build_object('conversationId', p_conversation_id, 'messageId', v_row.id));
  end if;

  return v_row;
end;
$$;

grant execute on function send_message(uuid, text, text, uuid, uuid) to authenticated;

create or replace function mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_last_id uuid;
begin
  select id into v_last_id from messages
  where conversation_id = p_conversation_id
  order by created_at desc
  limit 1;

  update conversation_members
  set last_read_message_id = v_last_id
  where conversation_id = p_conversation_id and user_id = auth.uid();
end;
$$;

grant execute on function mark_conversation_read(uuid) to authenticated;

-- PRD 10.1: "Konuşmayı kapatır" — her iki üye için de.
create or replace function unmatch(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  update matches set unmatched_at = now(), unmatched_by = v_me
  where id = p_match_id
    and (user_low = v_me or user_high = v_me)
    and unmatched_at is null;

  if not found then
    raise exception 'not_a_match_member';
  end if;

  update conversations set status = 'closed' where match_id = p_match_id;
end;
$$;

grant execute on function unmatch(uuid) to authenticated;

create or replace function add_shared_watchlist_item(p_match_id uuid, p_film_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from matches m
    where m.id = p_match_id and (m.user_low = auth.uid() or m.user_high = auth.uid())
  ) then
    raise exception 'not_a_match_member';
  end if;

  insert into shared_watchlist_items (match_id, film_id, added_by)
  values (p_match_id, p_film_id, auth.uid())
  on conflict (match_id, film_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function add_shared_watchlist_item(uuid, uuid) to authenticated;
