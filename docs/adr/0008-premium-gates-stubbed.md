# ADR 0008 — Premium Kapılı Özellikler Faz 5'te Sabit Değer Döner

- Durum: Çözüldü (Faz 8'de uygulandı, 2026-10-08'de doğrulandı)
- Tarih: 2026-09-14

## Karar

PRD 13.1'e göre `undo_last_swipe` (geri al) tamamen premium, `get_likes_received` (seni beğenenler) ücretsizde bulanık+sayı döner. Ama `entitlements`/RevenueCat altyapısı Faz 8'e kadar yok. Faz 5'te:

- `undo_last_swipe()` her zaman `premium_required` hatası fırlatır (kod yolu yazıldı, gerçek entitlement kontrolü yok).
- `get_likes_received()` her zaman yalnızca `{total_count}` döner — kimlik/fotoğraf asla yok.
- "Gelişmiş filtreler" (yönetmen/tür/on yıl/doğrulanmış) bu fazda hiç yapılmadı; yalnızca ücretsiz filtreler (yaş, mesafe, niyet) var.

## Gerekçe

Sahte bir `is_premium` kolonu icat edip Faz 8'de gerçek `entitlements` tablosuyla değiştirmek gereksiz bir migrasyon ve tutarsızlık riski yaratır. Bunun yerine RPC'lerin **imzası** şimdiden doğru yazılıyor; Faz 8 yalnızca içindeki sabit kontrolü gerçek entitlement sorgusuna çevirecek.

## Sonuç

Faz 8 planı, `undo_last_swipe`/`get_likes_received` gövdelerini `entitlements` tablosuna karşı gerçek bir kontrolle değiştirecek; istemci tarafı (RPC adı/dönüş tipi) değişmeyecek.

## Güncelleme (2026-10-08)

Faz 8 bunu yaptı: `undo_last_swipe`, `get_likes_received`, `swipe` ve
`get_weekly_stats` artık `entitlements` tablosunu okuyan `is_premium()`
yardımcısını çağırıyor. Sabit kontrol kalmadı; ADR'nin öngördüğü gibi
istemci tarafı (RPC adı/dönüş tipi) değişmedi.
