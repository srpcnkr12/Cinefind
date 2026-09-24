-- Faz 8: Monetizasyon ve istatistik (PRD bölüm 9.6, 10.1, 10.2, 13, 14.4, 19).
-- ADR-0008'in stub'ladığı `undo_last_swipe`/`get_likes_received` ve Faz 5'in
-- `boostBonus`sız bıraktığı `get_discovery_deck` burada gerçek gövdeye kavuşuyor.

-- ============================================================================
-- entitlements / consumable_balances / consumable_ledger / active_boosts
-- (PRD 9.6) — yalnızca `apply_revenuecat_event` (SECURITY DEFINER) yazar.
-- ============================================================================
create table entitlements (
  user_id uuid not null references profiles (id) on delete cascade,
  entitlement text not null check (entitlement in ('premium')),
  expires_at timestamptz not null,
  store text,
  product_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, entitlement)
);

alter table entitlements enable row level security;
create policy "entitlements_owner_select" on entitlements for select using (auth.uid() = user_id);

create table consumable_balances (
  user_id uuid primary key references profiles (id) on delete cascade,
  boosts int not null default 0,
  super_messages int not null default 0
);

alter table consumable_balances enable row level security;
create policy "consumable_balances_owner_select" on consumable_balances for select using (auth.uid() = user_id);

create table consumable_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null check (kind in ('boosts', 'super_messages')),
  delta int not null,
  source text not null check (source in ('purchase', 'use', 'grant', 'refund')),
  store_transaction_id text unique,
  created_at timestamptz not null default now()
);

alter table consumable_ledger enable row level security;
create policy "consumable_ledger_owner_select" on consumable_ledger for select using (auth.uid() = user_id);

create table active_boosts (
  user_id uuid not null references profiles (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null
);

alter table active_boosts enable row level security;
create policy "active_boosts_owner_select" on active_boosts for select using (auth.uid() = user_id);

-- ============================================================================
-- webhook_events — RevenueCat'in "en az bir kez" teslimatında tekrarları
-- ayıklamak için birincil idempotency anahtarı (`event.id`). İstemciye kapalı.
-- ============================================================================
create table webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table webhook_events enable row level security;

-- ============================================================================
-- consumable_products — ürün id'si → tüketilebilir tür/miktar eşlemesi
-- (PRD 13.2). Sabit kod yerine tablo: yeni ürün eklemek migration istemez.
-- ============================================================================
create table consumable_products (
  product_id text primary key,
  kind text not null check (kind in ('boosts', 'super_messages')),
  amount int not null check (amount > 0)
);

alter table consumable_products enable row level security;
create policy "consumable_products_public_select" on consumable_products for select using (true);

insert into consumable_products (product_id, kind, amount) values
  ('boost_1', 'boosts', 1),
  ('boost_3', 'boosts', 3),
  ('boost_5', 'boosts', 5),
  ('super_message_3', 'super_messages', 3),
  ('super_message_5', 'super_messages', 5),
  ('super_message_9', 'super_messages', 9);

-- ============================================================================
-- profile_views — "haftalık istatistik" ekranının görüntülenme sayısı/
-- görüntüleyenler alanları için (PRD 10.1 `record_profile_view`, hiçbir
-- fazda yazılmamıştı). Günlük tekilleştirme.
-- ============================================================================
create table profile_views (
  viewer_id uuid not null references profiles (id) on delete cascade,
  viewed_id uuid not null references profiles (id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (viewer_id, viewed_id, day)
);

alter table profile_views enable row level security;
-- İstemciye kapalı; yalnızca `record_profile_view` (SECURITY DEFINER) yazar,
-- yalnızca `get_weekly_stats` (SECURITY DEFINER) okur.

-- ============================================================================
-- app_config ek anahtarlar (PRD 9.6, 13.1)
-- ============================================================================
insert into app_config (key, value) values
  ('boost_duration_minutes', '30'),
  ('premium_daily_superlikes', '5'),
  ('boost_bonus_weight', '0.15')
on conflict (key) do nothing;

-- ============================================================================
-- notifications.type genişlemesi (super_message, weekly_stats_ready)
-- ============================================================================
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('new_message', 'mention', 'follow_request', 'follow_accepted', 'like', 'comment', 'super_message', 'weekly_stats_ready'));

-- ============================================================================
-- is_premium — tüm premium kapılarının ortak kontrolü.
-- ============================================================================
create or replace function is_premium(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from entitlements
    where user_id = p_user_id and entitlement = 'premium' and expires_at > now()
  );
$$;

grant execute on function is_premium(uuid) to authenticated;

-- ============================================================================
-- apply_revenuecat_event — webhook'un tek transaction'lı, idempotent işleyicisi.
-- `event.id` tekrarında (RevenueCat "en az bir kez" teslimat) ikinci kez
-- hiçbir şey değiştirmeden döner.
-- ============================================================================
create or replace function apply_revenuecat_event(
  p_event_id text,
  p_event_type text,
  p_app_user_id uuid,
  p_product_id text,
  p_expiration_at_ms bigint,
  p_store text,
  p_transaction_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_amount int;
  v_ledger_inserted boolean := false;
begin
  insert into webhook_events (id) values (p_event_id) on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('processed', false, 'reason', 'duplicate_event');
  end if;

  if p_event_type in ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'CANCELLATION', 'EXPIRATION') then
    if p_expiration_at_ms is null then
      return jsonb_build_object('processed', false, 'reason', 'missing_expiration');
    end if;

    insert into entitlements (user_id, entitlement, expires_at, store, product_id, updated_at)
    values (p_app_user_id, 'premium', to_timestamp(p_expiration_at_ms / 1000.0), p_store, p_product_id, now())
    on conflict (user_id, entitlement) do update set
      expires_at = excluded.expires_at,
      store = excluded.store,
      product_id = excluded.product_id,
      updated_at = now();

    return jsonb_build_object('processed', true, 'kind', 'entitlement');
  elsif p_event_type = 'NON_RENEWING_PURCHASE' then
    select cp.kind, cp.amount into v_kind, v_amount from consumable_products cp where cp.product_id = p_product_id;
    if v_kind is null then
      return jsonb_build_object('processed', false, 'reason', 'unknown_product');
    end if;

    insert into consumable_ledger (user_id, kind, delta, source, store_transaction_id)
    values (p_app_user_id, v_kind, v_amount, 'purchase', p_transaction_id)
    on conflict (store_transaction_id) do nothing;
    v_ledger_inserted := found;

    if v_ledger_inserted then
      insert into consumable_balances (user_id, boosts, super_messages)
      values (
        p_app_user_id,
        case when v_kind = 'boosts' then v_amount else 0 end,
        case when v_kind = 'super_messages' then v_amount else 0 end
      )
      on conflict (user_id) do update set
        boosts = consumable_balances.boosts + excluded.boosts,
        super_messages = consumable_balances.super_messages + excluded.super_messages;
    end if;

    return jsonb_build_object('processed', v_ledger_inserted, 'kind', 'consumable');
  end if;

  return jsonb_build_object('processed', false, 'reason', 'unhandled_event_type');
end;
$$;

-- Bu Supabase projesinde `public` şemasındaki her yeni fonksiyona, `postgres`
-- rolünün ALTER DEFAULT PRIVILEGES ayarı yüzünden `anon`+`authenticated`+
-- `service_role`'e örtük EXECUTE veriliyor (yalnızca PUBLIC'e değil). Bu
-- SECURITY DEFINER fonksiyon gerçek para/bakiye yazdığı için açıkça geri
-- alınmazsa herhangi bir istemci sahte bir olayla kendine bedava premium/
-- tüketilebilir tanımlayabilirdi (testte keşfedildi — bkz. Faz 8 raporu;
-- `refresh_film_idf()`'te de aynı örtük izin var, aynı gerekçeyle burada da
-- geri alınıyor).
revoke execute on function apply_revenuecat_event(text, text, uuid, text, bigint, text, text) from public, anon, authenticated;
grant execute on function apply_revenuecat_event(text, text, uuid, text, bigint, text, text) to service_role;

revoke execute on function refresh_film_idf() from public, anon, authenticated;
grant execute on function refresh_film_idf() to service_role;

-- ============================================================================
-- undo_last_swipe — gerçek gövde (bkz. ADR-0008 sonucu). Zaten eşleşmiş bir
-- swipe geri alınamaz (gerekçe #4) — eşleşmeyi bozmak ayrı bir eylem (unmatch).
-- ============================================================================
create or replace function undo_last_swipe()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_swipe swipes;
  v_low uuid;
  v_high uuid;
  v_today date;
  v_tz text;
begin
  if not is_premium(v_me) then
    raise exception 'premium_required';
  end if;

  select * into v_swipe from swipes
  where swiper_id = v_me and undone_at is null
  order by created_at desc
  limit 1;

  if v_swipe.swiper_id is null then
    raise exception 'no_swipe_to_undo';
  end if;

  v_low := least(v_me, v_swipe.target_id);
  v_high := greatest(v_me, v_swipe.target_id);
  if exists (select 1 from matches where user_low = v_low and user_high = v_high and unmatched_at is null) then
    raise exception 'cannot_undo_matched';
  end if;

  update swipes set undone_at = now() where swiper_id = v_swipe.swiper_id and target_id = v_swipe.target_id;

  select coalesce(timezone, 'UTC') into v_tz from profiles where id = v_me;
  v_today := (now() at time zone v_tz)::date;
  update daily_usage set
    swipes_used = greatest(0, swipes_used - 1),
    rewinds_used = rewinds_used + 1
  where user_id = v_me and day = v_today;
end;
$$;

grant execute on function undo_last_swipe() to authenticated;

-- ============================================================================
-- get_likes_received — premium ise kimlikli liste, değilse yalnızca sayı
-- (bkz. ADR-0008 sonucu, PRD 13.1).
-- ============================================================================
create or replace function get_likes_received()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_total int;
  v_likers jsonb;
begin
  select count(*) into v_total from swipes s
  where s.target_id = v_me and s.action in ('like', 'superlike') and s.undone_at is null
    and not exists (
      select 1 from matches m where m.user_low = least(v_me, s.swiper_id) and m.user_high = greatest(v_me, s.swiper_id)
    )
    and not exists (
      select 1 from blocks b where (b.blocker_id = v_me and b.blocked_id = s.swiper_id) or (b.blocker_id = s.swiper_id and b.blocked_id = v_me)
    );

  if is_premium(v_me) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'display_name', p.display_name,
      'photo_path', (select pp.storage_path from profile_photos pp where pp.user_id = p.id and pp.moderation_status = 'approved' order by pp.position limit 1),
      'action', s.action,
      'created_at', s.created_at
    ) order by s.created_at desc), '[]'::jsonb) into v_likers
    from swipes s
    join profiles p on p.id = s.swiper_id
    where s.target_id = v_me and s.action in ('like', 'superlike') and s.undone_at is null
      and not exists (
        select 1 from matches m where m.user_low = least(v_me, s.swiper_id) and m.user_high = greatest(v_me, s.swiper_id)
      )
      and not exists (
        select 1 from blocks b where (b.blocker_id = v_me and b.blocked_id = s.swiper_id) or (b.blocker_id = s.swiper_id and b.blocked_id = v_me)
      );
  else
    v_likers := null;
  end if;

  return jsonb_build_object('total_count', v_total, 'likers', v_likers);
end;
$$;

grant execute on function get_likes_received() to authenticated;

-- ============================================================================
-- swipe — premium sınırsız swipe + günde 5 süper beğeni (PRD 13.1).
-- ============================================================================
create or replace function swipe(p_target_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_today date;
  v_tz text;
  v_limit int;
  v_superlike_limit int;
  v_used int;
  v_superlikes_used int;
  v_low uuid;
  v_high uuid;
  v_mutual boolean := false;
  v_match_id uuid;
  v_conversation_id uuid;
  v_compat numeric;
  v_reasons jsonb;
  v_premium boolean;
begin
  if p_action not in ('like', 'pass', 'superlike') then
    raise exception 'invalid_action';
  end if;

  v_premium := is_premium(v_me);

  select coalesce(timezone, 'UTC') into v_tz from profiles where id = v_me;
  v_today := (now() at time zone v_tz)::date;

  select (value #>> '{}')::int into v_limit from app_config where key = 'free_daily_swipes';
  select (value #>> '{}')::int into v_superlike_limit
  from app_config where key = (case when v_premium then 'premium_daily_superlikes' else 'free_daily_superlikes' end);

  insert into daily_usage (user_id, day) values (v_me, v_today) on conflict (user_id, day) do nothing;

  select swipes_used, superlikes_used into v_used, v_superlikes_used
  from daily_usage where user_id = v_me and day = v_today for update;

  if not v_premium and v_used >= coalesce(v_limit, 25) then
    raise exception 'daily_limit_reached';
  end if;
  if p_action = 'superlike' and v_superlikes_used >= coalesce(v_superlike_limit, 1) then
    raise exception 'daily_superlike_limit_reached';
  end if;

  insert into swipes (swiper_id, target_id, action) values (v_me, p_target_id, p_action)
  on conflict (swiper_id, target_id) do update set action = excluded.action, created_at = now(), undone_at = null;

  update daily_usage set
    swipes_used = swipes_used + 1,
    superlikes_used = superlikes_used + (case when p_action = 'superlike' then 1 else 0 end)
  where user_id = v_me and day = v_today;

  if p_action in ('like', 'superlike') then
    v_low := least(v_me, p_target_id);
    v_high := greatest(v_me, p_target_id);
    perform pg_advisory_xact_lock(hashtextextended(v_low::text || ':' || v_high::text, 0));

    if exists (
      select 1 from swipes where swiper_id = p_target_id and target_id = v_me
        and action in ('like', 'superlike') and undone_at is null
    ) then
      v_mutual := true;

      select raw_score, reasons into v_compat, v_reasons
      from compatibility_scores where user_low = v_low and user_high = v_high;

      insert into matches (user_low, user_high, compat_raw, reasons)
      values (v_low, v_high, v_compat, coalesce(v_reasons, '[]'::jsonb))
      on conflict (user_low, user_high) do update set compat_raw = excluded.compat_raw
      returning id into v_match_id;

      insert into conversations (match_id, kind, status) values (v_match_id, 'match', 'active')
      returning id into v_conversation_id;

      insert into conversation_members (conversation_id, user_id) values
        (v_conversation_id, v_low), (v_conversation_id, v_high)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end if;

  return jsonb_build_object('matched', v_mutual, 'match_id', v_match_id);
end;
$$;

grant execute on function swipe(uuid, text) to authenticated;

-- ============================================================================
-- get_discovery_deck — boostBonus eklenir (PRD 7.5). `compat_percent` (percent_rank
-- tabanlı) değişmez; yalnızca sıralama (final_score) etkilenir.
-- ============================================================================
create or replace function get_discovery_deck(p_cursor int default 0, p_limit int default 20)
returns table (
  user_id uuid,
  display_name text,
  age int,
  city text,
  intents text[],
  photo_path text,
  top_four_film_ids uuid[],
  distance_bucket text,
  compat_percent int,
  reasons jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_my_age int;
  v_my_gender text;
  v_my_interested_in text[];
  v_my_intents text[];
  v_my_age_min int;
  v_my_age_max int;
  v_my_max_distance_km int;
  v_my_geog extensions.geography;
  v_max_impressions int;
  v_explore_n int;
  v_boost_bonus numeric;
begin
  select extract(year from age(pr.birthdate))::int, pr.gender, pr.interested_in, pr.intents, pr.age_min, pr.age_max, pr.max_distance_km
    into v_my_age, v_my_gender, v_my_interested_in, v_my_intents, v_my_age_min, v_my_age_max, v_my_max_distance_km
  from profiles pr where pr.id = v_me;

  select pl.geog into v_my_geog from profile_locations pl where pl.user_id = v_me;
  select (ac.value #>> '{}')::int into v_max_impressions from app_config ac where ac.key = 'max_daily_impressions';
  select (ac.value #>> '{}')::numeric into v_boost_bonus from app_config ac where ac.key = 'boost_bonus_weight';
  v_explore_n := greatest(1, p_limit / 10);

  if v_my_geog is null then
    return;
  end if;

  drop table if exists tmp_deck;
  create temporary table tmp_deck on commit drop as
  with candidates as (
    select
      p.id,
      p.display_name,
      extract(year from age(p.birthdate))::int as age,
      p.city,
      p.intents,
      p.bio,
      p.last_active_at,
      extensions.st_distance(v_my_geog, pl.geog) / 1000.0 as distance_km,
      (select count(*) from profile_photos pp where pp.user_id = p.id) as photo_count,
      (select count(*) from profile_prompts pr where pr.user_id = p.id) as prompt_count,
      (select count(*) from user_films uf where uf.user_id = p.id and uf.status = 'watched') as watched_count,
      (select array_agg(uf.film_id order by uf.top_four_position)
         from user_films uf where uf.user_id = p.id and uf.top_four_position is not null) as top_four_ids,
      (select pp2.storage_path from profile_photos pp2
         where pp2.user_id = p.id and pp2.moderation_status = 'approved'
         order by pp2.position limit 1) as photo_path,
      exists (select 1 from active_boosts ab where ab.user_id = p.id and ab.ends_at > now()) as is_boosted
    from profiles p
    join profile_locations pl on pl.user_id = p.id
    where p.id != v_me
      and p.discoverable = true
      and p.deleted_at is null
      and p.last_active_at is not null
      and p.last_active_at > now() - interval '30 days'
      and p.birthdate is not null
      and extract(year from age(p.birthdate))::int between v_my_age_min and v_my_age_max
      and v_my_age between p.age_min and p.age_max
      and p.gender = any(v_my_interested_in)
      and v_my_gender = any(p.interested_in)
      and p.intents && v_my_intents
      and extensions.st_dwithin(v_my_geog, pl.geog, least(v_my_max_distance_km, p.max_distance_km) * 1000)
      and not exists (select 1 from swipes s where s.swiper_id = v_me and s.target_id = p.id)
      and not exists (
        select 1 from blocks b where (b.blocker_id = v_me and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = v_me)
      )
      and exists (select 1 from profile_photos pp3 where pp3.user_id = p.id and pp3.moderation_status = 'approved')
      and coalesce((select ci.count from profile_impressions ci where ci.viewed_id = p.id and ci.day = current_date), 0) < coalesce(v_max_impressions, 3)
    limit 500
  ),
  scored as (
    select
      c.*,
      coalesce(cs.raw_score, 0.5) as raw_score,
      coalesce(cs.reasons, '[]'::jsonb) as reasons,
      exists (
        select 1 from swipes ls where ls.swiper_id = c.id and ls.target_id = v_me
          and ls.action in ('like', 'superlike') and ls.undone_at is null
      ) as liked_me,
      greatest(0, 1 - extract(epoch from (now() - c.last_active_at)) / (30 * 86400.0)) as activity_recency,
      least(1.0, (
        (least(c.photo_count, 6) / 6.0) * 0.4 +
        (case when coalesce(c.bio, '') != '' then 0.2 else 0 end) +
        (least(c.prompt_count, 3) / 3.0) * 0.2 +
        (least(c.watched_count, 20) / 20.0) * 0.2
      )) as profile_quality
    from candidates c
    left join compatibility_scores cs
      on cs.user_low = least(v_me, c.id) and cs.user_high = greatest(v_me, c.id)
  ),
  calibrated as (
    select
      s.*,
      percent_rank() over (order by s.raw_score) as pctile,
      (0.60 * s.raw_score + 0.15 * s.activity_recency + 0.10 * s.profile_quality + 0.10 * (case when s.liked_me then 1 else 0 end)
        + (case when s.is_boosted then coalesce(v_boost_bonus, 0.15) else 0 end)) as final_score
    from scored s
  ),
  main_slice as (
    select *, 'main'::text as bucket from calibrated order by final_score desc limit greatest(p_limit - v_explore_n, 0)
  ),
  explore_slice as (
    select *, 'explore'::text as bucket from calibrated
    where id not in (select id from main_slice) and raw_score >= 0.4
    order by random() limit v_explore_n
  )
  select * from main_slice
  union all
  select * from explore_slice;

  insert into profile_impressions (viewed_id, day, count)
  select id, current_date, 1 from tmp_deck
  on conflict (viewed_id, day) do update set count = profile_impressions.count + 1;

  return query
  select
    d.id,
    d.display_name,
    d.age,
    d.city,
    d.intents,
    d.photo_path,
    d.top_four_ids,
    case
      when d.distance_km < 1 then '<1'
      when d.distance_km < 5 then '1-5'
      when d.distance_km < 10 then '5-10'
      when d.distance_km < 25 then '10-25'
      else '25+'
    end,
    greatest(50, least(99, round(50 + d.pctile * 49)::int)),
    d.reasons
  from tmp_deck d
  order by d.bucket = 'main' desc, d.final_score desc
  limit p_limit offset p_cursor;
end;
$$;

grant execute on function get_discovery_deck(int, int) to authenticated;

-- ============================================================================
-- use_boost — bakiyeden 1 düş, `active_boosts` satırı aç (PRD 13.2, "Öne Çık").
-- ============================================================================
create or replace function use_boost()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_minutes int;
  v_ends_at timestamptz;
begin
  update consumable_balances set boosts = boosts - 1 where user_id = v_me and boosts > 0;
  if not found then
    raise exception 'no_boosts_available';
  end if;

  select (value #>> '{}')::int into v_minutes from app_config where key = 'boost_duration_minutes';
  v_ends_at := now() + make_interval(mins => coalesce(v_minutes, 30));

  insert into active_boosts (user_id, starts_at, ends_at) values (v_me, now(), v_ends_at);
  insert into consumable_ledger (user_id, kind, delta, source) values (v_me, 'boosts', -1, 'use');

  return jsonb_build_object('ends_at', v_ends_at);
end;
$$;

grant execute on function use_boost() to authenticated;

-- ============================================================================
-- send_message — bekleyen (henüz kabul edilmemiş) bir süper mesaj
-- konuşmasına ikinci mesaj gönderilemez (PRD 13.2: "tek mesaj gönderme").
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

  if exists (select 1 from conversations c where c.id = p_conversation_id and c.status = 'pending') then
    raise exception 'conversation_pending';
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

-- ============================================================================
-- send_super_message / respond_to_super_message (PRD 13.2, 10.1).
-- ============================================================================
create or replace function send_super_message(p_recipient_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conv uuid;
begin
  if v_me = p_recipient_id then
    raise exception 'invalid_recipient';
  end if;
  if exists (
    select 1 from blocks where (blocker_id = v_me and blocked_id = p_recipient_id) or (blocker_id = p_recipient_id and blocked_id = v_me)
  ) then
    raise exception 'blocked';
  end if;

  update consumable_balances set super_messages = super_messages - 1 where user_id = v_me and super_messages > 0;
  if not found then
    raise exception 'no_super_messages_available';
  end if;

  insert into conversations (kind, status) values ('super_message', 'pending') returning id into v_conv;
  insert into conversation_members (conversation_id, user_id) values (v_conv, v_me), (v_conv, p_recipient_id);
  insert into messages (conversation_id, sender_id, kind, body) values (v_conv, v_me, 'text', p_body);
  insert into consumable_ledger (user_id, kind, delta, source) values (v_me, 'super_messages', -1, 'use');
  insert into notifications (user_id, type, actor_id, entity)
  values (p_recipient_id, 'super_message', v_me, jsonb_build_object('conversationId', v_conv));

  return v_conv;
end;
$$;

grant execute on function send_super_message(uuid, text) to authenticated;

create or replace function respond_to_super_message(p_conversation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_sender_id uuid;
begin
  if not exists (
    select 1 from conversation_members where conversation_id = p_conversation_id and user_id = v_me
  ) then
    raise exception 'not_a_member';
  end if;
  if not exists (
    select 1 from conversations where id = p_conversation_id and kind = 'super_message' and status = 'pending'
  ) then
    raise exception 'not_pending';
  end if;

  select sender_id into v_sender_id from messages
  where conversation_id = p_conversation_id order by created_at asc limit 1;

  if v_sender_id = v_me then
    raise exception 'sender_cannot_respond';
  end if;

  update conversations set status = case when p_accept then 'active' else 'closed' end
  where id = p_conversation_id;
end;
$$;

grant execute on function respond_to_super_message(uuid, boolean) to authenticated;

-- ============================================================================
-- record_profile_view (PRD 10.1) — günlük tekilleştirme.
-- ============================================================================
create or replace function record_profile_view(p_viewed_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_viewed_id = auth.uid() then
    return;
  end if;
  insert into profile_views (viewer_id, viewed_id, day) values (auth.uid(), p_viewed_id, current_date)
  on conflict (viewer_id, viewed_id, day) do nothing;
end;
$$;

grant execute on function record_profile_view(uuid) to authenticated;

-- ============================================================================
-- get_weekly_stats — ücretsizde yalnızca sayı, premium'da kimlik + sıralama
-- (PRD 5.3, 13.1, 13.3). "Bölgedeki uyum sıralaması" vekil metrik: aynı
-- şehirde son 7 günde aktif kullanıcılar arasında bu haftaki beğeni sayısı
-- yüzdelik dilimi. "En çok eşleşme getiren film": bu haftaki eşleşmelerin
-- `reasons`'ındaki `shared_favorite` filmId'lerinin en sık geçeni.
-- ============================================================================
create or replace function get_weekly_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_my_city text;
  v_profile_views int;
  v_matches int;
  v_top_post jsonb;
  v_top_match_film jsonb;
  v_viewers jsonb;
  v_regional_rank int;
begin
  select city into v_my_city from profiles where id = v_me;

  select count(*) into v_profile_views from profile_views
  where viewed_id = v_me and created_at > now() - interval '7 days';

  select count(*) into v_matches from matches
  where (user_low = v_me or user_high = v_me) and created_at > now() - interval '7 days' and unmatched_at is null;

  select jsonb_build_object('post_id', p.id, 'like_count', p.like_count, 'comment_count', p.comment_count)
    into v_top_post
  from posts p
  where p.author_id = v_me and p.created_at > now() - interval '7 days' and p.deleted_at is null
  order by (p.like_count + p.comment_count + p.repost_count) desc
  limit 1;

  select jsonb_build_object(
    'film_id', f.id,
    'title', coalesce((select ft.title from film_translations ft where ft.film_id = f.id and ft.locale = 'tr'), f.original_title),
    'match_count', counts.n
  ) into v_top_match_film
  from (
    select (reason ->> 'filmId')::uuid as film_id, count(*) as n
    from matches m, jsonb_array_elements(m.reasons) as reason
    where (m.user_low = v_me or m.user_high = v_me)
      and m.created_at > now() - interval '7 days'
      and m.unmatched_at is null
      and reason ->> 'type' = 'shared_favorite'
    group by 1
    order by n desc
    limit 1
  ) counts
  join films f on f.id = counts.film_id;

  if is_premium(v_me) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'display_name', p.display_name,
      'photo_path', (select pp.storage_path from profile_photos pp where pp.user_id = p.id and pp.moderation_status = 'approved' order by pp.position limit 1),
      'viewed_at', pv.created_at
    ) order by pv.created_at desc), '[]'::jsonb) into v_viewers
    from profile_views pv
    join profiles p on p.id = pv.viewer_id
    where pv.viewed_id = v_me and pv.created_at > now() - interval '7 days'
    limit 20;

    if v_my_city is not null then
      select round(100 * percent_rank() over (order by liked)) into v_regional_rank
      from (
        select pr.id, count(s.*) as liked
        from profiles pr
        left join swipes s on s.target_id = pr.id and s.action in ('like', 'superlike') and s.created_at > now() - interval '7 days' and s.undone_at is null
        where pr.city = v_my_city and pr.last_active_at > now() - interval '7 days'
        group by pr.id
      ) ranked
      where ranked.id = v_me;
    end if;

    return jsonb_build_object(
      'profile_views_this_week', v_profile_views,
      'matches_this_week', v_matches,
      'top_post', v_top_post,
      'top_match_film', v_top_match_film,
      'viewers', v_viewers,
      'regional_rank', v_regional_rank
    );
  end if;

  return jsonb_build_object(
    'profile_views_this_week', v_profile_views,
    'matches_this_week', v_matches,
    'top_post', v_top_post,
    'top_match_film', v_top_match_film,
    'viewers', null,
    'regional_rank', null
  );
end;
$$;

grant execute on function get_weekly_stats() to authenticated;

-- ============================================================================
-- weekly-stats cron (PRD 10.2) — Faz 1'in tmdb_sync_daily deseniyle aynı:
-- yerelde Vault secret'ı yok, iş kayıtlı ama tetiklendiğinde başarısız olur;
-- yerel doğrulama doğrudan HTTP çağrısıyla yapılır.
-- ============================================================================
select cron.schedule(
  'weekly_stats_monday',
  '0 9 * * 1',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-stats',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);
