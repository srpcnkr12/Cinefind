"use client";

import { useSyncExternalStore } from "react";
import { getDownloadUrl } from "@/lib/attribution";

const COOKIE_NAME = "reelmate-hide-sticky-bar";
const listeners = new Set<() => void>();

function hasDismissCookie(): boolean {
  return document.cookie
    .split("; ")
    .some((c) => c.startsWith(`${COOKIE_NAME}=`));
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot() {
  return hasDismissCookie();
}

function getServerSnapshot() {
  return false;
}

function dismiss() {
  // Bitiş tarihi verilmez → tarayıcı oturumu kapanınca silinen bir oturum çerezi.
  document.cookie = `${COOKIE_NAME}=1; path=/; SameSite=Lax`;
  for (const listener of listeners) listener();
}

type Props = {
  text: string;
  closeLabel: string;
};

/** Yalnızca mobil genişlikte görünür, oturum çerezi ile kapatma tercihi hatırlanır (PRD 19, Faz 2). */
export function StickyDownloadBar({ text, closeLabel }: Props) {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-ink px-4 py-3 text-screen md:hidden">
      <a
        href={getDownloadUrl("ios", "film_bar")}
        className="font-body text-sm font-semibold"
      >
        {text}
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label={closeLabel}
        className="shrink-0 rounded-button px-2 py-1 font-body text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
