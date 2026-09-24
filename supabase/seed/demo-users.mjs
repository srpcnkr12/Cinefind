// PRD 18.2: yerel/staging demo verisi — 60 sahte kullanıcı, farklı zevk
// kümeleri, onaylı placeholder fotoğraflar (gerçek kişi fotoğrafı değil).
// Ayrıca App Review'in isteyeceği "eşleşmeye hazır test kullanıcıları"nı
// üretmek için birkaç gerçek `matches`/`conversations` satırı da oluşturur.
//
// CLAUDE.md kural #10: prod'da çalışmayı reddeder.
//
// Çalıştırma: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleriyle
//   node supabase/seed/demo-users.mjs
//
// Not: Bu script'in ürettiği "placeholder fotoğraf", gerçek görünüşte bir
// insan fotoğrafı DEĞİL — soyut, stilize bir portre silüeti (bkz. avatarPng).
// Bu bilinçli bir seçim: gerçek insan fotoğrafı üretmek/kullanmak (üretilmiş
// yapay yüz görselleri dahil) yanıltıcı olur; silüet hem "onaylı fotoğrafı var"
// alanını doldurur hem de ne olduğu konusunda dürüsttür.

import { createClient } from "@supabase/supabase-js";
import {
  circle,
  createCanvas,
  encodePng,
  fill,
  hashString,
  hexToRgb,
  mix,
  ring,
  vignette,
} from "./lib/png.mjs";

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

// Varsayılan tam parti (60) dışında ad-hoc küçük partiler için (ör. manuel
// test oturumu) DEMO_USER_COUNT/DEMO_EMAIL_PREFIX ile override edilebilir —
// farklı bir prefix kullanmak var olan demo hesaplarıyla e-posta çakışmasını
// önler (aynı prefix + üst üste binen index aynı e-postayı üretir).
const USER_COUNT = Number(process.env.DEMO_USER_COUNT ?? 60);
const EMAIL_PREFIX = process.env.DEMO_EMAIL_PREFIX ?? "demo";

// Zevk kümeleri: film havuzunu ve bio tonunu belirler. `name` artık görünen ad
// değil (gerçekçi olsun diye isimler NAMES'ten geliyor), yalnızca iç etiket.
const CLUSTERS = [
  { name: "Yeşilçam sever", slug: "yesilcam", accent: "#C4433B" },
  { name: "Bilim kurgu", slug: "bilimkurgu", accent: "#17736E" },
  { name: "Festival sineması", slug: "festival", accent: "#F2547D" },
  { name: "Gişe filmleri", slug: "gise", accent: "#FFC23D" },
];

const NAMES = {
  woman: [
    "Elif",
    "Zeynep",
    "Deniz",
    "Ece",
    "Selin",
    "Merve",
    "İrem",
    "Nazlı",
    "Buse",
    "Sena",
    "Yağmur",
    "Defne",
    "Melis",
    "Ceren",
    "Pınar",
  ],
  man: [
    "Kaan",
    "Mert",
    "Emre",
    "Baran",
    "Arda",
    "Onur",
    "Tolga",
    "Can",
    "Efe",
    "Burak",
    "Umut",
    "Kerem",
    "Yiğit",
    "Alp",
    "Sarp",
  ],
};

const SURNAME_INITIALS = [
  "Y.",
  "D.",
  "K.",
  "Ş.",
  "Ç.",
  "A.",
  "Ö.",
  "T.",
  "B.",
  "E.",
];

// Küme başına doğal bio'lar — "demo kullanıcı" gibi ibareler stakeholder
// demosunda sahte duruyordu.
const BIOS = {
  yesilcam: [
    "Pazar öğleden sonraları siyah beyaz Türk filmi, yanında çay. Tartışmaya açığım.",
    "Kemal Sunal repliğiyle konuşan tipim. Susuz Yaz'ı ilk izlediğimde 14 yaşındaydım.",
    "Eski İstanbul'u filmlerden tanıyorum. Beyoğlu'nda tek başına sinemaya gitmeyi severim.",
  ],
  bilimkurgu: [
    "2001'i anlamadım ama her yıl bir kez daha deniyorum. Uzay, zaman, iyi kurgu.",
    "Bilim kurgu ve ramen. İkisini de soğutmadan tüketmek gerek.",
    "Blade Runner tartışmasında taraf seçmiş biriyim. Hangi tarafta olduğumu sorun.",
  ],
  festival: [
    "Festival programını takvime işleyen tip. Kış Uykusu'nu üç kez izledim, bitmedi.",
    "Altyazı okumaktan gözüm bozuldu ama pişman değilim. Yavaş filmler, uzun yürüyüşler.",
    "Bergman'dan sonra bir kahve içip susmak gerekir. Bunu birlikte yapacak biri arıyorum.",
  ],
  gise: [
    "Fragman izlemeden salona giren nadir insanlardan. Patlamış mısır tuzlu olacak.",
    "İyi bir gişe filmi kötü bir sanat filminden iyidir. Bu tartışmayı açtım bile.",
    "IMAX için şehir değiştiririm. Cumartesi seansı benden.",
  ],
};

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"];
// profiles.profiles_intents_valid CHECK kısıtı yalnızca dating/friendship/watch_buddy'e izin veriyor.
const INTENTS = [["dating"], ["dating", "friendship"], ["watch_buddy"]];

/**
 * Soyut, stilize portre silüeti üretir (gerçek/üretilmiş insan fotoğrafı DEĞİL —
 * bkz. dosya başındaki not). Kullanıcı kimliğinden deterministik türer, böylece
 * aynı kişi her seed'de aynı avatarı alır.
 */
function avatarPng(seedKey, accentHex) {
  const size = 512;
  const hash = hashString(seedKey);
  const canvas = createCanvas(size, size);

  const accent = hexToRgb(accentHex);
  const deep = mix(accent, hexToRgb("#131A2E"), 0.55);
  const light = mix(accent, hexToRgb("#F4F7FB"), 0.62);

  // Köşegen degrade zemin
  fill(canvas, (x, y) =>
    mix(deep, accent, (x / size) * 0.35 + (y / size) * 0.5),
  );

  // Dekoratif halka — her avatarda farklı konumda
  ring(
    canvas,
    size * (0.2 + ((hash >>> 7) % 5) / 12),
    size * 0.22,
    size * 0.2,
    3,
    light,
    0.28,
  );

  // Portre silüeti: baş + omuz
  circle(canvas, size / 2, size * 0.4, size * 0.145, light, 0.92);
  circle(canvas, size / 2, size * 0.92, size * 0.27, light, 0.92);

  vignette(canvas, 0.22);
  return encodePng(size, size, canvas.data);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomBirthdate() {
  const age = Math.floor(randomBetween(20, 45));
  const year = new Date().getFullYear() - age;
  return `${year}-0${Math.floor(randomBetween(1, 9))}-1${Math.floor(randomBetween(0, 8))}`;
}

async function main() {
  console.log(`Demo veri üretiliyor: ${USER_COUNT} kullanıcı...`);

  const { data: filmRows, error: filmError } = await admin
    .from("films")
    .select("id")
    .limit(40);
  if (filmError) throw filmError;
  if (!filmRows || filmRows.length === 0) {
    console.error(
      "Film kataloğu boş — önce tmdb-sync (fixture) çalıştırılmalı.",
    );
    process.exit(1);
  }
  const filmPools = [];
  const poolSize = Math.ceil(filmRows.length / CLUSTERS.length);
  for (let i = 0; i < CLUSTERS.length; i++) {
    filmPools.push(
      filmRows.slice(i * poolSize, (i + 1) * poolSize).map((f) => f.id),
    );
  }

  const createdUserIds = [];

  for (let i = 0; i < USER_COUNT; i++) {
    const clusterIndex = i % CLUSTERS.length;
    const cluster = CLUSTERS[clusterIndex];
    const pool =
      filmPools[clusterIndex].length > 0
        ? filmPools[clusterIndex]
        : filmRows.map((f) => f.id);
    const email = `${EMAIL_PREFIX}-${cluster.slug}-${i}@reelmate.demo`;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
    if (createError) {
      console.warn(`Kullanıcı oluşturulamadı (${email}):`, createError.message);
      continue;
    }
    const userId = created.user.id;
    createdUserIds.push(userId);

    const gender = i % 2 === 0 ? "woman" : "man";
    const interestedIn =
      i % 3 === 0 ? ["woman", "man"] : gender === "woman" ? ["man"] : ["woman"];

    const firstName = NAMES[gender][Math.floor(i / 2) % NAMES[gender].length];
    const displayName = `${firstName} ${SURNAME_INITIALS[i % SURNAME_INITIALS.length]}`;
    // `username` UNIQUE; index'i ekleyerek çakışmayı engelliyoruz.
    const username = `${firstName.toLocaleLowerCase("tr")}${i}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");

    const { error: profileUpdateError } = await admin
      .from("profiles")
      .update({
        display_name: displayName,
        username,
        bio: BIOS[cluster.slug][
          Math.floor(i / CLUSTERS.length) % BIOS[cluster.slug].length
        ],
        birthdate: randomBirthdate(),
        gender,
        interested_in: interestedIn,
        intents: INTENTS[i % INTENTS.length],
        city: CITIES[i % CITIES.length],
        age_min: 20,
        age_max: 50,
        max_distance_km: 100,
        discoverable: true,
        last_active_at: new Date().toISOString(),
        onboarding_step: "completed",
        timezone: "Europe/Istanbul",
      })
      .eq("id", userId);
    // Sessizce yutulan bir hata, kullanıcıyı fark edilmeden yarım seed'li
    // bırakırdı (bkz. Faz 11 test raporu — geçersiz bir intent değeri yüzünden
    // 60 kullanıcının 20'si onboarding_step='birthdate'de takılı kalmıştı).
    if (profileUpdateError) {
      console.warn(
        `Profil güncellenemedi (${email}):`,
        profileUpdateError.message,
      );
    }

    // İstanbul/Ankara/İzmir çevresinde rastgele bir nokta (gerçek konum değil).
    const lat = 41.0 + randomBetween(-0.5, 0.5);
    const lng = 29.0 + randomBetween(-0.5, 0.5);
    await admin
      .from("profile_locations")
      .upsert({ user_id: userId, geog: `SRID=4326;POINT(${lng} ${lat})` });

    const png = avatarPng(userId, cluster.accent);
    const storagePath = `${userId}/seed-1.png`;
    await admin.storage
      .from("profile-photos")
      .upload(storagePath, png, { contentType: "image/png", upsert: true });
    await admin.from("profile_photos").insert({
      user_id: userId,
      storage_path: storagePath,
      position: 1,
      moderation_status: "approved",
    });

    const topFour = pool.slice(0, 4);
    for (const [idx, filmId] of topFour.entries()) {
      await admin.from("user_films").insert({
        user_id: userId,
        film_id: filmId,
        status: "watched",
        rating: randomBetween(3.5, 5),
        liked: true,
        top_four_position: idx + 1,
      });
    }
    for (const filmId of pool.slice(4, 8)) {
      await admin.from("user_films").insert({
        user_id: userId,
        film_id: filmId,
        status: "watched",
        rating: randomBetween(2, 4.5),
      });
    }

    if (i % 10 === 0) console.log(`  ${i + 1}/${USER_COUNT} oluşturuldu...`);
  }

  console.log(
    `${createdUserIds.length} kullanıcı oluşturuldu. Eşleşmeye hazır çiftler kuruluyor...`,
  );

  // App Review'in "eşleşmeye hazır test kullanıcıları" isteğini karşılamak için
  // birkaç gerçek eşleşme + başlangıç mesajı (bkz. docs/app-review-notes.md).
  const pairsToMatch = Math.min(5, Math.floor(createdUserIds.length / 2));
  for (let i = 0; i < pairsToMatch; i++) {
    const a = createdUserIds[i * 2];
    const b = createdUserIds[i * 2 + 1];
    if (!a || !b) continue;
    const userLow = a < b ? a : b;
    const userHigh = a < b ? b : a;

    const { data: match, error: matchError } = await admin
      .from("matches")
      .insert({
        user_low: userLow,
        user_high: userHigh,
        compat_raw: 0.8,
        reasons: "[]",
      })
      .select("id")
      .single();
    if (matchError) {
      console.warn("Eşleşme oluşturulamadı:", matchError.message);
      continue;
    }

    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .insert({ match_id: match.id, kind: "match", status: "active" })
      .select("id")
      .single();
    if (convError) continue;

    await admin.from("conversation_members").insert([
      { conversation_id: conversation.id, user_id: userLow },
      { conversation_id: conversation.id, user_id: userHigh },
    ]);
    await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: userLow,
      kind: "text",
      body: "Selam! Listendeki filmlere baktım, epey örtüşüyoruz. En son ne izledin?",
    });
  }

  console.log(`Tamamlandı: ${pairsToMatch} demo eşleşme oluşturuldu.`);
  console.log("Demo hesap bilgileri için bkz. docs/app-review-notes.md");
}

main().catch((error) => {
  console.error("Seed betiği başarısız oldu:", error);
  process.exit(1);
});
