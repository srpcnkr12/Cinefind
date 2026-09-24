# ADR 0006 — `user_films`in Faz 3'e Çekilmesi

- Durum: Kabul edildi
- Tarih: 2026-09-14

## Karar

PRD bölüm 19 (Faz 3), onboarding'in "zevk testi" ve "Kadrajım" adımlarını içeriyor. Bu adımlar, film reaksiyonlarını (`sevdim/fena değil/sevmedim`) ve 4 favori filmi (`top_four_position`) kaydetmesi gerekir — bu alanların hepsi PRD 9.3'te tanımlı `user_films` tablosuna ait. Ancak PRD 19, `user_films`i açıkça **Faz 4 (Sinematek)** kapsamında listeliyor.

Onboarding, var olmayan bir tabloya yazamayacağı için `user_films` tablosunu (yalnızca şu kolonlarla) Faz 3'te açıyoruz:

- `user_id`, `film_id`, `status` (`watched|watchlist|none`), `rating`, `liked`, `top_four_position`.

Faz 4, günlük (`diary_entries`), replikler (`film_lines`), istatistik ekranları ve `watch_count`/`first_watched_on` gibi ek kolonları **aynı tablo üzerine** ekleyecek — şema yeniden yazılmayacak, genişletilecek.

## Gerekçe

PRD'nin kendi talimatı (bölüm 0.5, son not): teknik olarak çalışmayan bir sıralama fark edildiğinde sessizce sapmak yerine gerekçesiyle önerip ADR'ye yazmak. Onboarding'i `user_films` olmadan "sahte" bir şekilde başka bir tabloya yazıp Faz 4'te taşımak, gereksiz bir migrasyon ve veri kaybı riski yaratırdı.

## Sonuç

Faz 4 planı, `user_films`e `alter table` ile yeni kolonlar ekleyecek ve `diary_entries`/`film_lines` tablolarını ayrıca açacak.
