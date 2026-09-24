# ADR 0009 — Kalibrasyon Formülü İki Runtime'da (SQL + TS)

- Durum: Kabul edildi
- Tarih: 2026-09-14

## Karar

PRD 7.6: "Tüm skor fonksiyonları `packages/core` içinde saf fonksiyon olarak yazılır; Edge Function bunları import eder." Bileşen skorları (7.3) ve tam `compute-compat` yalnızca `packages/core/src/domain/taste.ts` + `compute-compat` Edge Function'da yaşar, `compatibility_scores`'a önbelleklenir — SQL'de tekrar edilmez.

Ama 7.4'teki **kalibrasyon** ("kullanıcının aday havuzundaki yüzdelik dilime göre 50–99'a eşleme") o anki isteğin aday havuzuna özgü, önbelleklenemeyen bir hesap. `get_discovery_deck` bir SQL RPC olduğu için bunu `percent_rank()` ile SQL'de hesaplıyor. Aynı formülün saf bir TS eşdeğeri `packages/core`'da da yazılıp `fast-check` ile test ediliyor (formülün 50-99 aralığında kaldığını, monoton olduğunu doğrulamak için) — ama çalışma zamanında kullanılan gerçek yol SQL'dir.

## Gerekçe

Bu proje zaten aynı ilkeyle bilinçli bir kod tekrarı örneği içeriyor: Türkçe harf normalizasyonu (`packages/i18n/src/slugify.ts`, `normalize_tr()` SQL fonksiyonu, `supabase/functions/_shared/tmdb/slugify.ts`) üç runtime'da kasıtlı olarak ayrı yazılmış durumda, çünkü mantık basit ve düşük riskli. Kalibrasyon formülü de aynı kategoride: tek satırlık, kolay doğrulanabilir bir matematik (`50 + percent_rank * 49`, 50-99 arasına kırpma). Bunun aksine 7.3'teki 7 bileşenli ağırlıklı skor **karmaşık ve hataya açık** — o asla tekrar edilmiyor, tek kaynağı `packages/core` + `compute-compat`.

## Sonuç

`packages/core/src/domain/taste.ts`'teki `calibrateScore` ile `get_discovery_deck`'in SQL'indeki `percent_rank()` ifadesi davranışça eşdeğer tutulmalı; biri değişirse diğeri de gözden geçirilmeli (bu dosyaya çapraz referans yorumu eklendi).
