"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "reelmate-theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

type Props = {
  lightLabel: string;
  darkLabel: string;
};

export function ThemeToggle({ lightLabel, darkLabel }: Props) {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yok say.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-button bg-reel px-5 py-3 font-body text-sm font-semibold text-white"
    >
      {isDark ? lightLabel : darkLabel}
    </button>
  );
}
