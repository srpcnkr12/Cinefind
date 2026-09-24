-- ============================================================================
-- Onboarding'e "favori kategori seç" adımı (taste-test'ten önce).
-- Kullanıcı geri bildirimi: taste-test'in gösterdiği filmler artık tamamen
-- rastgele değil, kullanıcının seçtiği türlerden ağırlıklı geliyor.
-- ============================================================================

alter table profiles
  add column favorite_genre_ids uuid[] not null default '{}';

-- ============================================================================
-- get_genres — onboarding'in tür seçim ekranı için localized tür listesi.
-- ============================================================================
create or replace function get_genres()
returns table (id uuid, slug text, name text)
language sql
security invoker
as $$
  select g.id, g.slug, coalesce(gt.name, g.slug)
  from genres g
  left join genre_translations gt on gt.genre_id = g.id and gt.locale = 'tr'
  order by 3;
$$;

grant execute on function get_genres() to authenticated;

-- ============================================================================
-- get_taste_test_deck — artık `profiles.favorite_genre_ids` doluysa deck'i
-- önce seçilen türlerden dolduruyor, eksik kalırsa rastgele filmle
-- tamamlıyor (tür havuzu deck_size'dan küçükse deck'in boş/eksik kalmaması
-- için). Tür seçilmemişse (eski davranış) tamamen rastgele.
-- ============================================================================
create or replace function get_taste_test_deck(deck_size int default 30)
returns table (film_id uuid, slug text, title text, poster_path text, release_year int)
language plpgsql
security invoker
as $$
declare
  v_genre_ids uuid[];
begin
  select p.favorite_genre_ids into v_genre_ids from profiles p where p.id = auth.uid();

  if v_genre_ids is null or array_length(v_genre_ids, 1) is null then
    return query
      select f.id, f.slug, coalesce(ft.title, f.original_title), f.poster_path,
             extract(year from f.release_date)::int
      from films f
      left join film_translations ft on ft.film_id = f.id and ft.locale = 'tr'
      where f.tmdb_synced_at is not null and f.adult = false
      order by random()
      limit deck_size;
    return;
  end if;

  return query
  with genre_matched as (
    select f.id, f.slug, coalesce(ft.title, f.original_title) as title,
           f.poster_path, extract(year from f.release_date)::int as release_year
    from films f
    left join film_translations ft on ft.film_id = f.id and ft.locale = 'tr'
    where f.tmdb_synced_at is not null and f.adult = false
      and exists (select 1 from film_genres fg where fg.film_id = f.id and fg.genre_id = any(v_genre_ids))
    order by random()
    limit deck_size
  ),
  filler as (
    select f.id, f.slug, coalesce(ft.title, f.original_title) as title,
           f.poster_path, extract(year from f.release_date)::int as release_year
    from films f
    left join film_translations ft on ft.film_id = f.id and ft.locale = 'tr'
    where f.tmdb_synced_at is not null and f.adult = false
      and f.id not in (select gm.id from genre_matched gm)
    order by random()
    limit greatest(deck_size - (select count(*) from genre_matched), 0)
  )
  select * from genre_matched
  union all
  select * from filler;
end;
$$;

grant execute on function get_taste_test_deck(int) to authenticated;
