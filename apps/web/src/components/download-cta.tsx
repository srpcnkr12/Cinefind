"use client";

import { getDownloadUrl, type AttributionPosition } from "@/lib/attribution";
import { trackEvent } from "@movieholix/core/domain/analytics";

type Props = {
  position: AttributionPosition;
  appStoreLabel: string;
  googlePlayLabel: string;
  className?: string;
};

export function DownloadCta({
  position,
  appStoreLabel,
  googlePlayLabel,
  className,
}: Props) {
  return (
    <div className={`flex flex-wrap gap-3 ${className ?? ""}`}>
      <a
        href={getDownloadUrl("ios", position)}
        onClick={() =>
          trackEvent("web_cta_clicked", { pageType: position, position: "ios" })
        }
        className="rounded-button bg-reel px-5 py-3 font-body text-sm font-semibold text-white"
      >
        {appStoreLabel}
      </a>
      <a
        href={getDownloadUrl("android", position)}
        onClick={() =>
          trackEvent("web_cta_clicked", {
            pageType: position,
            position: "android",
          })
        }
        className="rounded-button bg-ink px-5 py-3 font-body text-sm font-semibold text-screen dark:bg-screen dark:text-ink"
      >
        {googlePlayLabel}
      </a>
    </div>
  );
}
