# ADR 0021 — Cloudflare'de yalnızca tanıtım sitesi barındırılıyor

- Durum: Kabul edildi
- Tarih: 2026-10-07

## Bağlam

Herkese açık bir adrese ihtiyaç vardı: TMDB API başvurusu "Application URL"
istiyor ve markanın bir karşılığının olması gerekiyor.

İlk denemede `apps/web`'in tamamı `@opennextjs/cloudflare` ile Workers'a
taşındı. Derleme ve yerel çalıştırma başarılıydı, ama bu **istenen şey
değildi** ve üç bedeli vardı:

1. Next.js 16.3.4 → 16.3.8 yükseltmesi zorunlu hale geliyordu (adaptörün peer
   aralığı).
2. ISR için R2 + D1 + Durable Objects bağlamak gerekiyordu.
3. Çalışması için barındırılan bir Supabase projesi şarttı — yoksa site boş.

Kullanıcı ürünün kendisini henüz hiçbir yere koymak istemiyor (ürün fikrinin
erken görünür olmaması tercihi). İhtiyaç yalnızca bir tanıtım sayfası.

## Karar

`apps/landing` — tek bir statik HTML dosyası sunan Cloudflare Worker
(`assets.directory` dışında hiçbir binding yok). Derleme adımı, framework,
veri kaynağı ve Supabase bağlantısı yok.

`apps/web`'deki OpenNext kurulumu tamamen geri alındı: adaptör ve wrangler
bağımlılıkları, `wrangler.jsonc`, `open-next.config.ts`, `_headers`, `cf:*`
script'leri kaldırıldı; Next 16.3.4'e döndürüldü.

## Sonuçlar

- Tanıtım sitesi `apps/web`'den tamamen bağımsız; ürün kodu, veri modeli veya
  özellik listesi hakkında hiçbir şey açığa çıkarmaz (içerik bilinçli olarak
  teaser seviyesinde tutuldu).
- Renkler `packages/tokens/src/raw.cjs` ile aynı ("Gece seansı", PRD 15.2) ama
  dosya token paketini **import etmiyor** — statik sayfada derleme adımı
  olmaması için değerler elle kopyalandı. Palet değişirse bu sayfa elle
  güncellenmeli.
- CLAUDE.md kuralı 4 (metinler `packages/i18n`'den) bu sayfa için
  uygulanmadı: build adımı olmayan tek dosyalık statik bir sayfa için i18n
  altyapısı taşımak orantısız. TR ve EN metin aynı sayfada birlikte duruyor.
- `apps/web` hâlâ hiçbir yere dağıtılmıyor. Gerçek dağıtım kararı, barındırılan
  Supabase projesi açıldığında yeniden ele alınacak.

## Açık işler

- `movieholix.app` alan adı kayıtlı değil (DNS'te NS delegasyonu yok).
  Kayıt yapılıp Worker'a custom domain olarak bağlanmalı.
- Dağıtım `wrangler login` gerektiriyor; henüz yapılmadı.
