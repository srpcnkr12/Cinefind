-- Faz 7: Sosyal akış (PRD bölüm 9.4, 10.1, 14.1, 19).

-- ============================================================================
-- username otomatik üretimi (gerekçe #3) — onboarding tamamlanınca çağrılır.
-- ============================================================================
create or replace function ensure_username()
returns void
language plpgsql
security invoker
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 0;
begin
  if (select username from profiles where id = auth.uid()) is not null then
    return;
  end if;

  v_base := regexp_replace(normalize_tr(coalesce((select display_name from profiles where id = auth.uid()), 'user')), '[^a-z0-9]+', '', 'g');
  if v_base = '' then
    v_base := 'user';
  end if;

  v_candidate := v_base;
  while exists (select 1 from profiles where username = v_candidate) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || v_suffix::text;
  end loop;

  update profiles set username = v_candidate where id = auth.uid();
end;
$$;

create or replace function update_onboarding_step(new_step text)
returns void
language plpgsql
security invoker
as $$
begin
  update profiles set
    onboarding_step = new_step,
    discoverable = case when new_step = 'completed' then true else discoverable end
  where id = auth.uid();

  if new_step = 'completed' then
    perform ensure_username();
  end if;
end;
$$;

-- ============================================================================
-- follows (görünürlük yardımcı fonksiyonları buna referans verdiği için önce)
-- ============================================================================
create table follows (
  follower_id uuid not null references profiles (id) on delete cascade,
  followee_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

alter table follows enable row level security;
create policy "follows_participant_select" on follows for select using (auth.uid() = follower_id or auth.uid() = followee_id);
create policy "follows_follower_insert" on follows for insert with check (auth.uid() = follower_id);
create policy "follows_followee_update" on follows for update using (auth.uid() = followee_id);
create policy "follows_follower_delete" on follows for delete using (auth.uid() = follower_id);

-- ============================================================================
-- Görünürlük yardımcı fonksiyonları — RLS'te tekrar tekrar kullanılacak.
-- ============================================================================
create or replace function can_view_user_content(p_viewer uuid, p_author uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_viewer = p_author
    or (
      not exists (
        select 1 from blocks b
        where (b.blocker_id = p_viewer and b.blocked_id = p_author)
           or (b.blocker_id = p_author and b.blocked_id = p_viewer)
      )
      and (
        not coalesce((select is_private from profiles where id = p_author), false)
        or exists (select 1 from follows f where f.follower_id = p_viewer and f.followee_id = p_author and f.status = 'accepted')
      )
    );
$$;

-- Faz 7 gerekçe #4: gizli hesapta post'un kendi `visibility`'si geçersiz kılınır.
create or replace function can_view_post(p_viewer uuid, p_author_id uuid, p_visibility text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    p_viewer = p_author_id
    or (
      not exists (
        select 1 from blocks b
        where (b.blocker_id = p_viewer and b.blocked_id = p_author_id)
           or (b.blocker_id = p_author_id and b.blocked_id = p_viewer)
      )
      and (
        case when coalesce((select is_private from profiles where id = p_author_id), false)
          then exists (select 1 from follows f where f.follower_id = p_viewer and f.followee_id = p_author_id and f.status = 'accepted')
          else p_visibility = 'public'
            or exists (select 1 from follows f where f.follower_id = p_viewer and f.followee_id = p_author_id and f.status = 'accepted')
        end
      )
    );
$$;

-- ============================================================================
-- user_lists / user_list_items
-- ============================================================================
create table user_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now()
);

alter table user_lists enable row level security;
create policy "user_lists_visible_select" on user_lists for select using (can_view_user_content(auth.uid(), owner_id));
create policy "user_lists_owner_insert" on user_lists for insert with check (owner_id = auth.uid());
create policy "user_lists_owner_update" on user_lists for update using (owner_id = auth.uid());
create policy "user_lists_owner_delete" on user_lists for delete using (owner_id = auth.uid());

create table user_list_items (
  list_id uuid not null references user_lists (id) on delete cascade,
  film_id uuid not null references films (id) on delete cascade,
  position smallint not null default 0,
  added_at timestamptz not null default now(),
  primary key (list_id, film_id)
);

alter table user_list_items enable row level security;
create policy "user_list_items_visible_select" on user_list_items for select using (
  exists (select 1 from user_lists l where l.id = user_list_items.list_id and can_view_user_content(auth.uid(), l.owner_id))
);
create policy "user_list_items_owner_write" on user_list_items for all using (
  exists (select 1 from user_lists l where l.id = user_list_items.list_id and l.owner_id = auth.uid())
);

-- ============================================================================
-- posts
-- ============================================================================
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id) on delete cascade,
  type text not null check (type in ('text', 'review', 'line', 'list', 'watched')),
  film_id uuid references films (id) on delete set null,
  line_id uuid references film_lines (id) on delete set null,
  list_id uuid references user_lists (id) on delete set null,
  body text check (body is null or char_length(body) <= 2000),
  rating numeric(2, 1) check (rating is null or (rating >= 0.5 and rating <= 5)),
  contains_spoiler boolean not null default false,
  repost_of_id uuid references posts (id) on delete set null,
  quote_of_id uuid references posts (id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public', 'followers')),
  like_count int not null default 0,
  comment_count int not null default 0,
  repost_count int not null default 0,
  bookmark_count int not null default 0,
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'pending', 'rejected')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index posts_author_created_idx on posts (author_id, created_at desc);
create index posts_film_created_idx on posts (film_id, created_at desc);

alter table posts enable row level security;
create policy "posts_visible_select" on posts for select using (
  deleted_at is null and can_view_post(auth.uid(), author_id, visibility)
);
create policy "posts_owner_insert" on posts for insert with check (author_id = auth.uid());
create policy "posts_owner_update" on posts for update using (author_id = auth.uid());

-- ============================================================================
-- comments
-- ============================================================================
create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  author_id uuid not null references profiles (id) on delete cascade,
  parent_id uuid references comments (id) on delete cascade,
  body text not null check (char_length(body) <= 1000),
  contains_spoiler boolean not null default false,
  like_count int not null default 0,
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'pending', 'rejected')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index comments_post_created_idx on comments (post_id, created_at desc);

alter table comments enable row level security;
create policy "comments_visible_select" on comments for select using (
  deleted_at is null
  and exists (
    select 1 from posts p where p.id = comments.post_id and p.deleted_at is null and can_view_post(auth.uid(), p.author_id, p.visibility)
  )
);
create policy "comments_owner_insert" on comments for insert with check (
  author_id = auth.uid()
  and exists (select 1 from posts p where p.id = comments.post_id and can_view_post(auth.uid(), p.author_id, p.visibility))
);
create policy "comments_owner_update" on comments for update using (author_id = auth.uid());

-- ============================================================================
-- post_likes, comment_likes, bookmarks — basit sahiplik; görünürlük üst
-- içeriğin RLS'i üzerinden zaten dolaylı olarak sınırlanır.
-- ============================================================================
create table post_likes (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table post_likes enable row level security;
create policy "post_likes_owner_all" on post_likes for all using (auth.uid() = user_id);

create table comment_likes (
  comment_id uuid not null references comments (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table comment_likes enable row level security;
create policy "comment_likes_owner_all" on comment_likes for all using (auth.uid() = user_id);

create table bookmarks (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table bookmarks enable row level security;
create policy "bookmarks_owner_all" on bookmarks for all using (auth.uid() = user_id);

-- ============================================================================
-- mentions
-- ============================================================================
create table mentions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('post', 'comment')),
  source_id uuid not null,
  mentioned_user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, mentioned_user_id)
);

alter table mentions enable row level security;
create policy "mentions_select" on mentions for select using (auth.uid() = mentioned_user_id);
create policy "mentions_insert" on mentions for insert with check (
  (source_type = 'post' and exists (select 1 from posts p where p.id = source_id and p.author_id = auth.uid()))
  or (source_type = 'comment' and exists (select 1 from comments c where c.id = source_id and c.author_id = auth.uid()))
);

-- ============================================================================
-- notifications.type genişletmesi (ADR-0011'in öngördüğü)
-- ============================================================================
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('new_message', 'mention', 'follow_request', 'follow_accepted', 'like', 'comment'));

-- ============================================================================
-- film_lines: ikinci select politikası (ADR-0007'nin öngördüğü genişleme).
-- Yalnızca onaylı + spoiler'sız + yazarı `web_posts_public` olan repliği
-- herkese açar (web film sayfasındaki "Toplulukta" bölümü için).
-- ============================================================================
create policy "film_lines_public_web_select" on film_lines for select using (
  moderation_status = 'approved'
  and contains_spoiler = false
  and exists (select 1 from profiles pr where pr.id = film_lines.user_id and pr.web_posts_public = true and pr.is_private = false)
);

-- ============================================================================
-- Sayaç trigger'ları (kabul kriteri: "sayaçlar trigger ile tutarlı")
-- ============================================================================
create or replace function bump_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger post_likes_count_trigger after insert or delete on post_likes for each row execute function bump_post_like_count();

create or replace function bump_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update comments set like_count = like_count + 1 where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;
create trigger comment_likes_count_trigger after insert or delete on comment_likes for each row execute function bump_comment_like_count();

create or replace function bump_bookmark_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set bookmark_count = bookmark_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
create trigger bookmarks_count_trigger after insert or delete on bookmarks for each row execute function bump_bookmark_count();

-- Yorum sayacı: ekleme + yumuşak silme (hard delete bu fazda kapsam dışı).
create or replace function bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  end if;
  return null;
end;
$$;
create trigger comments_count_trigger after insert or update on comments for each row execute function bump_comment_count();

-- Repost sayacı: yalnızca ekleme (bu fazda repost'un hard/silinmesi kapsam dışı).
create or replace function bump_repost_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.repost_of_id is not null then
    update posts set repost_count = repost_count + 1 where id = new.repost_of_id;
  end if;
  return null;
end;
$$;
create trigger posts_repost_count_trigger after insert on posts for each row execute function bump_repost_count();

-- ============================================================================
-- Metin moderasyonu (gerekçe #1) — Faz 6'nın `contains_scam_signal`'ını reuse eder.
-- ============================================================================
create or replace function text_moderation_status(p_body text)
returns text
language sql
immutable
as $$
  select case
    when p_body is null then 'approved'
    when p_body ~* '\m(salak|aptal|gerizekalı|orospu|piç|fuck|shit|bitch|asshole)\M' then 'pending'
    when contains_scam_signal(p_body) then 'pending'
    else 'approved'
  end;
$$;

-- ============================================================================
-- Bahsetme ayrıştırma (paylaşılan yardımcı) — engellenmemişse bildirim yazar.
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

-- ============================================================================
-- RPC'ler
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
begin
  insert into posts (
    author_id, type, body, film_id, line_id, list_id, rating, contains_spoiler,
    visibility, repost_of_id, quote_of_id, moderation_status
  )
  values (
    auth.uid(), p_type, p_body, p_film_id, p_line_id, p_list_id, p_rating, p_contains_spoiler,
    p_visibility, p_repost_of_id, p_quote_of_id, text_moderation_status(p_body)
  )
  returning * into v_row;

  perform process_mentions('post', v_row.id, p_body, auth.uid());
  return v_row;
end;
$$;

grant execute on function create_post(text, text, uuid, uuid, uuid, numeric, boolean, text, uuid, uuid) to authenticated;

create or replace function delete_post(p_post_id uuid)
returns void
language sql
security invoker
as $$
  update posts set deleted_at = now() where id = p_post_id and author_id = auth.uid();
$$;

grant execute on function delete_post(uuid) to authenticated;

create or replace function add_comment(
  p_post_id uuid,
  p_body text,
  p_parent_id uuid default null,
  p_contains_spoiler boolean default false
)
returns comments
language plpgsql
security invoker
as $$
declare
  v_row comments;
  v_post_author uuid;
begin
  insert into comments (post_id, author_id, parent_id, body, contains_spoiler, moderation_status)
  values (p_post_id, auth.uid(), p_parent_id, p_body, p_contains_spoiler, text_moderation_status(p_body))
  returning * into v_row;

  select author_id into v_post_author from posts where id = p_post_id;
  if v_post_author is not null and v_post_author != auth.uid() then
    insert into notifications (user_id, type, actor_id, entity)
      values (v_post_author, 'comment', auth.uid(), jsonb_build_object('postId', p_post_id, 'commentId', v_row.id));
  end if;

  perform process_mentions('comment', v_row.id, p_body, auth.uid());
  return v_row;
end;
$$;

grant execute on function add_comment(uuid, text, uuid, boolean) to authenticated;

create or replace function toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_liked boolean;
begin
  if exists (select 1 from post_likes where post_id = p_post_id and user_id = auth.uid()) then
    delete from post_likes where post_id = p_post_id and user_id = auth.uid();
    v_liked := false;
  else
    insert into post_likes (post_id, user_id) values (p_post_id, auth.uid());
    v_liked := true;
    insert into notifications (user_id, type, actor_id, entity)
      select author_id, 'like', auth.uid(), jsonb_build_object('postId', p_post_id)
      from posts where id = p_post_id and author_id != auth.uid();
  end if;
  return v_liked;
end;
$$;

grant execute on function toggle_post_like(uuid) to authenticated;

create or replace function toggle_comment_like(p_comment_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_liked boolean;
begin
  if exists (select 1 from comment_likes where comment_id = p_comment_id and user_id = auth.uid()) then
    delete from comment_likes where comment_id = p_comment_id and user_id = auth.uid();
    v_liked := false;
  else
    insert into comment_likes (comment_id, user_id) values (p_comment_id, auth.uid());
    v_liked := true;
  end if;
  return v_liked;
end;
$$;

grant execute on function toggle_comment_like(uuid) to authenticated;

create or replace function toggle_bookmark(p_post_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_bookmarked boolean;
begin
  if exists (select 1 from bookmarks where post_id = p_post_id and user_id = auth.uid()) then
    delete from bookmarks where post_id = p_post_id and user_id = auth.uid();
    v_bookmarked := false;
  else
    insert into bookmarks (post_id, user_id) values (p_post_id, auth.uid());
    v_bookmarked := true;
  end if;
  return v_bookmarked;
end;
$$;

grant execute on function toggle_bookmark(uuid) to authenticated;

create or replace function create_list(p_title text, p_description text default null)
returns user_lists
language plpgsql
security invoker
as $$
declare
  v_row user_lists;
begin
  insert into user_lists (owner_id, title, description) values (auth.uid(), p_title, p_description) returning * into v_row;
  return v_row;
end;
$$;

grant execute on function create_list(text, text) to authenticated;

create or replace function add_list_item(p_list_id uuid, p_film_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  if not exists (select 1 from user_lists where id = p_list_id and owner_id = auth.uid()) then
    raise exception 'not_list_owner';
  end if;

  insert into user_list_items (list_id, film_id, position)
  values (p_list_id, p_film_id, coalesce((select max(position) + 1 from user_list_items where list_id = p_list_id), 0))
  on conflict (list_id, film_id) do nothing;
end;
$$;

grant execute on function add_list_item(uuid, uuid) to authenticated;

create or replace function request_follow(p_followee_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  v_status := case when coalesce((select is_private from profiles where id = p_followee_id), false) then 'pending' else 'accepted' end;

  insert into follows (follower_id, followee_id, status) values (auth.uid(), p_followee_id, v_status)
  on conflict (follower_id, followee_id) do update set status = excluded.status;

  if v_status = 'pending' then
    insert into notifications (user_id, type, actor_id, entity) values (p_followee_id, 'follow_request', auth.uid(), '{}');
  end if;

  return v_status;
end;
$$;

grant execute on function request_follow(uuid) to authenticated;

create or replace function respond_to_follow_request(p_follower_id uuid, p_accept boolean)
returns void
language plpgsql
security invoker
as $$
begin
  if p_accept then
    update follows set status = 'accepted' where follower_id = p_follower_id and followee_id = auth.uid();
    insert into notifications (user_id, type, actor_id, entity) values (p_follower_id, 'follow_accepted', auth.uid(), '{}');
  else
    delete from follows where follower_id = p_follower_id and followee_id = auth.uid();
  end if;
end;
$$;

grant execute on function respond_to_follow_request(uuid, boolean) to authenticated;

create or replace function unfollow(p_followee_id uuid)
returns void
language sql
security invoker
as $$
  delete from follows where follower_id = auth.uid() and followee_id = p_followee_id;
$$;

grant execute on function unfollow(uuid) to authenticated;

-- ============================================================================
-- get_public_profile — `profiles` RLS yalnızca sahibi/eşleşilen kişiyi
-- gösterdiği için (Faz 3/5), başka birinin sosyal profilini (Faz 7'nin
-- kullanıcı profili ekranı, takip akışı) görüntülemek için güvenli alanları
-- döndüren bir RPC gerekiyor — `get_discovery_deck`'in (Faz 5) izlediği aynı desen.
-- ============================================================================
create or replace function get_public_profile(p_username text)
returns table (
  id uuid, username text, display_name text, bio text, is_private boolean,
  intents text[], is_following boolean, follow_status text, is_followed_by boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id uuid;
begin
  select p.id into v_id from profiles p where p.username = p_username and p.deleted_at is null;
  if v_id is null then
    return;
  end if;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = v_id) or (b.blocker_id = v_id and b.blocked_id = auth.uid())
  ) then
    return;
  end if;

  return query
  select
    p.id, p.username, p.display_name, p.bio, p.is_private, p.intents,
    exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.status = 'accepted'),
    (select f.status from follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
    exists (select 1 from follows f where f.follower_id = p.id and f.followee_id = auth.uid() and f.status = 'accepted')
  from profiles p
  where p.id = v_id;
end;
$$;

grant execute on function get_public_profile(text) to authenticated;

create or replace function get_notifications(p_cursor int default 0, p_limit int default 30)
returns setof notifications
language sql
security invoker
stable
as $$
  select * from notifications where user_id = auth.uid() order by created_at desc limit p_limit offset p_cursor;
$$;

grant execute on function get_notifications(int, int) to authenticated;

create or replace function mark_notification_read(p_id uuid)
returns void
language sql
security invoker
as $$
  update notifications set read_at = now() where id = p_id and user_id = auth.uid();
$$;

grant execute on function mark_notification_read(uuid) to authenticated;

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
-- block_user güncellemesi: artık takipleri de siler (PRD 10.1).
-- ============================================================================
create or replace function block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_low uuid := least(v_me, p_user_id);
  v_high uuid := greatest(v_me, p_user_id);
begin
  insert into blocks (blocker_id, blocked_id) values (v_me, p_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  update matches set unmatched_at = now(), unmatched_by = v_me
  where user_low = v_low and user_high = v_high and unmatched_at is null;

  update conversations c set status = 'closed'
  from matches m
  where c.match_id = m.id and m.user_low = v_low and m.user_high = v_high;

  delete from swipes where (swiper_id = v_me and target_id = p_user_id) or (swiper_id = p_user_id and target_id = v_me);
  delete from follows where (follower_id = v_me and followee_id = p_user_id) or (follower_id = p_user_id and followee_id = v_me);
end;
$$;

-- ============================================================================
-- public_web_posts VIEW (PRD 9.4) — web yalnızca buradan okur.
-- Avatar dahil edilmiyor: profillerde ayrı bir "web'de fotoğraf göster" rızası
-- yok; en güvenli varsayılan hiç göstermemek.
-- ============================================================================
create view public_web_posts as
select
  p.id, p.type, p.film_id, p.body, p.rating, p.contains_spoiler,
  p.like_count, p.comment_count, p.created_at,
  pr.username, pr.display_name
from posts p
join profiles pr on pr.id = p.author_id
where pr.web_posts_public = true
  and pr.is_private = false
  and p.visibility = 'public'
  and p.deleted_at is null
  and p.moderation_status = 'approved';

grant select on public_web_posts to anon, authenticated;
