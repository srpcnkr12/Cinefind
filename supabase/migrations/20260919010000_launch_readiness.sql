-- Faz 10: Lansman hazırlığı (PRD bölüm 9.7, 14.1, 19) — eksik indeksler + Faz 10
-- güvenlik taramasında bulunan iki gerçek örtük-yetki sızıntısının kapatılması.

-- ============================================================================
-- PRD 9.7'nin istediği, hiç oluşturulmamış iki indeks.
-- ============================================================================
create index user_films_film_watched_idx on user_films (film_id) where status = 'watched';

-- get_discovery_deck() her çağrıda st_dwithin/st_distance ile bu tabloyu tarıyor;
-- GiST indeksi olmadan tam tablo taraması yapıyordu.
create index profile_locations_geog_gist_idx on profile_locations using gist (geog);

-- ============================================================================
-- Güvenlik: is_premium/is_restricted/is_admin/is_moderator_or_admin'in
-- `anon`/`authenticated`'e örtük EXECUTE'u, herhangi bir kimlik doğrulanmış
-- istemcinin BAŞKA bir kullanıcının uuid'siyle çağırıp onun premium/kısıtlı/
-- admin durumunu sorgulamasına izin veriyordu (küçük ama gerçek bilgi
-- sızıntısı). Bunları doğrudan revoke etmeden önce, meşru doğrudan-istemci
-- çağıranları (kendi durumlarını SECURITY INVOKER bağlamında kontrol eden
-- send_message/create_post ve web admin layout'u) bu fonksiyonlara ihtiyaç
-- duymayacak şekilde yeniden düzenliyoruz — böylece revoke hiçbir meşru
-- kullanımı kırmıyor.
--
-- `is_premium(uuid)`'ı çağıran tek yer (undo_last_swipe/get_likes_received/
-- swipe/get_weekly_stats) zaten SECURITY DEFINER — iç çağrı fonksiyon sahibi
-- olarak çalışır, grant'a ihtiyaç duymaz. Doğrudan istemci çağıranı hiç yok
-- (grep ile doğrulandı) — düz revoke güvenli.
-- ============================================================================
revoke execute on function is_premium(uuid) from public, anon, authenticated;

-- send_message/create_post SECURITY INVOKER olduğu için `is_restricted(v_me)`
-- çağrısı `authenticated` rolü altında çalışıyordu — bu yüzden bu fonksiyonun
-- kendi kısıtlılık kontrolünü artık paylaşılan yardımcıyı ÇAĞIRMADAN, doğrudan
-- kendi `profiles` satırını okuyarak yapması sağlanıyor (zaten owner-select
-- RLS'i bunu izin veriyor). `is_restricted(uuid)` yalnızca `get_following_feed`/
-- `get_discover_feed` (SECURITY DEFINER, başka yazarların durumunu kontrol
-- ediyor) tarafından iç çağrıyla kullanılmaya devam ediyor — onlar için grant
-- gerekmiyor, o yüzden revoke güvenli.
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
  v_is_new_account boolean;
  v_limit int;
begin
  if exists (
    select 1 from profiles p where p.id = v_me
      and (p.banned_at is not null or p.deletion_requested_at is not null
        or (p.suspended_until is not null and p.suspended_until > now()))
  ) then
    raise exception 'account_restricted';
  end if;

  if not exists (
    select 1 from conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = v_me
  ) then
    raise exception 'not_a_member';
  end if;

  if exists (select 1 from conversations c where c.id = p_conversation_id and c.status = 'pending') then
    raise exception 'conversation_pending';
  end if;

  select (pr.created_at > now() - interval '24 hours') into v_is_new_account from profiles pr where pr.id = v_me;
  select (value #>> '{}')::int into v_limit
    from app_config where key = (case when v_is_new_account then 'new_account_messages_per_min' else 'rate_limit_messages_per_min' end);
  perform check_rate_limit('send_message', coalesce(v_limit, 20), 60);

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

create or replace function create_post(
  p_type text,
  p_body text default null,
  p_film_id uuid default null,
  p_line_id uuid default null,
  p_list_id uuid default null,
  p_rating numeric default null,
  p_contains_spoiler boolean default false,
  p_visibility text default 'public',
  p_repost_of_id uuid default null,
  p_quote_of_id uuid default null
)
returns posts
language plpgsql
security invoker
as $$
declare
  v_row posts;
  v_me uuid := auth.uid();
  v_is_new_account boolean;
  v_limit int;
begin
  if exists (
    select 1 from profiles p where p.id = v_me
      and (p.banned_at is not null or p.deletion_requested_at is not null
        or (p.suspended_until is not null and p.suspended_until > now()))
  ) then
    raise exception 'account_restricted';
  end if;

  select (pr.created_at > now() - interval '24 hours') into v_is_new_account from profiles pr where pr.id = v_me;
  select (value #>> '{}')::int into v_limit
    from app_config where key = (case when v_is_new_account then 'new_account_posts_per_hour' else 'rate_limit_posts_per_hour' end);
  perform check_rate_limit('create_post', coalesce(v_limit, 10), 3600);

  insert into posts (
    author_id, type, body, film_id, line_id, list_id, rating, contains_spoiler,
    visibility, repost_of_id, quote_of_id, moderation_status
  )
  values (
    v_me, p_type, p_body, p_film_id, p_line_id, p_list_id, p_rating, p_contains_spoiler,
    p_visibility, p_repost_of_id, p_quote_of_id, text_moderation_status(p_body)
  )
  returning * into v_row;

  perform process_mentions('post', v_row.id, p_body, v_me);
  return v_row;
end;
$$;

grant execute on function create_post(text, text, uuid, uuid, uuid, numeric, boolean, text, uuid, uuid) to authenticated;

revoke execute on function is_restricted(uuid) from public, anon, authenticated;

-- is_admin/is_moderator_or_admin'in tek doğrudan-istemci çağıranı web admin
-- panelinin layout'uydu, kendi durumunu kontrol etmek için — bu artık
-- `admin_roles` tablosunu doğrudan (owner-select RLS'i zaten izin veriyor)
-- okuyarak yapılıyor (bkz. apps/web/src/app/admin/(protected)/layout.tsx),
-- RPC'ye hiç ihtiyaç kalmadı. Kalan tüm çağıranlar (admin_* fonksiyonları)
-- SECURITY DEFINER, revoke onları etkilemez.
revoke execute on function is_admin(uuid) from public, anon, authenticated;
revoke execute on function is_moderator_or_admin(uuid) from public, anon, authenticated;

-- ============================================================================
-- Güvenlik: process_mentions — Faz 10 taramasında bulunan gerçek bir bildirim
-- sahteciliği açığı. Fonksiyon SECURITY DEFINER'dı, hiç revoke edilmemişti
-- (örtük anon/authenticated EXECUTE'a güveniyordu) VE gövdesi `p_author_id`
-- parametresine `auth.uid()` ile karşılaştırmadan güveniyordu — herhangi bir
-- kimlik doğrulanmış istemci, RLS'in `notifications_actor_insert` politikasını
-- (`actor_id = auth.uid()`) bu SECURITY DEFINER fonksiyon üzerinden atlayıp
-- `actor_id` alanını sahtekarlıkla başka bir kullanıcının id'sine ayarlayarak
-- keyfi bir bildirim satırı ekleyebilirdi. Gerçek çağıranlar (`create_post`,
-- `add_comment`) zaten kendi `auth.uid()`'ini geçiyor — bu düzeltme onları
-- etkilemez.
-- ============================================================================
create or replace function process_mentions(p_source_type text, p_source_id uuid, p_body text, p_author_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_mentioned_id uuid;
begin
  if p_author_id != auth.uid() then
    raise exception 'unauthorized';
  end if;

  if p_body is null then
    return;
  end if;

  for v_username in select (regexp_matches(p_body, '@([a-z0-9_]{2,30})', 'g'))[1] loop
    select id into v_mentioned_id from profiles where username = v_username;
    if v_mentioned_id is not null and v_mentioned_id != p_author_id
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = v_mentioned_id and b.blocked_id = p_author_id)
           or (b.blocker_id = p_author_id and b.blocked_id = v_mentioned_id)
      )
    then
      insert into mentions (source_type, source_id, mentioned_user_id) values (p_source_type, p_source_id, v_mentioned_id)
        on conflict do nothing;
      insert into notifications (user_id, type, actor_id, entity)
        values (v_mentioned_id, 'mention', p_author_id, jsonb_build_object('sourceType', p_source_type, 'sourceId', p_source_id));
    end if;
  end loop;
end;
$$;

-- NOT: `public`'ten (dolayısıyla `anon`'dan) revoke ediliyor, ama `authenticated`'e
-- AÇIKÇA yeniden grant ediliyor. `create_post`/`add_comment` SECURITY INVOKER
-- olduğu için `process_mentions`'ı `authenticated` rolü altında çağırıyor —
-- bu erişimi tamamen kesersek o çağrı zinciri kırılır. Bu fonksiyonun hiç
-- açık `grant` satırı olmadığı (yalnızca `public`'in Postgres'in varsayılan
-- CREATE FUNCTION davranışıyla örtük EXECUTE'una güvendiği) Faz 10 taramasında
-- bulundu — `public`'ten revoke edip `authenticated`'e açıkça grant etmek bu
-- örtük bağımlılığı ortadan kaldırıyor. Yukarıdaki `p_author_id != auth.uid()`
-- kontrolü asıl güvenlik düzeltmesi; bu grant değişikliği ayrıca artık niyeti
-- açık hale getiriyor.
revoke execute on function process_mentions(text, uuid, text, uuid) from public;
grant execute on function process_mentions(text, uuid, text, uuid) to authenticated;

-- ============================================================================
-- İleriye dönük sertleştirme: Postgres, `public` şemasında oluşturulan her
-- yeni fonksiyona `anon`/`authenticated`'e örtük EXECUTE veriyordu (Faz 8'de
-- keşfedildi, o zamandan beri her yeni admin/hassas fonksiyonda elle
-- revoke edilerek atlatıldı). Bu satır, bundan SONRA oluşturulan fonksiyonlar
-- için bu örtük izni kökten kapatır — yeni bir fonksiyon artık açık `grant`
-- olmadan hiçbir istemciden çağrılamaz. Var olan fonksiyonları etkilemez.
-- ============================================================================
alter default privileges in schema public revoke execute on functions from anon, authenticated;
