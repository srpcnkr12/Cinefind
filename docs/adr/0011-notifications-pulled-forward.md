# ADR 0011 — `notifications` Tablosunun Faz 6'ya Çekilmesi

- Durum: Kabul edildi
- Tarih: 2026-09-14

## Karar

PRD 9.6, `notifications` tablosunu (`id`, `user_id`, `type`, `actor_id`, `entity jsonb`, `read_at`) tanımlıyor ama hiçbir faza açıkça atamıyor. Faz 6'nın `send-push` akışı (yeni mesaj geldiğinde push atma) bu tabloya ihtiyaç duyduğu için burada, yalnızca `type='new_message'` ile açılıyor.

## Gerekçe

[[user-films-pulled-forward]] (ADR-0006) ve [[conversations-pulled-forward]] (ADR-0010) ile aynı desen: bir sonraki fazın ihtiyacı olan minimal bir tabloyu erken açıp şemayı yeniden yazmak yerine üzerine inşa etmek.

## Sonuç

Faz 7 (Sosyal akış), `notifications.type`'a `mention`, `follow_request`, `like`, `comment` gibi yeni değerler ekleyecek — şema değişmeyecek, yalnızca `check` kısıtı genişleyecek.
