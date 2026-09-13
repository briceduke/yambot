import { describe, expect, test } from "bun:test";

import { loadMarkdown, runLoadBench } from "./load.ts";

describe("runLoadBench mock", () => {
  test("sweeps N=1 and N=2 with zero Java and no ffmpeg", async () => {
    const report = await runLoadBench({
      mode: "mock",
      sessionCounts: [1, 2],
      holdMs: 10,
      queueDepth: 8,
      skipStorms: 2,
    });
    expect(report.java).toBe(false);
    expect(report.mode).toBe("mock");
    expect(report.points.length).toBe(2);
    expect(report.points[0]?.sessions).toBe(1);
    expect(report.points[1]?.sessions).toBe(2);
    expect(report.points[0]?.fail_rate).toBe(0);
    expect(report.points[1]?.fail_rate).toBe(0);
    expect(report.points[0]?.ttfa_ms?.n).toBe(1);
    expect(report.points[1]?.ttfa_ms?.n).toBe(2);
    expect(report.points[1]?.rss_mb).toBeGreaterThan(0);
    const table = loadMarkdown(report);
    expect(table).toContain("| 1 |");
    expect(table).toContain("| 2 |");
  }, 15_000);
});
