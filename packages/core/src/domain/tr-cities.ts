/**
 * PRD 14.2: "Konum izni verilmezse şehir merkezi kullanılır." Gerçek bir
 * geocoding sağlayıcısı entegre edilmediği için (kapsam dışı), en büyük
 * Türkiye şehirlerinin yaklaşık merkez koordinatları burada sabit tutuluyor.
 * Eşleşme `slugify` ile normalize edilmiş şehir adı üzerinden yapılır.
 */
export const TR_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  istanbul: { lat: 41.0082, lng: 28.9784 },
  ankara: { lat: 39.9334, lng: 32.8597 },
  izmir: { lat: 38.4237, lng: 27.1428 },
  bursa: { lat: 40.1885, lng: 29.061 },
  antalya: { lat: 36.8969, lng: 30.7133 },
  adana: { lat: 37.0, lng: 35.3213 },
  konya: { lat: 37.8746, lng: 32.4932 },
  gaziantep: { lat: 37.0662, lng: 37.3833 },
  sanliurfa: { lat: 37.1591, lng: 38.7969 },
  kayseri: { lat: 38.7312, lng: 35.4787 },
  mersin: { lat: 36.8, lng: 34.6333 },
  eskisehir: { lat: 39.7767, lng: 30.5206 },
  diyarbakir: { lat: 37.9144, lng: 40.2306 },
  samsun: { lat: 41.2867, lng: 36.33 },
  denizli: { lat: 37.7765, lng: 29.0864 },
  trabzon: { lat: 41.0027, lng: 39.7168 },
  malatya: { lat: 38.3552, lng: 38.3095 },
  erzurum: { lat: 39.9, lng: 41.27 },
  van: { lat: 38.4891, lng: 43.4089 },
  mugla: { lat: 37.2153, lng: 28.3636 },
};
