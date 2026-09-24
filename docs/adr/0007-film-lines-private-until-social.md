# ADR 0007 — `film_lines` Faz 4'te Yalnızca Sahibine Görünür

- Durum: Kabul edildi
- Tarih: 2026-09-14

## Karar

PRD 9.3, `film_lines` (replikler) tablosunu Faz 4 (Sinematek) kapsamında tanımlıyor. Ancak PRD 19, "film sayfasında topluluk gönderileri"ni açıkça **Faz 7 (Sosyal akış)** kapsamına koyuyor — yani bir repliğin başka kullanıcılara, bir film sayfasında, topluluk içeriği olarak gösterilmesi Faz 7'nin işi.

Faz 4'te `film_lines` tablosu açılıyor ve kullanıcı kendi repliklerini ekleyip kendi Sinematek'inde görebiliyor, ama RLS yalnızca sahibine okuma/yazma izni veriyor (`owner_all`, tıpkı `diary_entries` gibi). Başkasının repliği hiçbir sorguda dönmüyor.

## Gerekçe

Tabloyu Faz 7'ye kadar hiç açmamak, onboarding'de olduğu gibi (bkz. [[user-films-pulled-forward]]) veri kaybı riski yaratırdı. Ama PRD'nin kendi faz sınırını (Faz 7 = topluluk görünürlüğü) yok sayıp şimdiden herkese açık bir `select` politikası eklemek, henüz var olmayan bir moderasyon/gizlilik akışını (Faz 7'nin `visibility`, `contains_spoiler` bulanıklığı, engelleme kontrolü) atlayarak riskli içerik sızıntısına yol açardı.

## Sonuç

Faz 7 planı, `film_lines`e ikinci bir `select` politikası ekleyecek (ör. `moderation_status='approved'` + engelleme/gizlilik kontrolleriyle), şema değişmeyecek.
