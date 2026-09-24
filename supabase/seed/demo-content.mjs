// Demo/staging sosyal içeriği: akış postları, beğeni/yorum, takip grafiği,
// günlük kayıtları, replikler ve doğal sohbet mesajları.
//
// Neden ayrı bir betik: `demo-users.mjs` kimlikleri ve eşleşmeleri kuruyor ama
// Akış/Günlük/Replikler sekmeleri bomboş kalıyordu (0 post, 0 takip). Akış
// sekmesi varsayılan olarak "Takip" segmentinde açıldığı için takip ilişkisi
// olmadan post'lar da görünmüyor.
//
// Önce `demo-users.mjs` çalıştırılmış olmalı.
//
// Çalıştırma:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed/demo-content.mjs

import { createClient } from "@supabase/supabase-js";

if (process.env.APP_ENV === "production") {
  console.error(
    "Bu betik prod ortamında çalışmayı reddeder (CLAUDE.md kural #10).",
  );
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const REVIEWS = [
  "Finali tartışmalı ama o son sahnedeki sessizlik bütün filmi taşıyor. Çıkışta kimse konuşamadı.",
  "İkinci izleyişte çok daha iyi. İlk seferde olay örgüsünü kovalıyorsun, sonra kadrajı görüyorsun.",
  "Görüntü yönetmenliği tek başına bilet parasını hak ediyor. Senaryo biraz sarkıyor ama olsun.",
  "Tam bir cumartesi akşamı filmi. Beklentiyi karşıladı, fazlasını vaat etmedi zaten.",
  "Uzun, yavaş ve inatçı. Sabredene çok şey veriyor, sabretmeyene hiçbir şey.",
  "Başrolün sessiz oynadığı sahneler, bağırdığı sahnelerden iyi. Yönetmen de bunu biliyor olmalı.",
  "Kurgusu beni yordu ama müzikleri iki gündür aklımdan çıkmıyor.",
  "Klasik olmasının bir sebebi var. Bugün çekilse aynı etkiyi yapar mıydı, emin değilim.",
];

const TEXT_POSTS = [
  "Bu hafta üç film izledim ve hiçbiri beklediğim gibi çıkmadı. En iyi haftalar böyle oluyor.",
  "Sinemada tek başına film izlemenin savunucusuyum. Kimseye açıklama yapmadan ağlayabiliyorsun.",
  "Arşivden rastgele film seçme yöntemim: listeyi kaydır, gözünü kapat, dur de. Bugün isabetliydi.",
  "Fragman izlemeyi bıraktım, hayatım değişti. Tavsiye ederim.",
  "Altyazı mı dublaj mı tartışmasını kapatalım: altyazı. Sonraki soru.",
  "Festival programı açıklandı, izin günlerimi buna göre ayarlıyorum. Kimler var?",
];

const COMMENTS = [
  "Aynen! O sahneyi tekrar tekrar izledim.",
  "Katılmıyorum ama iyi yazmışsın.",
  "Listeme aldım, bu hafta izleyeceğim.",
  "Yönetmenin önceki filmini de öner derim.",
  "Ben tam tersini düşünüyorum, konuşmamız lazım.",
  "Bunu sinemada izleyememek en büyük pişmanlığım.",
];

const DIARY_NOTES = [
  "Kadıköy'de akşam seansı. Salon yarı boştu, daha iyi oldu.",
  "Evde, battaniye altında. Yarısında uyuyakaldım, sabah baştan izledim.",
  "Festival gösterimi. Yönetmen söyleşisi filmden uzun sürdü ama değdi.",
  "Arkadaş tavsiyesiyle. Borçluyum.",
  "Üçüncü izleyişim. Her seferinde başka bir şey görüyorum.",
];

const VENUES = ["cinema", "home", "festival", "other"];

const LINES = [
  {
    text: "Sanırım bu güzel bir dostluğun başlangıcı.",
    character: "Rick Blaine",
  },
  {
    text: "Bütün bu anlar zamanla kaybolacak, yağmurdaki gözyaşları gibi.",
    character: "Roy Batty",
  },
  {
    text: "Ona reddedemeyeceği bir teklif yapacağım.",
    character: "Don Vito Corleone",
  },
  { text: "Korkma. Bu ada seslerle dolu.", character: null },
  {
    text: "İnsan yalnız doğar, yalnız ölür. Arası da pek kalabalık sayılmaz.",
    character: null,
  },
  {
    text: "Hatırladığım şey gerçek miydi, yoksa hatırlamak istediğim mi?",
    character: null,
  },
];

function pick(list, i) {
  return list[i % list.length];
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d;
}

async function main() {
  const { data: users, error: usersError } = await admin
    .from("profiles")
    .select("id, display_name")
    .eq("onboarding_step", "completed")
    .order("created_at", { ascending: true });
  if (usersError) throw usersError;
  if (users.length < 10) {
    console.error(
      "Yeterli demo kullanıcı yok — önce demo-users.mjs çalıştırılmalı.",
    );
    process.exit(1);
  }

  const { data: films, error: filmsError } = await admin
    .from("films")
    .select("id, slug");
  if (filmsError) throw filmsError;
  if (!films.length) {
    console.error("Film kataloğu boş — önce tmdb-sync çalıştırılmalı.");
    process.exit(1);
  }

  // --- Takip grafiği -------------------------------------------------------
  // Her kullanıcı kendinden sonraki birkaç kişiyi takip eder. Akış sekmesi
  // "Takip" segmentinde açıldığı için bu olmadan akış boş görünüyor.
  const follows = [];
  for (let i = 0; i < users.length; i++) {
    for (const offset of [1, 2, 3, 5, 8]) {
      const followee = users[(i + offset) % users.length];
      if (followee.id === users[i].id) continue;
      follows.push({
        follower_id: users[i].id,
        followee_id: followee.id,
        status: "accepted",
      });
    }
  }
  const { error: followError } = await admin
    .from("follows")
    .upsert(follows, { onConflict: "follower_id,followee_id" });
  if (followError) console.warn("Takipler eklenemedi:", followError.message);

  // --- Replikler -----------------------------------------------------------
  const lineRows = LINES.map((line, i) => ({
    user_id: users[i % users.length].id,
    film_id: films[i % films.length].id,
    text: line.text,
    character_name: line.character,
    moderation_status: "approved",
    created_at: daysAgo(20 - i).toISOString(),
  }));
  const { data: insertedLines, error: lineError } = await admin
    .from("film_lines")
    .insert(lineRows)
    .select("id, user_id, film_id");
  if (lineError) console.warn("Replikler eklenemedi:", lineError.message);

  // --- Günlük kayıtları ----------------------------------------------------
  const diaryRows = [];
  for (let i = 0; i < 40; i++) {
    const user = users[i % 12]; // ilk 12 kullanıcı "aktif" görünsün
    const film = films[(i * 3) % films.length];
    diaryRows.push({
      user_id: user.id,
      film_id: film.id,
      watched_on: daysAgo(i * 2 + 1)
        .toISOString()
        .slice(0, 10),
      rating: [3, 3.5, 4, 4.5, 5, 2.5][i % 6],
      is_rewatch: i % 7 === 0,
      venue: pick(VENUES, i),
      note: i % 3 === 0 ? pick(DIARY_NOTES, i) : null,
      contains_spoiler: false,
    });
  }
  const { error: diaryError } = await admin
    .from("diary_entries")
    .insert(diaryRows);
  if (diaryError)
    console.warn("Günlük kayıtları eklenemedi:", diaryError.message);

  // --- Postlar -------------------------------------------------------------
  const postRows = [];
  for (let i = 0; i < 48; i++) {
    const author = users[i % Math.min(users.length, 24)];
    const film = films[(i * 5) % films.length];
    const kind = i % 4;
    if (kind === 0 || kind === 1) {
      postRows.push({
        author_id: author.id,
        type: "review",
        film_id: film.id,
        body: pick(REVIEWS, i),
        rating: [3.5, 4, 4.5, 5, 3][i % 5],
        visibility: "public",
        moderation_status: "approved",
        created_at: daysAgo(i * 0.4 + 0.2).toISOString(),
      });
    } else if (kind === 2) {
      postRows.push({
        author_id: author.id,
        type: "watched",
        film_id: film.id,
        body: null,
        visibility: "public",
        moderation_status: "approved",
        created_at: daysAgo(i * 0.4 + 0.2).toISOString(),
      });
    } else {
      postRows.push({
        author_id: author.id,
        type: "text",
        body: pick(TEXT_POSTS, i),
        visibility: "public",
        moderation_status: "approved",
        created_at: daysAgo(i * 0.4 + 0.2).toISOString(),
      });
    }
  }
  // Repliklerden de birkaç post (akışta "line" tipi de görünsün).
  for (const line of insertedLines ?? []) {
    postRows.push({
      author_id: line.user_id,
      type: "line",
      film_id: line.film_id,
      line_id: line.id,
      visibility: "public",
      moderation_status: "approved",
      created_at: daysAgo(Math.random() * 10).toISOString(),
    });
  }

  const { data: insertedPosts, error: postError } = await admin
    .from("posts")
    .insert(postRows)
    .select("id, author_id");
  if (postError) throw new Error(`Postlar eklenemedi: ${postError.message}`);

  // --- Beğeniler ve yorumlar ----------------------------------------------
  const likeRows = [];
  const commentRows = [];
  insertedPosts.forEach((post, index) => {
    const likeCount = (index * 7) % 14; // 0-13 arası, postlar arasında değişsin
    for (let k = 0; k < likeCount; k++) {
      const liker = users[(index + k * 3 + 1) % users.length];
      if (liker.id === post.author_id) continue;
      likeRows.push({ post_id: post.id, user_id: liker.id });
    }
    if (index % 3 === 0) {
      const commenter = users[(index + 5) % users.length];
      if (commenter.id !== post.author_id) {
        commentRows.push({
          post_id: post.id,
          author_id: commenter.id,
          body: pick(COMMENTS, index),
          moderation_status: "approved",
        });
      }
    }
  });

  const { error: likeError } = await admin
    .from("post_likes")
    .upsert(likeRows, { onConflict: "post_id,user_id" });
  if (likeError) console.warn("Beğeniler eklenemedi:", likeError.message);

  const { error: commentError } = await admin
    .from("comments")
    .insert(commentRows);
  if (commentError) console.warn("Yorumlar eklenemedi:", commentError.message);

  // `post_likes_count_trigger` ve `comments_count_trigger` denormalize
  // sayaçları kendisi güncelliyor; elle set etmek sayıları ikiye katlardı.

  // --- Sohbetler -----------------------------------------------------------
  // demo-users.mjs her eşleşmeye tek bir açılış mesajı bırakıyor; demo'da
  // sohbet ekranının dolu görünmesi için karşılıklı bir diyalog ekliyoruz.
  const { data: conversations, error: convError } = await admin
    .from("conversations")
    .select("id, conversation_members(user_id)")
    .eq("kind", "match");
  if (convError) console.warn("Sohbetler okunamadı:", convError.message);

  const DIALOGS = [
    [
      "Dün gece Kış Uykusu'nu yeniden izledim. Üç saat nasıl geçti anlamadım.",
      "Cesaret istiyor o film. Ben ikinci denemede bitirebildim.",
      "Bu hafta sonu sinemada bir festival gösterimi var, gider misin?",
      "Olur, programı at bana. Cumartesi müsaitim.",
    ],
    [
      "Listendeki Yeşilçam seçkisi çok iyi. Susuz Yaz favorim.",
      "Hah, onu yazan ilk kişisin. Genelde kimse bilmiyor.",
      "Sinematek'te gösterimi olursa haber ver, kaçırmayalım.",
    ],
    [
      "Bilim kurgu konusunda ciddi olduğunu görüyorum.",
      "Fena halde. 2001'i her yıl bir kez izliyorum, hâlâ çözemedim.",
      "O zaman Solaris'i konuşmamız lazım. Kahve?",
      "Kabul, ama tartışma uzarsa ikinci kahve senden.",
    ],
  ];

  let messageCount = 0;
  for (const [index, conversation] of (conversations ?? []).entries()) {
    const members = (conversation.conversation_members ?? []).map(
      (m) => m.user_id,
    );
    if (members.length < 2) continue;
    const dialog = DIALOGS[index % DIALOGS.length];
    const rows = dialog.map((body, k) => ({
      conversation_id: conversation.id,
      // Açılış mesajı zaten members[0]'dan geldiği için sırayı ondan devam ettiriyoruz.
      sender_id: members[(k + 1) % 2],
      kind: "text",
      body,
      created_at: new Date(
        Date.now() - (dialog.length - k) * 3600000,
      ).toISOString(),
    }));
    const { error: msgError } = await admin.from("messages").insert(rows);
    if (msgError) {
      console.warn("Mesajlar eklenemedi:", msgError.message);
      continue;
    }
    messageCount += rows.length;
  }

  console.log(`  ${messageCount} sohbet mesajı eklendi.`);

  console.log(
    `Tamamlandı: ${insertedPosts.length} post, ${likeRows.length} beğeni, ${commentRows.length} yorum, ` +
      `${diaryRows.length} günlük kaydı, ${(insertedLines ?? []).length} replik, ${follows.length} takip.`,
  );
}

main().catch((error) => {
  console.error("demo-content betiği başarısız oldu:", error);
  process.exit(1);
});
