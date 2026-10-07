# CLAUDE.md — Movieholix

## Proje

Film zevki üzerinden tanışma + film günlüğü + sinefil sosyal akış. Tam spesifikasyon: docs/PRD.md.
Referans ürün Bookspace'tir; ondan metin, görsel, logo, renk veya marka öğesi kopyalanmaz.

## Komutlar

- pnpm dev # web + mobil + supabase
- Yerel Supabase portları `55321-55329` bandında (bu makinede başka bir proje — `film-social` — varsayılan portları kullandığı için Faz 1'de kaydırıldı, bkz. supabase/config.toml).
- pnpm lint / pnpm typecheck / pnpm test
- pnpm db:reset # yerel DB sıfırla + migration + seed
- pnpm db:test # RLS ve RPC testleri
- pnpm e2e:web / pnpm e2e:mobile

## Çalışma kuralları

1. Her fazın başında plan yaz, onay al. Faz sonunda lint + typecheck + test çalıştır ve kabul kriterlerini tek tek raporla.
2. Sürüm, API ve platform kurallarını güncel resmi dokümantasyondan doğrula; hafızaya güvenme.
3. TypeScript strict. `any` yasak (gerekirse gerekçeli `unknown` + daraltma). Tüm dış girdiler zod ile doğrulanır.
4. Kullanıcıya görünen her metin packages/i18n'den gelir (tr + en birlikte eklenir).
5. Her yeni tabloda RLS + politika + RLS testi aynı PR'da. Service role anahtarı istemci koduna asla girmez.
6. Para, limit, eşleşme, bakiye işlemleri tek transaction'lı ve idempotent RPC'lerde.
7. Gizli anahtar commit edilmez; yeni değişken eklenince .env.example güncellenir.
8. Migration'lar yalnızca ileri yönlü; prod veritabanına doğrudan komut çalıştırılmaz.
9. Analitik olaylarına kişisel veri, mesaj içeriği, kesin konum veya cinsel yönelim bilgisi eklenmez.
10. Prod'da sahte kullanıcı, sahte yorum veya sahte testimonial olmaz. Seed betikleri prod'da çalışmaz.
11. Tasarım token'ları dışında renk/font/boşluk değeri yazılmaz. Erişilebilirlik (44pt hedef, AA kontrast, ekran okuyucu etiketi) her bileşende zorunlu.
12. Önemli mimari kararlar docs/adr/ altına kısa ADR olarak yazılır.
13. Emin olmadığın ürün kararlarında tahmin yürütüp büyük yapı kurma; dur ve sor.
14. Conventional Commits; küçük, gözden geçirilebilir PR'lar.

## Mimari özet

apps/mobile (Expo), apps/web (Next.js + admin), packages/core (domain + eşleşme algoritması),
packages/api, packages/tokens, packages/i18n, packages/config, supabase/ (migrations, functions, tests, seed).
