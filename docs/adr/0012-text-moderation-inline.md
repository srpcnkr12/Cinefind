# ADR 0012 — Metin Moderasyonu Senkron SQL Fonksiyonu Olarak

- Durum: Kabul edildi
- Tarih: 2026-09-16

## Karar

PRD 10.2, `moderate-text` Edge Function'ını "gönderi/yorum/replik/bio/mesaj insert trigger → kuyruk" olarak tanımlıyor. Faz 7'de `posts`/`comments` için ayrı bir kuyruk + Edge Function kurmak yerine, Faz 6'da aynı ihtiyaç (dolandırıcılık kalıpları, `contains_scam_signal`) için zaten kurulan **senkron SQL fonksiyonu** deseni genişletildi: `text_moderation_status(body)` küfür/taciz anahtar kelimeleri (TR+EN) ve iletişim bilgisi kalıplarını kontrol edip `create_post`/`add_comment` RPC'leri içinde doğrudan çağrılıyor.

## Gerekçe

Async kuyruk + Edge Function, gerçek bir üçüncü parti metin moderasyon servisi (ör. bir NLP/toksisite API'si) entegre edilene kadar gereksiz bir dolaylılık. Senkron kontrol basit bir regex/anahtar kelime listesiyle çalıştığı için gecikme sorunu yaratmıyor ve [[chat]] fazındaki emsalle tutarlı.

## Sonuç

Gerçek bir metin moderasyon sağlayıcısı (Faz 3'teki `ModerationProvider` görsel soyutlamasının metin eşdeğeri) eklendiğinde yalnızca `text_moderation_status`'ün gövdesi değişecek; `create_post`/`add_comment`'in imzası ve çağrı yeri aynı kalacak.
