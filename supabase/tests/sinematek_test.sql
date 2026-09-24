BEGIN;
SELECT plan(7);

-- ============================================================================
-- Test kullanıcıları
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'sinematek1@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'sinematek2@test.com', '', now(), now(), now(), '{}', '{}');

-- ============================================================================
-- upsert_user_film → yeniden hesap kuyruğuna düşme
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select upsert_user_film((select id from films order by id limit 1), 'watched', 4.5, true);

select is(
  (select count(*)::int from compat_recompute_queue where user_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'upsert_user_film sonrası kullanıcı yeniden hesap kuyruğuna düşüyor'
);

-- ============================================================================
-- add_diary_entry: watch_count artıyor, first_watched_on set ediliyor
-- ============================================================================
select add_diary_entry((select id from films order by id limit 1), (current_date - interval '2 days')::date, 5, false, 'cinema', 'harika bir film', false);
select add_diary_entry((select id from films order by id limit 1), current_date, 5, true, 'home', null, false);

select is(
  (select watch_count from user_films where user_id = '33333333-3333-3333-3333-333333333333' and film_id = (select id from films order by id limit 1)),
  2,
  'add_diary_entry her çağrıda watch_count''u artırıyor'
);

select is(
  (select first_watched_on from user_films where user_id = '33333333-3333-3333-3333-333333333333' and film_id = (select id from films order by id limit 1)),
  (current_date - interval '2 days')::date,
  'first_watched_on en erken izleme tarihini tutuyor'
);

select is(
  (select count(*)::int from diary_entries where user_id = '33333333-3333-3333-3333-333333333333'),
  2,
  'iki günlük girişi de ayrı satırlar olarak kaydediliyor'
);

-- ============================================================================
-- set_top_four: 4'ten az filmle de çalışıyor (PRD 10.1: "tam 4 veya daha az")
-- ============================================================================
select lives_ok(
  $$ select set_top_four(array[(select id from films order by id limit 1), (select id from films order by id offset 1 limit 1)]) $$,
  'set_top_four 2 filmle hata vermeden çalışıyor'
);

-- ============================================================================
-- film_lines: başka kullanıcıya hiç görünmüyor
-- ============================================================================
select add_film_line((select id from films order by id limit 1), 'Test repliği', 'Karakter', false);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select is(
  (select count(*)::int from film_lines where user_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'başka kullanıcının repliği hiçbir sorguda dönmüyor'
);

select is(
  (select count(*)::int from diary_entries where user_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'başka kullanıcının günlük girişi hiçbir sorguda dönmüyor'
);

reset role;

SELECT * FROM finish();
ROLLBACK;
