# ADR 0005 — Faz 2 Web Kapsam Sınırları

- Durum: Kabul edildi
- Tarih: 2026-09-11

## Karar

Faz 2'nin PRD kabul kriteri (satır 774) yalnızca **film detay sayfasını** (Lighthouse, Rich Results, hreflang, i18n) ölçüyor. Bu doğrultuda aşağıdakiler bilinçli olarak bu fazın dışında bırakıldı:

1. **`/blog` içeriği** — rota/MDX altyapısı kurulur, gerçek yazı yazılmaz (editoryal iş, mühendislik kapsamı değil).
2. **`/stories`** — PRD'nin kendi talimatı gereği ("sahte testimonial yayınlanmaz") lansımda hiç açılmaz; rota bu fazda oluşturulmadı.
3. **Dinamik OG görseli** — yalnızca başlık + marka renkleri; TMDB afişini `next/og`/Satori'ye gömmek cross-origin görsel çekme + ek gecikme gerektiriyor, ayrı bir iyileştirme olarak bırakıldı.
4. **`revalidate-web` (on-demand ISR)** — zaman bazlı ISR (1 gün) yeterli; webhook tabanlı anında revalidation editoryal iş akışı (Faz 9/10) netleşince eklenecek.
5. **`/delete-account`** — auth sistemi henüz yok (Faz 3); statik bilgi sayfası olarak kuruldu, gerçek silme API'sine bağlı değil.
6. **TMDB logosu** — yalnızca zorunlu atıf metni eklendi; gerçek logo dosyası temin edilince görsel olarak eklenecek.

## Gerekçe

Bu öğelerin hiçbiri Faz 2'nin ölçülebilir kabul kriterini etkilemiyor; gerçek içerik/varlık gerektiren kalemleri iskelet olmadan "doldurmak" ya sahte içerik (stories, blog) ya da yanlış vaat (delete-account) anlamına gelirdi.

## Sonuç

Öğe 2 (blog) ve 6 (logo) editoryal/varlık teslimi bekliyor.

**Güncelleme (2026-10-08):** Öğe 4 (on-demand revalidation) Faz 9/10'a
ertelenmişti ama o fazlarda yapılmadı — PRD 10.2'nin `revalidate-web`
fonksiyonu ve `.env.example`'daki `REVALIDATE_SECRET` kodda hiçbir
karşılığı olmadan duruyordu. Artık yapıldı: `apps/web/src/app/api/revalidate`
rotası + `supabase/functions/revalidate-web` + `tmdb-sync` bağlantısı.
