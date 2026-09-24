/**
 * PRD bölüm 17.1 — olay taksonomisi. Her olayın özellik şekli burada
 * sabitlenir; mesaj içeriği/kesin konum/cinsel yönelim alanı YOK — tipin
 * kendisi bunu imkânsız kılıyor (bkz. docs/events.md).
 */
export type AnalyticsEventProperties = {
  app_opened: Record<string, never>;
  signup_started: Record<string, never>;
  signup_completed: Record<string, never>;
  onboarding_step_completed: { step: string };
  taste_test_completed: { ratedCount: number; durationS: number };
  top_four_set: Record<string, never>;
  film_status_changed: { status: string; source: string };
  film_rated: { ratingBucket: string };
  diary_entry_created: Record<string, never>;
  line_created: Record<string, never>;
  discover_card_viewed: Record<string, never>;
  swipe: { action: string; compatBucket: string };
  swipe_limit_reached: Record<string, never>;
  match_created: { compatBucket: string; reasonsCount: number };
  icebreaker_used: Record<string, never>;
  message_sent: { kind: string; isFirst: boolean };
  conversation_reached_10_messages: Record<string, never>;
  shared_watchlist_item_added: Record<string, never>;
  post_created: { type: string; hasSpoiler: boolean };
  post_liked: Record<string, never>;
  comment_created: Record<string, never>;
  follow_requested: Record<string, never>;
  paywall_viewed: { trigger: string };
  purchase_started: { product: string };
  purchase_completed: { product: string };
  boost_used: Record<string, never>;
  super_message_sent: Record<string, never>;
  report_submitted: { targetType: string; reason: string };
  user_blocked: Record<string, never>;
  assistant_message_sent: Record<string, never>;
  web_cta_clicked: { pageType: string; position: string };
};

export type AnalyticsEventName = keyof AnalyticsEventProperties;

export type AnalyticsSink = <E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventProperties[E],
) => void;

let sink: AnalyticsSink | null = null;

/**
 * Her app (mobil/web) kendi PostHog sarmalayıcısını başlangıçta buraya
 * kaydeder. `packages/core`/`packages/api` böylece belirli bir SDK'ya
 * bağımlı kalmadan olay gönderebilir (bkz. Faz 10 planı).
 */
export function setAnalyticsSink(fn: AnalyticsSink | null): void {
  sink = fn;
}

export function trackEvent<E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventProperties[E],
): void {
  sink?.(name, properties);
}
