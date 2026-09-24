# ADR 0015 — Admin Paneli Metinleri packages/i18n'den Gelmez

- Durum: Kabul edildi
- Tarih: 2026-09-18

## Karar

`apps/web/src/app/admin/**` altındaki admin paneli metinleri doğrudan sabit Türkçe olarak koda yazılır; `packages/i18n`'e eklenmez. Bu, `apps/web/eslint.config.mjs`'te `i18next/no-literal-string` kuralının bu yol için kapatılmasıyla uygulanır.

## Gerekçe

CLAUDE.md kural #4 ("Kullanıcıya görünen her metin packages/i18n'den gelir") son kullanıcıya yönelik yüzeyler için yazıldı. Admin paneli yalnızca ekip içi moderatör/editör/admin rolündeki kişiler tarafından kullanılıyor, son kullanıcı hiçbir zaman görmüyor. Bu bilinçli sapma kullanıcıya soruldu, açıkça onaylandı (Faz 9 planlama aşaması).

## Sonuç

Gelecekte panel gerçekten çok dilli bir ekip tarafından kullanılacaksa (ör. yurt dışı moderatörler), bu ADR gözden geçirilip `packages/i18n`'e taşınabilir.
