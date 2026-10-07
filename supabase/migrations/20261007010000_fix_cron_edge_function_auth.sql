-- ============================================================================
-- Cron -> edge function kimlik doğrulamasını düzelt
-- ============================================================================
-- Dört cron işi de (`tmdb_sync_daily`, `weekly_stats_monday`,
-- `account_deletion_daily`, `compute_compat_every_15_min`) edge function'ları
-- şu başlıkla çağırıyordu:
--
--     Authorization: Bearer <service_role JWT>
--
-- Fonksiyonlar `withSupabase({ auth: "secret" })` kullanıyor ve bu biçimi
-- reddediyor. Yerelde ölçülen davranış:
--
--   Authorization: Bearer <JWT>   -> INVALID_CREDENTIALS
--   apikey: <legacy service_role JWT> -> INVALID_API_KEY ("legacy JWT")
--   apikey: <sb_secret_...>       -> 200
--
-- Yerelde Vault secret'ları hiç tanımlı olmadığı için işler zaten sessizce
-- hiçbir şey yapmıyordu ve bu uyumsuzluk fark edilmemişti; staging/production'da
-- Vault doldurulur dolmaz dört iş de 401 alıp sessizce başarısız olacaktı.
-- En ağır iki sonucu: `account_deletion_daily` ile KVKK/GDPR'ın 30 gün sonra
-- kalıcı silme yükümlülüğü (PRD 14.3) hiç çalışmazdı; `compute_compat_every_15_min`
-- ile de uyum skorları (PRD 7) hiç güncellenmezdi.
--
-- Düzeltme: başlık `apikey` olarak değişiyor ve değer YENİ biçimli secret
-- key'den (`sb_secret_...`) okunuyor. Bu yüzden yeni bir Vault secret'ı
-- gerekiyor: `secret_key`. Eski `service_role_key` secret'ı başka yerlerde
-- kullanılmadığı için bu migration onu okumayı bırakıyor.
--
-- Hedef ortamda kurulum (bkz. supabase.com/docs/guides/functions/schedule-functions):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<sb_secret_...>',            'secret_key');
-- ============================================================================

-- cron.unschedule yalnızca kayıtlı iş varsa çalışır; yoksa hata verir.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'tmdb_sync_daily') then
    perform cron.unschedule('tmdb_sync_daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'weekly_stats_monday') then
    perform cron.unschedule('weekly_stats_monday');
  end if;
  if exists (select 1 from cron.job where jobname = 'account_deletion_daily') then
    perform cron.unschedule('account_deletion_daily');
  end if;
  if exists (select 1 from cron.job where jobname = 'compute_compat_every_15_min') then
    perform cron.unschedule('compute_compat_every_15_min');
  end if;
end;
$$;

select cron.schedule(
  'tmdb_sync_daily',
  '0 4 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/tmdb-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

select cron.schedule(
  'weekly_stats_monday',
  '0 9 * * 1',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-stats',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

select cron.schedule(
  'account_deletion_daily',
  '0 5 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/account-deletion',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

select cron.schedule(
  'compute_compat_every_15_min',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/compute-compat',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'secret_key')
      ),
      body := '{"mode":"queue"}'::jsonb
    ) as request_id;
  $$
);
