# ADR 0013 — Faz 7 Web Entegrasyonu Yalnızca Film Sayfasıyla Sınırlı

- Durum: Kabul edildi
- Tarih: 2026-09-16

## Karar

Faz 7'nin web'e dokunan tek yüzeyi, film detay sayfasına eklenen "Toplulukta" bölümü (`public_web_posts` view'ından gönderiler + genel görünür replikler + ortalama puan). Ayrı kullanıcı profili sayfaları, herkese açık bir akış sayfası, gönderi detay sayfası gibi web yüzeyleri **bu fazda eklenmiyor**.

## Gerekçe

PRD'nin Faz 7 talimatının kendisi bunu böyle sınırlıyor ("film sayfasında topluluk gönderileri ... ve web entegrasyonu"). Bu aynı zamanda [[web-scope-and-og-images]] (ADR-0005) ile kurulan ilkeyle tutarlı: web yalnızca SEO/indirme hunisi, sosyal ağın kendisi mobil uygulamada yaşıyor.

## Sonuç

İleride tam bir web sosyal deneyimi istenirse (ör. herkese açık kullanıcı profilleri), bu ayrı bir faz/karar olarak ele alınmalı.
