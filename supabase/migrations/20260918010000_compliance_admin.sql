-- Faz 9: Güvenlik, admin ve uyumluluk tamamlama (PRD bölüm 8.3, 9.6, 10.1, 10.2, 14.1, 14.2, 14.3, 19).

-- ============================================================================
-- admin_roles / moderation_actions / testimonials / rate_limits / data_export_requests
-- ============================================================================
create table admin_roles (
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('moderator', 'editor', 'admin')),
  primary key (user_id, role)
);

alter table admin_roles enable row level security;
create policy "admin_roles_owner_select" on admin_roles for select using (auth.uid() = user_id);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references profiles (id) on delete cascade,
  target_user_id uuid not null references profiles (id) on delete cascade,
  action text not null check (action in ('warn', 'remove_content', 'suspend', 'ban', 'unban')),
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table moderation_actions enable row level security;
-- İstemciye kapalı; yalnızca admin RPC'leri (SECURITY DEFINER) okur/yazar.

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('tr', 'en')),
  quote text not null,
  display_name text not null,
  city text,
  consent_document_path text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;
create policy "testimonials_public_select" on testimonials for select using (is_published = true);

create table rate_limits (
  user_id uuid not null references profiles (id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, bucket, window_start)
);

alter table rate_limits enable row level security;
-- İstemciye kapalı; yalnızca `check_rate_limit` (SECURITY DEFINER) yazar.

create table data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  storage_path text,
  expires_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table data_export_requests enable row level security;
create policy "data_export_requests_owner_select" on data_export_requests for select using (auth.uid() = user_id);
create policy "data_export_requests_owner_insert" on data_export_requests for insert with check (auth.uid() = user_id);

-- ============================================================================
-- reports: mesaj şikayetlerinde bağlam anlık görüntüsü (PRD 14.1).
-- ============================================================================
alter table reports add column context_snapshot jsonb;

-- ============================================================================
-- profiles: hesap silme / askıya alma / banlama alanları.
-- ============================================================================
alter table profiles add column deletion_requested_at timestamptz;
alter table profiles add column suspended_until timestamptz;
alter table profiles add column banned_at timestamptz;

-- ============================================================================
-- Storage: veri dışa aktarma arşivleri (private).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('data-exports', 'data-exports', false)
on conflict (id) do nothing;

-- İstemciye kapalı; yalnızca `data-export` Edge Function'ı (service role) yazar/okur,
-- imzalı URL üzerinden erişim sağlanır.

-- ============================================================================
-- Yardımcı yetki/kısıtlama fonksiyonları.
-- ============================================================================
create or replace function is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_roles where user_id = p_user_id and role = 'admin');
$$;

create or replace function is_moderator_or_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_roles where user_id = p_user_id and role in ('moderator', 'admin'));
$$;

revoke execute on function is_admin(uuid) from public, anon;
revoke execute on function is_moderator_or_admin(uuid) from public, anon;
grant execute on function is_admin(uuid) to authenticated, service_role;
grant execute on function is_moderator_or_admin(uuid) to authenticated, service_role;

create or replace function is_restricted(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = p_user_id
      and (p.banned_at is not null or p.deletion_requested_at is not null
        or (p.suspended_until is not null and p.suspended_until > now()))
  );
$$;

grant execute on function is_restricted(uuid) to authenticated;

-- ============================================================================
-- check_rate_limit — sabit pencere sayaç (bkz. ADR-0017). Aşılırsa 'rate_limited'.
-- ============================================================================
create or replace function check_rate_limit(p_bucket text, p_max_count int, p_window_seconds int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_window_start timestamptz;
  v_count int;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (user_id, bucket, window_start, count)
  values (v_me, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;

  if v_count > p_max_count then
    raise exception 'rate_limited';
  end if;
end;
$$;

revoke execute on function check_rate_limit(text, int, int) from public, anon;
grant execute on function check_rate_limit(text, int, int) to authenticated;

-- ============================================================================
-- app_config ek anahtarlar: rate limit + yeni hesap kısıtlaması (PRD 8.3, 14.1).
-- ============================================================================
insert into app_config (key, value) values
  ('rate_limit_messages_per_min', '20'),
  ('rate_limit_posts_per_hour', '10'),
  ('rate_limit_reports_per_hour', '10'),
  ('new_account_messages_per_min', '5'),
  ('new_account_posts_per_hour', '2')
on conflict (key) do nothing;

-- ============================================================================
-- send_message: rate limit + yeni hesap kısıtlaması + is_restricted engeli eklenir.
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
  v_is_new_account boolean;
  v_limit int;
begin
  if is_restricted(v_me) then
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

-- ============================================================================
-- create_post: rate limit + yeni hesap kısıtlaması + is_restricted engeli.
-- ============================================================================
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
  if is_restricted(v_me) then
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

-- ============================================================================
-- report_content: rate limit + mesaj şikayetlerinde son 20 mesajlık bağlam
-- anlık görüntüsü (PRD 14.1).
-- ============================================================================
create or replace function report_content(p_target_type text, p_target_id uuid, p_reason text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_snapshot jsonb;
  v_report_id uuid;
begin
  perform check_rate_limit('report_content', coalesce((select (value #>> '{}')::int from app_config where key = 'rate_limit_reports_per_hour'), 10), 3600);

  if p_target_type = 'message' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'sender_id', m.sender_id, 'kind', m.kind, 'body', m.body, 'created_at', m.created_at
    ) order by m.created_at desc), '[]'::jsonb) into v_snapshot
    from (
      select * from messages where conversation_id = (select conversation_id from messages where id = p_target_id)
      order by created_at desc limit 20
    ) m;
  end if;

  insert into reports (reporter_id, target_type, target_id, reason, details, context_snapshot)
  values (v_me, p_target_type, p_target_id, p_reason, p_details, v_snapshot)
  returning id into v_report_id;

  return v_report_id;
end;
$$;

grant execute on function report_content(text, uuid, text, text) to authenticated;

-- ============================================================================
-- Konum: ~500m ızgaraya yuvarlama (PRD 14.2).
-- ============================================================================
create or replace function update_my_location(lat double precision, lng double precision)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grid constant double precision := 0.0045; -- ~500m
  v_rounded_lat double precision := round(lat / v_grid) * v_grid;
  v_rounded_lng double precision := round(lng / v_grid) * v_grid;
begin
  insert into profile_locations (user_id, geog, updated_at)
  values (auth.uid(), extensions.st_setsrid(extensions.st_makepoint(v_rounded_lng, v_rounded_lat), 4326)::extensions.geography, now())
  on conflict (user_id) do update set geog = excluded.geog, updated_at = now();
end;
$$;

grant execute on function update_my_location(double precision, double precision) to authenticated;

-- ============================================================================
-- get_discovery_deck: günlük sabit jitter (trilaterasyon zorlaştırma, PRD 14.2)
-- + silinme/askı/ban filtreleri.
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
      extensions.st_distance(v_my_geog, pl.geog) / 1000.0
        + ((hashtext(p.id::text || current_date::text) % 41 - 20) / 100.0) as distance_km,
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
      and p.deletion_requested_at is null
      and p.banned_at is null
      and (p.suspended_until is null or p.suspended_until < now())
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
-- get_following_feed / get_discover_feed: silinme/askı/ban filtresi eklenir.
-- ============================================================================
create or replace function get_following_feed(p_cursor int default 0, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_username text, author_display_name text,
  type text, film_id uuid, film_title text, film_poster_path text,
  line_id uuid, list_id uuid, body text, rating numeric, contains_spoiler boolean,
  repost_of_id uuid, quote_of_id uuid, visibility text,
  like_count int, comment_count int, repost_count int, bookmark_count int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.author_id, pr.username, pr.display_name,
    p.type, p.film_id, f.original_title, f.poster_path,
    p.line_id, p.list_id, p.body, p.rating, p.contains_spoiler,
    p.repost_of_id, p.quote_of_id, p.visibility,
    p.like_count, p.comment_count, p.repost_count, p.bookmark_count,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.author_id
  left join films f on f.id = p.film_id
  where p.deleted_at is null
    and not is_restricted(p.author_id)
    and (
      p.author_id = auth.uid()
      or exists (select 1 from follows fo where fo.follower_id = auth.uid() and fo.followee_id = p.author_id and fo.status = 'accepted')
    )
    and can_view_post(auth.uid(), p.author_id, p.visibility)
  order by p.created_at desc
  limit p_limit offset p_cursor;
$$;

grant execute on function get_following_feed(int, int) to authenticated;

create or replace function get_discover_feed(p_cursor int default 0, p_limit int default 20)
returns table (
  id uuid, author_id uuid, author_username text, author_display_name text,
  type text, film_id uuid, film_title text, film_poster_path text,
  line_id uuid, list_id uuid, body text, rating numeric, contains_spoiler boolean,
  repost_of_id uuid, quote_of_id uuid, visibility text,
  like_count int, comment_count int, repost_count int, bookmark_count int,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id, p.author_id, pr.username, pr.display_name,
    p.type, p.film_id, f.original_title, f.poster_path,
    p.line_id, p.list_id, p.body, p.rating, p.contains_spoiler,
    p.repost_of_id, p.quote_of_id, p.visibility,
    p.like_count, p.comment_count, p.repost_count, p.bookmark_count,
    p.created_at
  from posts p
  join profiles pr on pr.id = p.author_id
  left join films f on f.id = p.film_id
  where p.deleted_at is null
    and not is_restricted(p.author_id)
    and p.author_id != auth.uid()
    and can_view_post(auth.uid(), p.author_id, p.visibility)
  order by (
    (case when p.film_id in (select film_id from user_films where user_id = auth.uid()) then 1 else 0 end) * 0.5
    + least(1.0, (p.like_count + p.comment_count) / 20.0) * 0.3
    + greatest(0, 1 - extract(epoch from (now() - p.created_at)) / (7 * 86400.0)) * 0.2
  ) desc
  limit p_limit offset p_cursor;
$$;

grant execute on function get_discover_feed(int, int) to authenticated;

-- ============================================================================
-- Kullanıcı RPC'leri: engellenenler, rıza iptali, hesap silme, veri dışa aktarma.
-- ============================================================================
create or replace function get_blocked_users()
returns table (user_id uuid, display_name text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, p.display_name, b.created_at
  from blocks b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

grant execute on function get_blocked_users() to authenticated;

create or replace function unblock_user(p_user_id uuid)
returns void
language sql
security invoker
as $$
  delete from blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
$$;

grant execute on function unblock_user(uuid) to authenticated;

create or replace function revoke_consent(p_consent_type text)
returns void
language plpgsql
security invoker
as $$
declare
  v_version text;
begin
  select version into v_version from consents
  where user_id = auth.uid() and consent_type = p_consent_type
  order by granted_at desc nulls last, revoked_at desc nulls last limit 1;

  insert into consents (user_id, consent_type, version, granted_at, revoked_at)
  values (auth.uid(), p_consent_type, coalesce(v_version, 'v1'), null, now());
end;
$$;

grant execute on function revoke_consent(text) to authenticated;

-- ============================================================================
-- request_account_deletion — anında yerel anonimleştirme; kalıcı silme 30 gün
-- sonra `account-deletion` cron'unda (PRD 14.3, 10.1, 10.2).
-- ============================================================================
create or replace function request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  update profiles set
    deletion_requested_at = now(),
    discoverable = false,
    display_name = 'Silinmiş Kullanıcı',
    bio = null,
    username = null
  where id = v_me;

  delete from profile_photos where user_id = v_me;
end;
$$;

grant execute on function request_account_deletion() to authenticated;

-- ============================================================================
-- request_data_export — kuyruğa ekler; gerçek üretim `data-export` Edge
-- Function'ında (istemci tetikli, bkz. Faz 6 send-push emsali).
-- ============================================================================
create or replace function request_data_export()
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into data_export_requests (user_id, status) values (auth.uid(), 'queued')
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function request_data_export() to authenticated;

-- ============================================================================
-- Admin RPC'leri (hepsi is_moderator_or_admin/is_admin ile korunur).
-- ============================================================================
create or replace function admin_list_reports(p_status text default 'open', p_cursor int default 0, p_limit int default 20)
returns table (
  id uuid, reporter_id uuid, reporter_display_name text, target_type text, target_id uuid,
  reason text, details text, status text, assigned_to uuid, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;

  return query
  select r.id, r.reporter_id, p.display_name, r.target_type, r.target_id,
         r.reason, r.details, r.status, r.assigned_to, r.created_at
  from reports r
  join profiles p on p.id = r.reporter_id
  where r.status = p_status
  order by
    case r.reason when 'underage' then 0 when 'harassment' then 1 when 'hate' then 1 when 'scam' then 2 else 3 end,
    r.created_at asc
  limit p_limit offset p_cursor;
end;
$$;

create or replace function admin_assign_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  update reports set assigned_to = auth.uid(), status = 'in_review' where id = p_report_id;
end;
$$;

create or replace function admin_resolve_report(p_report_id uuid, p_resolution text, p_dismiss boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  update reports set
    status = case when p_dismiss then 'dismissed' else 'actioned' end,
    resolution = p_resolution,
    resolved_at = now()
  where id = p_report_id;
end;
$$;

create or replace function admin_get_report(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;

  select jsonb_build_object(
    'id', r.id, 'reporter_id', r.reporter_id, 'reporter_display_name', p.display_name,
    'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason,
    'details', r.details, 'status', r.status, 'assigned_to', r.assigned_to,
    'context_snapshot', r.context_snapshot, 'created_at', r.created_at,
    'resolution', r.resolution, 'resolved_at', r.resolved_at
  ) into v_result
  from reports r
  join profiles p on p.id = r.reporter_id
  where r.id = p_report_id;

  return v_result;
end;
$$;

create or replace function admin_get_user_360(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;

  select jsonb_build_object(
    'profile', (select to_jsonb(p) from (
      select id, display_name, username, city, birthdate, created_at, last_active_at,
             deleted_at, deletion_requested_at, suspended_until, banned_at
      from profiles where id = p_user_id
    ) p),
    'reports_against', (select count(*) from reports where target_type = 'user' and target_id = p_user_id),
    'reports_by', (select count(*) from reports where reporter_id = p_user_id),
    'moderation_history', (select coalesce(jsonb_agg(to_jsonb(ma) order by ma.created_at desc), '[]'::jsonb)
      from moderation_actions ma where ma.target_user_id = p_user_id),
    'match_count', (select count(*) from matches where (user_low = p_user_id or user_high = p_user_id) and unmatched_at is null),
    'post_count', (select count(*) from posts where author_id = p_user_id and deleted_at is null),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c) order by c.granted_at desc nulls last), '[]'::jsonb)
      from consents c where c.user_id = p_user_id)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function admin_remove_content(p_target_type text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;

  if p_target_type = 'photo' then
    update profile_photos set moderation_status = 'rejected' where id = p_target_id;
  elsif p_target_type = 'post' then
    update posts set deleted_at = now() where id = p_target_id;
  elsif p_target_type = 'comment' then
    update comments set deleted_at = now() where id = p_target_id;
  elsif p_target_type = 'line' then
    update film_lines set moderation_status = 'rejected' where id = p_target_id;
  else
    raise exception 'unsupported_target_type';
  end if;
end;
$$;

create or replace function admin_moderate_user(p_target_user_id uuid, p_action text, p_reason text default null, p_expires_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  if p_action not in ('warn', 'remove_content', 'suspend', 'ban', 'unban') then
    raise exception 'invalid_action';
  end if;

  insert into moderation_actions (moderator_id, target_user_id, action, reason, expires_at)
  values (auth.uid(), p_target_user_id, p_action, p_reason, p_expires_at);

  if p_action = 'suspend' then
    update profiles set suspended_until = coalesce(p_expires_at, now() + interval '7 days') where id = p_target_user_id;
  elsif p_action = 'ban' then
    update profiles set banned_at = now(), discoverable = false where id = p_target_user_id;
  elsif p_action = 'unban' then
    update profiles set banned_at = null, suspended_until = null where id = p_target_user_id;
  end if;
end;
$$;

create or replace function admin_set_app_config(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'unauthorized';
  end if;
  insert into app_config (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end;
$$;

create or replace function admin_list_app_config()
returns setof app_config
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'unauthorized';
  end if;
  return query select * from app_config order by key;
end;
$$;

create or replace function admin_upsert_testimonial(
  p_id uuid, p_locale text, p_quote text, p_display_name text, p_city text, p_is_published boolean
)
returns testimonials
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row testimonials;
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;

  if p_id is null then
    insert into testimonials (locale, quote, display_name, city, is_published)
    values (p_locale, p_quote, p_display_name, p_city, p_is_published)
    returning * into v_row;
  else
    update testimonials set
      locale = p_locale, quote = p_quote, display_name = p_display_name, city = p_city, is_published = p_is_published
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function admin_list_testimonials()
returns setof testimonials
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  return query select * from testimonials order by created_at desc;
end;
$$;

create or replace function admin_set_collection_published(p_collection_id uuid, p_is_published boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  update collections set is_published = p_is_published where id = p_collection_id;
end;
$$;

create or replace function admin_upsert_collection_translation(
  p_collection_id uuid, p_locale text, p_title text, p_intro text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  insert into collection_translations (collection_id, locale, title, intro)
  values (p_collection_id, p_locale, p_title, p_intro)
  on conflict (collection_id, locale) do update set title = excluded.title, intro = excluded.intro;
end;
$$;

create or replace function admin_list_collections()
returns table (id uuid, slug text, kind text, is_published boolean, sort_order int, title text, intro text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator_or_admin() then
    raise exception 'unauthorized';
  end if;
  return query
  select c.id, c.slug, c.kind, c.is_published, c.sort_order, ct.title, ct.intro
  from collections c
  left join collection_translations ct on ct.collection_id = c.id and ct.locale = 'tr'
  order by c.sort_order;
end;
$$;

-- Bu Supabase projesinde `public` şemasındaki her yeni fonksiyona `anon`+
-- `authenticated`+`service_role`'e örtük EXECUTE veriliyor (Faz 8'de keşfedildi).
-- Admin RPC'lerinin tamamı içeride `is_admin()`/`is_moderator_or_admin()`
-- kontrolü yapıyor (savunma derinliği), ama yine de `anon`'dan açıkça geri
-- alınıyor — kimliksiz bir istemcinin bu fonksiyonları hiç çağırabilmesi
-- gerekmiyor.
revoke execute on function admin_list_reports(text, int, int) from public, anon;
revoke execute on function admin_get_report(uuid) from public, anon;
revoke execute on function admin_assign_report(uuid) from public, anon;
revoke execute on function admin_resolve_report(uuid, text, boolean) from public, anon;
revoke execute on function admin_get_user_360(uuid) from public, anon;
revoke execute on function admin_remove_content(text, uuid) from public, anon;
revoke execute on function admin_moderate_user(uuid, text, text, timestamptz) from public, anon;
revoke execute on function admin_set_app_config(text, jsonb) from public, anon;
revoke execute on function admin_list_app_config() from public, anon;
revoke execute on function admin_upsert_testimonial(uuid, text, text, text, text, boolean) from public, anon;
revoke execute on function admin_list_testimonials() from public, anon;
revoke execute on function admin_set_collection_published(uuid, boolean) from public, anon;
revoke execute on function admin_upsert_collection_translation(uuid, text, text, text) from public, anon;
revoke execute on function admin_list_collections() from public, anon;

grant execute on function admin_list_reports(text, int, int) to authenticated;
grant execute on function admin_get_report(uuid) to authenticated;
grant execute on function admin_assign_report(uuid) to authenticated;
grant execute on function admin_resolve_report(uuid, text, boolean) to authenticated;
grant execute on function admin_get_user_360(uuid) to authenticated;
grant execute on function admin_remove_content(text, uuid) to authenticated;
grant execute on function admin_moderate_user(uuid, text, text, timestamptz) to authenticated;
grant execute on function admin_set_app_config(text, jsonb) to authenticated;
grant execute on function admin_list_app_config() to authenticated;
grant execute on function admin_upsert_testimonial(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function admin_list_testimonials() to authenticated;
grant execute on function admin_set_collection_published(uuid, boolean) to authenticated;
grant execute on function admin_upsert_collection_translation(uuid, text, text, text) to authenticated;
grant execute on function admin_list_collections() to authenticated;

-- ============================================================================
-- account-deletion cron (PRD 10.2) — Faz 1'in tmdb_sync_daily deseniyle aynı.
-- ============================================================================
select cron.schedule(
  'account_deletion_daily',
  '0 5 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/account-deletion',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);
