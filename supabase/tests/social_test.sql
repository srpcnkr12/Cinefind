BEGIN;
SELECT plan(18);

-- ============================================================================
-- Test kullanıcıları: A (biz), B (gizli hesap), C (herkese açık, engellenen),
-- D (public_web_posts test için).
-- ============================================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'soc1@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'soc2@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'soc3@test.com', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'soc4@test.com', '', now(), now(), now(), '{}', '{}');

update profiles set display_name = 'Ada', username = 'ada' where id = '77777777-0000-0000-0000-000000000001';
update profiles set display_name = 'Gizli Bora', username = 'gizlibora', is_private = true where id = '77777777-0000-0000-0000-000000000002';
update profiles set display_name = 'Cem' where id = '77777777-0000-0000-0000-000000000003';
update profiles set display_name = 'Deniz Web', web_posts_public = true where id = '77777777-0000-0000-0000-000000000004';

-- A, C'yi engelliyor.
insert into blocks (blocker_id, blocked_id) values ('77777777-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000003');

-- Bu test dosyasındaki kullanıcılar az önce oluşturulduğu için Faz 9'un
-- "yeni hesap" rate limitine takılır (`new_account_posts_per_hour`); testin
-- amacı bu değil, bu yüzden limit yükseltiliyor (bkz. discovery_matching_test.sql'in
-- app_config'i authenticated'e geçmeden önce ayarlama emsali).
update app_config set value = '100' where key in ('new_account_posts_per_hour', 'rate_limit_posts_per_hour');

-- ============================================================================
-- ensure_username
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000003","role":"authenticated"}';
select update_onboarding_step('completed');
reset role;

select ok(
  (select username from profiles where id = '77777777-0000-0000-0000-000000000003') is not null,
  'onboarding tamamlanınca otomatik username üretiliyor'
);

-- ============================================================================
-- Gizli hesap: takip etmeyen göremez, kabul edilmiş takipçi görebilir
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000002","role":"authenticated"}';
select create_post('text', 'Gizli hesabımın gönderisi');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from posts where author_id = '77777777-0000-0000-0000-000000000002'),
  0,
  'gizli hesabın gönderisi takip etmeyen biri tarafından görünmüyor'
);
reset role;

insert into follows (follower_id, followee_id, status) values
  ('77777777-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000002', 'accepted');

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from posts where author_id = '77777777-0000-0000-0000-000000000002'),
  1,
  'kabul edilmiş takipçi gizli hesabın gönderisini görebiliyor'
);
reset role;

delete from follows where follower_id = '77777777-0000-0000-0000-000000000001';

-- ============================================================================
-- request_follow: gizli hesapta pending, herkese açıkta accepted
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select is(request_follow('77777777-0000-0000-0000-000000000002'), 'pending', 'gizli hesaba takip isteği pending statüsünde');
select is(request_follow('77777777-0000-0000-0000-000000000004'), 'accepted', 'herkese açık hesaba takip isteği anında accepted');
reset role;

-- ============================================================================
-- Spoiler bayrağı RLS'te bozulmadan dönüyor
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000004","role":"authenticated"}';
select create_post('text', 'Spoiler''lı bir gönderi', null, null, null, null, true);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (select contains_spoiler from posts where author_id = '77777777-0000-0000-0000-000000000004' and type = 'text' order by created_at desc limit 1),
  'spoiler bayrağı RLS''ten geçtikten sonra da doğru dönüyor (istemci bulanıklaştıracak)'
);
reset role;

-- ============================================================================
-- Beğen/bırak: sayaç trigger ile tutarlı
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000004","role":"authenticated"}';
select create_post('text', 'Beğeni testi için gönderi');
reset role;

select is(
  (select like_count from posts where body = 'Beğeni testi için gönderi'),
  0,
  'yeni gönderi 0 beğeniyle başlıyor'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select toggle_post_like((select id from posts where body = 'Beğeni testi için gönderi'));
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000003","role":"authenticated"}';
select toggle_post_like((select id from posts where body = 'Beğeni testi için gönderi'));
reset role;

select is(
  (select like_count from posts where body = 'Beğeni testi için gönderi'),
  2,
  'iki farklı kullanıcı beğenince sayaç 2 oluyor'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select toggle_post_like((select id from posts where body = 'Beğeni testi için gönderi'));
reset role;

select is(
  (select like_count from posts where body = 'Beğeni testi için gönderi'),
  1,
  'bir kullanıcı beğenisini geri çekince sayaç 1''e düşüyor'
);

-- ============================================================================
-- Yorum sayacı: ekle → 1, yumuşak sil → 0
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select add_comment((select id from posts where body = 'Beğeni testi için gönderi'), 'Harika!');
reset role;

select is(
  (select comment_count from posts where body = 'Beğeni testi için gönderi'),
  1,
  'yorum eklenince comment_count 1 oluyor'
);

update comments set deleted_at = now() where post_id = (select id from posts where body = 'Beğeni testi için gönderi');

select is(
  (select comment_count from posts where body = 'Beğeni testi için gönderi'),
  0,
  'yorum yumuşak silinince comment_count 0''a dönüyor'
);

-- ============================================================================
-- Bahsetme: engellenmemiş kullanıcı bildirim alır, engellenen almaz
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000004","role":"authenticated"}';
select create_post('text', 'Selam @ada, filmini beğendim');
select create_post('text', (select 'Selam @' || username || ', bu görünmemeli' from profiles where id = '77777777-0000-0000-0000-000000000003'));
reset role;

select is(
  (select count(*)::int from notifications where user_id = '77777777-0000-0000-0000-000000000001' and type = 'mention'),
  1,
  'bahsedilen ve engellenmemiş kullanıcı bildirim alıyor'
);

select is(
  (select count(*)::int from notifications where user_id = '77777777-0000-0000-0000-000000000003' and type = 'mention'),
  0,
  'bahsedilen ama engelleyen/engellenen kullanıcı bildirim almıyor'
);

-- ============================================================================
-- public_web_posts: web_posts_public=false kullanıcının hiçbir satırı yok
-- ============================================================================
select is(
  (select count(*)::int from public_web_posts where username = (select username from profiles where id = '77777777-0000-0000-0000-000000000001')),
  0,
  'web_posts_public=false kullanıcının hiçbir gönderisi public_web_posts''ta yok'
);

select ok(
  (select count(*)::int from public_web_posts where display_name = 'Deniz Web') > 0,
  'web_posts_public=true, herkese açık hesabın gönderisi public_web_posts''ta var'
);

-- ============================================================================
-- get_following_feed: takip edilen (eşleşilmemiş) kişinin adı RLS'e takılmadan dönüyor
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  exists (
    select 1 from get_following_feed() where author_id = '77777777-0000-0000-0000-000000000004' and author_display_name = 'Deniz Web'
  ),
  'get_following_feed takip edilen kişinin adını RLS''e takılmadan (profiles join) doğru döndürüyor'
);
reset role;

-- ============================================================================
-- get_public_profile: engellenen kişi için boş, diğerleri için temel alanlar dönüyor
-- ============================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"77777777-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select display_name from get_public_profile('cem') limit 1),
  null,
  'engellenen kullanıcının genel profili boş dönüyor'
);
select is(
  (select is_private from get_public_profile('gizlibora') limit 1),
  true,
  'get_public_profile başka bir kullanıcının is_private durumunu doğru döndürüyor'
);
reset role;

SELECT * FROM finish();
ROLLBACK;
