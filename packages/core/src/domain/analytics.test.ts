import { describe, expect, it, beforeEach } from "vitest";
import {
  setAnalyticsSink,
  trackEvent,
  type AnalyticsEventName,
} from "./analytics";

describe("analytics sink", () => {
  beforeEach(() => {
    setAnalyticsSink(null);
  });

  it("does nothing when no sink is registered", () => {
    expect(() => trackEvent("app_opened", {})).not.toThrow();
  });

  it("calls the registered sink with the exact event name and properties", () => {
    const calls: { name: AnalyticsEventName; properties: unknown }[] = [];
    setAnalyticsSink((name, properties) => {
      calls.push({ name, properties });
    });

    trackEvent("swipe", { action: "like", compatBucket: "80-89" });

    expect(calls).toEqual([
      { name: "swipe", properties: { action: "like", compatBucket: "80-89" } },
    ]);
  });

  it("stops calling the sink after it is cleared", () => {
    let callCount = 0;
    setAnalyticsSink(() => {
      callCount += 1;
    });
    trackEvent("app_opened", {});
    setAnalyticsSink(null);
    trackEvent("app_opened", {});

    expect(callCount).toBe(1);
  });

  it("never carries message content, exact location, or sexual-orientation fields by construction", () => {
    const calls: unknown[] = [];
    setAnalyticsSink((_name, properties) => calls.push(properties));

    trackEvent("message_sent", { kind: "text", isFirst: true });
    trackEvent("post_created", { type: "review", hasSpoiler: false });

    for (const properties of calls) {
      const keys = Object.keys(properties as object);
      expect(keys).not.toContain("body");
      expect(keys).not.toContain("lat");
      expect(keys).not.toContain("lng");
      expect(keys).not.toContain("interestedIn");
    }
  });
});
