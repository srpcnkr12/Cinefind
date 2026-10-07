-- ============================================================================
-- Başlangıç koleksiyonları (PRD 6.5) + kural tabanlı tazeleme
-- ============================================================================
-- Koleksiyonlar yalnızca fixture modunda doğabiliyordu (`seedCollections`,
-- tmdb-sync). Gerçek TMDB modunda kod bunu bilinçli olarak atlıyor, çünkü PRD
-- 6.5'e göre koleksiyonlar editoryal. Sonuç: gerçek katalogla `/explore`
-- tamamen boş kalıyordu ve admin panelinde koleksiyon OLUŞTURACAK bir yol da
-- yoktu (mevcut RPC'ler yalnızca yayın durumu ve çeviri düzenliyor).
--
-- Bu migration iki şey yapıyor:
--   1. Koleksiyonları ve TR/EN metinlerini oluşturuyor (katalogdan bağımsız).
--   2. `refresh_curated_collections()` ile film üyeliğini kuraldan üretiyor.
--
-- Üyelik neden kuralla üretiliyor: katalog `tmdb-sync` ile çalışma zamanında
-- büyüyor; sabit film listesi ilk senkrondan sonra eskir. Fonksiyon yeniden
-- çalıştırılabilir, böylece yeni filmler ilgili koleksiyonlara kendiliğinden
-- girer.
--
-- SINIR: bu gerçek küratörlük değil, makul bir başlangıç. PRD 6.5'in
-- "Yeşilçam Klasikleri", "Auteur Yönetmenler" ve "Festival Favorileri"
-- koleksiyonları BİLİNÇLİ OLARAK dışarıda bırakıldı: ilki için katalogda
-- 1990 öncesi yalnızca 4 Türkçe film var, diğer ikisi TMDB'de bulunmayan
-- (festival seçkisi, auteur tanımı) editoryal bilgi gerektiriyor. Bunlar
-- insan küratörlüğü gerektiriyor; admin paneli metinleri düzenlemeye ve
-- yayından kaldırmaya zaten izin veriyor.
-- ============================================================================

insert into collections (slug, kind, is_published, sort_order) values
  ('yeni-turk-sinemasi',     'curated', true, 10),
  ('dunya-sinemasi',         'curated', true, 20),
  ('modern-klasikler',       'curated', true, 30),
  ('ilk-randevu',            'mood',    true, 40),
  ('birlikte-aglanacak',     'mood',    true, 50),
  ('bilim-kurgu-fantastik',  'genre',   true, 60),
  ('gerilim-gizem',          'genre',   true, 70),
  ('animasyon',              'genre',   true, 80)
on conflict (slug) do nothing;

insert into collection_translations (collection_id, locale, title, intro, seo_description)
select c.id, t.locale, t.title, t.intro, t.seo
from collections c
join (values
  ('yeni-turk-sinemasi','tr','Yeni Türk Sineması','2000 sonrası Türkiye''de çekilmiş, kendi dilini arayan filmler.','2000 sonrası Türk sinemasından seçilmiş filmler.'),
  ('yeni-turk-sinemasi','en','New Turkish Cinema','Films made in Turkey since 2000, each looking for a language of its own.','A selection of Turkish films made since 2000.'),
  ('dunya-sinemasi','tr','Dünya Sinemasından','İngilizce ve Türkçe dışındaki dillerde çekilmiş filmler — altyazıdan korkmayanlara.','İngilizce ve Türkçe dışı dillerde çekilmiş filmler.'),
  ('dunya-sinemasi','en','From World Cinema','Films in languages other than English and Turkish — for those who don''t mind subtitles.','Films in languages other than English and Turkish.'),
  ('modern-klasikler','tr','Modern Klasikler','2000 sonrasında çıkmış, hakkında hâlâ konuşulan filmler.','2000 sonrasının en çok konuşulan filmleri.'),
  ('modern-klasikler','en','Modern Classics','Films released since 2000 that people still argue about.','The most talked-about films since 2000.'),
  ('ilk-randevu','tr','İlk Randevu Filmleri','Uzun sürmeyen, sessizliği doldurmayı kolaylaştıran filmler.','İlk buluşmada izlemek için kısa ve rahat filmler.'),
  ('ilk-randevu','en','First Date Films','Short enough to leave time for talking, light enough to make it easy.','Short, easy films for a first date.'),
  ('birlikte-aglanacak','tr','Birlikte Ağlanacak Filmler','Jenerik aktığında kimse önce konuşmak istemiyor.','Birlikte izlenecek duygusal dramalar.'),
  ('birlikte-aglanacak','en','Films to Cry Together','When the credits roll, nobody wants to speak first.','Emotional dramas to watch together.'),
  ('bilim-kurgu-fantastik','tr','Bilim Kurgu ve Fantastik','Kuralları baştan kurulan dünyalar.','Bilim kurgu ve fantastik filmler.'),
  ('bilim-kurgu-fantastik','en','Science Fiction and Fantasy','Worlds whose rules are written from scratch.','Science fiction and fantasy films.'),
  ('gerilim-gizem','tr','Gerilim ve Gizem','Sonunu tahmin etmeye çalışırken geçen filmler.','Gerilim ve gizem filmleri.'),
  ('gerilim-gizem','en','Thriller and Mystery','Films you spend trying to guess the ending of.','Thriller and mystery films.'),
  ('animasyon','tr','Animasyon','Çizgi film değil, animasyon — yetişkinler için olanlar dahil.','Yetişkinler için de animasyon filmleri.'),
  ('animasyon','en','Animation','Not cartoons — animation, including the ones made for adults.','Animated films, including those for adults.')
) as t(slug, locale, title, intro, seo) on t.slug = c.slug
on conflict (collection_id, locale) do nothing;

-- ============================================================================
-- Üyeliği kuraldan üret. Yeniden çalıştırılabilir; her seferinde bu
-- koleksiyonların film listesini baştan kurar (elle eklenen koleksiyonlara
-- dokunmaz — yalnızca aşağıdaki slug'ları yönetir).
-- ============================================================================
create or replace function refresh_curated_collections()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_managed text[] := array[
    'yeni-turk-sinemasi','dunya-sinemasi','modern-klasikler','ilk-randevu',
    'birlikte-aglanacak','bilim-kurgu-fantastik','gerilim-gizem','animasyon'
  ];
  v_limit constant int := 24;
  v_total int := 0;
begin
  delete from collection_films cf
  using collections c
  where cf.collection_id = c.id and c.slug = any (v_managed);

  with rules as (
    select f.id as film_id, r.slug,
           row_number() over (
             partition by r.slug order by f.tmdb_popularity desc nulls last, f.id
           ) as rn
    from films f
    join lateral (
      select 'yeni-turk-sinemasi'::text as slug
      where f.original_language = 'tr' and f.release_date >= date '2000-01-01'
      union all
      select 'dunya-sinemasi'
      where f.original_language not in ('en', 'tr')
      union all
      select 'modern-klasikler'
      where f.release_date >= date '2000-01-01'
      union all
      select 'ilk-randevu'
      where coalesce(f.runtime, 999) <= 120
        and exists (
          select 1 from film_genres fg join genres g on g.id = fg.genre_id
          where fg.film_id = f.id and g.slug in ('romance', 'comedy')
        )
      union all
      select 'birlikte-aglanacak'
      where exists (
          select 1 from film_genres fg join genres g on g.id = fg.genre_id
          where fg.film_id = f.id and g.slug = 'drama'
        )
      union all
      select 'bilim-kurgu-fantastik'
      where exists (
          select 1 from film_genres fg join genres g on g.id = fg.genre_id
          where fg.film_id = f.id and g.slug in ('science-fiction', 'fantasy')
        )
      union all
      select 'gerilim-gizem'
      where exists (
          select 1 from film_genres fg join genres g on g.id = fg.genre_id
          where fg.film_id = f.id and g.slug in ('thriller', 'mystery')
        )
      union all
      select 'animasyon'
      where exists (
          select 1 from film_genres fg join genres g on g.id = fg.genre_id
          where fg.film_id = f.id and g.slug = 'animation'
        )
    ) r on true
    where f.adult = false
  )
  insert into collection_films (collection_id, film_id, position)
  select c.id, rules.film_id, rules.rn
  from rules join collections c on c.slug = rules.slug
  where rules.rn <= v_limit;

  get diagnostics v_total = row_count;

  -- Kapak görselleri: her koleksiyonun ilk 3 filmi.
  update collections c
  set cover_film_ids = coalesce(sub.ids, '{}')
  from (
    select cf.collection_id, array_agg(cf.film_id order by cf.position) filter (where cf.position <= 3) as ids
    from collection_films cf group by cf.collection_id
  ) sub
  where sub.collection_id = c.id and c.slug = any (v_managed);

  return v_total;
end;
$$;

revoke execute on function refresh_curated_collections() from public, anon;
grant execute on function refresh_curated_collections() to service_role;

select refresh_curated_collections();
