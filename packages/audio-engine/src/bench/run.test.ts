import { describe, expect, test } from "bun:test";

import { runEngineBench } from "./run.ts";

describe("runEngineBench", () => {
  test("returns required offline metric keys", async () => {
    const report = await runEngineBench(2);
    expect(report.mode).toBe("offline");
    expect(report.n).toBe(2);
    expect(report.resolve_ms.youtube_url.n).toBe(2);
    expect(report.resolve_ms.youtube_search.n).toBe(2);
    expect(report.resolve_ms.soundcloud_url.n).toBe(2);
    expect(report.open_audio_ms.youtube.n).toBe(2);
    expect(report.open_audio_ms.soundcloud.n).toBe(2);
    expect(report.youtube_resolve_then_open_ms.n).toBe(2);
    expect(report.playlist_enqueue_ms.n).toBe(2);
    expect(report.rss_mb).toBeGreaterThan(0);
    expect(report.heap_mb).toBeGreaterThan(0);
  }, 20_000);
});
