import { describe, expect, test } from "bun:test";

import {
  percentile,
  roundMs,
  summarizeSamples,
  timeManyAsync,
} from "./stats.ts";

describe("percentile", () => {
  test("returns the only value for a one-sample list", () => {
    expect(percentile([10], 50)).toBe(10);
    expect(percentile([10], 95)).toBe(10);
  });

  test("interpolates between sorted samples", () => {
    expect(percentile([0, 10, 20, 30], 50)).toBe(15);
    expect(percentile([0, 100], 95)).toBe(95);
  });
});

describe("summarizeSamples", () => {
  test("reports n, min, max, and rounded percentiles", () => {
    const summary = summarizeSamples([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(summary.n).toBe(10);
    expect(summary.min).toBe(1);
    expect(summary.max).toBe(10);
    expect(summary.p50).toBe(5.5);
    expect(summary.p95).toBe(9.55);
  });

  test("throws when the list is empty", () => {
    expect(() => summarizeSamples([])).toThrow(
      "summarizeSamples needs at least one sample.",
    );
  });
});

describe("timeManyAsync", () => {
  test("runs n times and returns positive samples", async () => {
    let runs = 0;
    const summary = await timeManyAsync(3, async () => {
      runs += 1;
    });
    expect(runs).toBe(3);
    expect(summary.n).toBe(3);
    expect(summary.min).toBeGreaterThanOrEqual(0);
    expect(roundMs(1.23456)).toBe(1.235);
  });
});
