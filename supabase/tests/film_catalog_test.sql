BEGIN;
SELECT plan(9);

-- ============================================================================
-- Test verisi
-- ============================================================================
insert into films (id, tmdb_id, original_title, original_language, slug, adult, tmdb_synced_at)
values
  ('00000000-0000-0000-0000-000000000001', 1001, '花樣年華', 'zh', 'ask-zamani-test', false, now()),
  ('00000000-0000-0000-0000-000000000002', 1002, 'Adult Test Film', 'en', 'adult-test-film', true, now());

insert into film_translations (film_id, locale, title)
values
  ('00000000-0000-0000-0000-000000000001', 'tr', 'Aşk Zamanı'),
  ('00000000-0000-0000-0000-000000000001', 'en', 'In the Mood for Love'),
  ('00000000-0000-0000-0000-000000000002', 'en', 'Adult Test Film Ask Zamani');

insert into collections (id, slug, kind, is_published)
values
  ('00000000-0000-0000-0000-000000000010', 'published-test', 'curated', true),
  ('00000000-0000-0000-0000-000000000011', 'draft-test', 'curated', false);

insert into collection_translations (collection_id, locale, title)
values
  ('00000000-0000-0000-0000-000000000010', 'tr', 'Yayınlanmış Test'),
  ('00000000-0000-0000-0000-000000000011', 'tr', 'Taslak Test');

-- ============================================================================
-- normalize_tr: aksanlı/aksansız/büyük-küçük harf aynı sonucu vermeli
-- ============================================================================
select is(
  normalize_tr('Aşk Zamanı'),
  normalize_tr('ask zamani'),
  'normalize_tr aksanlı ve aksansız girdi için aynı sonucu üretir'
);

select is(
  normalize_tr('AŞK ZAMANI'),
  normalize_tr('ask zamani'),
  'normalize_tr büyük/küçük harf farkını yok sayar'
);

-- ============================================================================
-- search_films: PRD kabul kriteri — üç farklı sorgu aynı filmi ilk sırada döndürmeli
-- ============================================================================
select is(
  (select title from search_films('ask zamani', 1) limit 1),
  'Aşk Zamanı',
  'search_films: aksansız Türkçe arama doğru filmi buluyor'
);

select is(
  (select title from search_films('Aşk Zamanı', 1) limit 1),
  'Aşk Zamanı',
  'search_films: aksanlı Türkçe arama doğru filmi buluyor'
);

select is(
  (select title from search_films('in the mood for love', 1) limit 1),
  'In the Mood for Love',
  'search_films: orijinal (İngilizce) başlıkla arama doğru filmi buluyor'
);

select ok(
  not exists (
    select 1 from search_films('ask zamani', 10) where title ilike '%adult%'
  ),
  'search_films: adult=true filmler hiçbir sonuçta görünmüyor'
);

-- ============================================================================
-- RLS: herkes okuyabilir, yalnızca service_role yazabilir
-- ============================================================================
set local role anon;

select ok(
  (select count(*) from films) >= 2,
  'anon rolü films tablosunu okuyabiliyor'
);

select throws_ok(
  $$ insert into films (original_title, original_language, slug) values ('x', 'en', 'x-anon-insert') $$,
  '42501',
  null,
  'anon rolü films tablosuna yazamıyor (RLS reddediyor)'
);

reset role;

-- Taslak (is_published=false) koleksiyon anon'a görünmemeli
set local role anon;
select is(
  (select count(*)::int from collections where slug = 'draft-test'),
  0,
  'yayınlanmamış koleksiyon anon rolüne görünmüyor'
);
reset role;

SELECT * FROM finish();
ROLLBACK;
