-- Faz 4: Sinematek (PRD bölüm 9.3, 19).
-- `user_films` Faz 3'te onboarding için açılmıştı (bkz. docs/adr/0006); burada genişletiliyor.

-- ============================================================================
-- user_films — Faz 4 alanları
-- ============================================================================
alter table user_films
  add column first_watched_on date,
  add column watch_count int not null default 0;

-- ============================================================================
-- diary_entries
-- ============================================================================
create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  film_id uuid not null references films (id) on delete cascade,
  watched_on date not null,
  rating numeric(2, 1) check (rating is null or (rating >= 0.5 and rating <= 5)),
  is_rewatch boolean not null default false,
  venue text check (venue in ('cinema', 'home', 'festival', 'other')),
  watched_with_user_id uuid references profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 1000),
  contains_spoiler boolean not null default false,
  created_at timestamptz not null default now()
);

alter table diary_entries enable row level security;
create policy "diary_entries_owner_all" on diary_entries for all using (auth.uid() = user_id);

-- ============================================================================
-- film_lines (replikler) — Faz 7 (sosyal akış) öncesi yalnızca sahibine görünür.
-- bkz. docs/adr/0007-film-lines-private-until-social.md
-- ============================================================================
create table film_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  film_id uuid not null references films (id) on delete cascade,
  text text not null check (char_length(text) <= 280),
  character_name text,
  contains_spoiler boolean not null default false,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table film_lines enable row level security;
create policy "film_lines_owner_all" on film_lines for all using (auth.uid() = user_id);

-- ============================================================================
-- taste_recompute_queue — Faz 5'in eşleşme algoritmasının tüketeceği kuyruk.
-- ============================================================================
create table taste_recompute_queue (
  user_id uuid primary key references profiles (id) on delete cascade,
  queued_at timestamptz not null default now()
);

alter table taste_recompute_queue enable row level security;
create policy "taste_recompute_queue_owner_all" on taste_recompute_queue for all using (auth.uid() = user_id);

create or replace function enqueue_taste_recompute(p_user_id uuid)
returns void
language sql
security invoker
as $$
  insert into taste_recompute_queue (user_id, queued_at)
  values (p_user_id, now())
  on conflict (user_id) do update set queued_at = excluded.queued_at;
$$;

grant execute on function enqueue_taste_recompute(uuid) to authenticated;

-- ============================================================================
-- RPC'ler
-- ============================================================================

-- Hızlı yol: film ara → puanla, 2 dokunuşu geçmez.
create or replace function upsert_user_film(
  p_film_id uuid,
  p_status text,
  p_rating numeric default null,
  p_liked boolean default null
)
returns void
language plpgsql
security invoker
as $$
begin
  insert into user_films (user_id, film_id, status, rating, liked, updated_at)
  values (auth.uid(), p_film_id, p_status, p_rating, p_liked, now())
  on conflict (user_id, film_id)
  do update set status = excluded.status, rating = excluded.rating, liked = excluded.liked, updated_at = now();

  perform enqueue_taste_recompute(auth.uid());
end;
$$;

grant execute on function upsert_user_film(uuid, text, numeric, boolean) to authenticated;

create or replace function add_diary_entry(
  p_film_id uuid,
  p_watched_on date,
  p_rating numeric default null,
  p_is_rewatch boolean default false,
  p_venue text default null,
  p_note text default null,
  p_contains_spoiler boolean default false
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into diary_entries (user_id, film_id, watched_on, rating, is_rewatch, venue, note, contains_spoiler)
  values (auth.uid(), p_film_id, p_watched_on, p_rating, p_is_rewatch, p_venue, p_note, p_contains_spoiler)
  returning id into v_id;

  insert into user_films (user_id, film_id, status, rating, first_watched_on, watch_count, updated_at)
  values (auth.uid(), p_film_id, 'watched', p_rating, p_watched_on, 1, now())
  on conflict (user_id, film_id)
  do update set
    status = 'watched',
    rating = coalesce(excluded.rating, user_films.rating),
    first_watched_on = least(coalesce(user_films.first_watched_on, excluded.first_watched_on), excluded.first_watched_on),
    watch_count = user_films.watch_count + 1,
    updated_at = now();

  perform enqueue_taste_recompute(auth.uid());

  return v_id;
end;
$$;

grant execute on function add_diary_entry(uuid, date, numeric, boolean, text, text, boolean) to authenticated;

create or replace function add_film_line(
  p_film_id uuid,
  p_text text,
  p_character_name text default null,
  p_contains_spoiler boolean default false
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid;
begin
  insert into film_lines (user_id, film_id, text, character_name, contains_spoiler)
  values (auth.uid(), p_film_id, p_text, p_character_name, p_contains_spoiler)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function add_film_line(uuid, text, text, boolean) to authenticated;

-- PRD 10.1: "Tam 4 veya daha az, sıralı" — Faz 3'teki onboarding sürümü tam 4 zorunlu kılıyordu.
create or replace function set_top_four(film_ids uuid[])
returns void
language plpgsql
security invoker
as $$
begin
  if array_length(film_ids, 1) is not null and array_length(film_ids, 1) > 4 then
    raise exception 'Kadrajım en fazla 4 film içerebilir';
  end if;

  update user_films set top_four_position = null where user_id = auth.uid() and top_four_position is not null;

  for i in 1..coalesce(array_length(film_ids, 1), 0) loop
    insert into user_films (user_id, film_id, top_four_position, liked)
    values (auth.uid(), film_ids[i], i, true)
    on conflict (user_id, film_id)
    do update set top_four_position = excluded.top_four_position, liked = true, updated_at = now();
  end loop;

  perform enqueue_taste_recompute(auth.uid());
end;
$$;

-- submit_taste_reactions (Faz 3) artık yeniden hesap kuyruğuna da düşer.
create or replace function submit_taste_reactions(reactions jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  r jsonb;
begin
  for r in select * from jsonb_array_elements(reactions) loop
    insert into user_films (user_id, film_id, status, liked, rating)
    values (
      auth.uid(),
      (r ->> 'filmId')::uuid,
      'watched',
      case r ->> 'reaction' when 'liked' then true when 'disliked' then false else null end,
      case r ->> 'reaction' when 'liked' then 4.5 when 'ok' then 3 when 'disliked' then 1.5 else null end
    )
    on conflict (user_id, film_id)
    do update set status = excluded.status, liked = excluded.liked, rating = excluded.rating, updated_at = now();
  end loop;

  perform enqueue_taste_recompute(auth.uid());
end;
$$;
