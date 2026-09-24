# ADR 0010 — `conversations`/`conversation_members`in Faz 5'e Çekilmesi

- Durum: Kabul edildi
- Tarih: 2026-09-14

## Karar

PRD'nin `swipe` RPC açıklaması (bölüm 10.1), karşılıklı beğenide "matches + conversations oluşturma"yı tek transaction'da istiyor. Ama sohbet altyapısı (mesajlar, gerçek zamanlı abonelik, sohbet ekranı) PRD'de **Faz 6 (Sohbet)** kapsamında.

`swipe()` var olmayan bir tabloya yazamayacağı için `conversations` (id, match_id, kind, status) ve `conversation_members` (conversation_id, user_id, last_read_message_id, muted_until) tablolarını Faz 5'te açıyoruz — [[user-films-pulled-forward]] (ADR-0006) ile aynı desen. `messages` tablosu ve Supabase Realtime aboneliği bu tabloların üzerine Faz 6'da eklenecek; şema yeniden yazılmayacak.

## Gerekçe

PRD bölüm 0.5'in talimatı: teknik olarak çalışmayan bir sıralama fark edildiğinde sessizce sapmak yerine gerekçesiyle önerip ADR'ye yazmak.

## Sonuç

Faz 6 planı, `messages` tablosunu ve realtime aboneliğini bu iki tablonun üzerine ekleyecek.
