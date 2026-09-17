import { describe, expect, test } from "bun:test";

import { runBotBench } from "./run.ts";

describe("runBotBench", () => {
  test("returns required offline metric keys", async () => {
    const report = await runBotBench(2);
    expect(report.mode).toBe("offline");
    expect(report.n).toBe(2);
    expect(report.ttfa_ms.n).toBe(2);
    expect(report.skip_ms.n).toBe(2);
    expect(report.ttfa_ms.p50).toBeGreaterThan(0);
    expect(report.skip_ms.p50).toBeGreaterThan(0);
  }, 30_000);
});
