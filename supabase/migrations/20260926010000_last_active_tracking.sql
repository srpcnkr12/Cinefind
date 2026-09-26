-- ============================================================================
-- `profiles.last_active_at` hiçbir zaman YAZILMIYORDU.
--
-- Keşfet aday sorgusu (`get_discovery_deck`) şu filtreyi uyguluyor:
--     and p.last_active_at is not null
--     and p.last_active_at > now() - interval '30 days'
-- ve alan yalnızca okunuyordu: onu dolduran tek yer pgTAP fixture'ları ile
-- demo seed betiğiydi. Sonuç: gerçek kayıt akışından geçen her kullanıcı
-- keşfette kalıcı olarak görünmez oluyordu (testler alanı elle set ettiği için
-- hata fark edilmemişti).
--
-- Çözüm: (1) onboarding adımı her ilerlediğinde damgala, (2) uygulama açılış /
-- öne gelme anında çağıracağı hafif bir RPC ekle, (3) bu yüzden görünmez kalmış
-- mevcut profilleri geri getir.
-- ============================================================================

create or replace function update_onboarding_step(new_step text)
returns void
language plpgsql
security invoker
as $$
begin
  update profiles set
    onboarding_step = new_step,
    discoverable = case when new_step = 'completed' then true else discoverable end,
    -- Onboarding'de ilerlemek başlı başına aktiflik göstergesi; damgalanmazsa
    -- kullanıcı akışı bitirdiği anda keşfet filtresine takılıyor.
    last_active_at = now()
  where id = auth.uid();

  if new_step = 'completed' then
    perform ensure_username();
  end if;
end;
$$;

grant execute on function update_onboarding_step(text) to authenticated;

-- ============================================================================
-- touch_last_active — istemci uygulama açılışında/öne geldiğinde çağırır.
-- Yalnızca çağıranın kendi satırını güncelleyebilir (security invoker + RLS).
-- ============================================================================
create or replace function touch_last_active()
returns void
language sql
security invoker
as $$
  update profiles set last_active_at = now() where id = auth.uid();
$$;

revoke execute on function touch_last_active() from public, anon;
grant execute on function touch_last_active() to authenticated;

-- Damgası hiç atılmadığı için görünmez kalmış profilleri geri getir.
update profiles
set last_active_at = now()
where last_active_at is null
  and onboarding_step = 'completed'
  and deleted_at is null;
