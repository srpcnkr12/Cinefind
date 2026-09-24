# ADR 0017 — Rate Limit Sabit Pencere Sayaçla Uygulanır, Token Bucket ile Değil

- Durum: Kabul edildi
- Tarih: 2026-09-18

## Karar

PRD 8.3 "Sunucu tarafı rate limit (Postgres tabanlı token bucket veya Upstash)" diyor. Bu ortamda Upstash yok; token bucket (sürekli/kısmi dolan kova) yerine daha basit bir `rate_limits(user_id, bucket, window_start, count)` sabit pencere (fixed-window) sayaç kullanıldı — `check_rate_limit(bucket, max_count, window_seconds)` SECURITY DEFINER fonksiyonu, `send_message`/`create_post`/`report_content` içine gömülü.

## Gerekçe

Sabit pencere, token bucket'ın "kötüye kullanımı sınırlama" amacına fonksiyonel olarak hizmet eder; yalnızca pencere sınırında (ör. dakikanın son saniyesinde N istek + yeni dakikanın ilk saniyesinde N istek daha) teorik olarak token bucket'tan daha gevşek davranabilir. Bu, MVP güvenlik gereksinimi için kabul edilebilir bir basitleştirme — saf bir uygulama detayı, PRD'nin "kötüye kullanımı sınırla" gerekçesini değiştirmiyor.

## Sonuç

Gerçek bir token bucket (veya Upstash) gerekirse, `check_rate_limit`'in imzası aynı kalarak içi değiştirilebilir; çağıran RPC'ler (`send_message` vb.) etkilenmez.
