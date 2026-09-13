import { describe, expect, test } from "bun:test";

import type { SampleSummary } from "./stats.ts";
import {
  buildWinnerRow,
  decideWinner,
  winnerMarkdown,
} from "./winner.ts";

const yambotFast: SampleSummary = {
  n: 10,
  p50: 10,
  p95: 12,
  min: 9,
  max: 13,
};

const lavalinkSlow: SampleSummary = {
  n: 10,
  p50: 20,
  p95: 25,
  min: 18,
  max: 30,
};

describe("decideWinner", () => {
  test("picks the lower p50", () => {
    expect(decideWinner(yambotFast, lavalinkSlow)).toBe("yambot");
    expect(decideWinner(lavalinkSlow, yambotFast)).toBe("lavalink");
  });

  test("ties equal p50", () => {
    expect(decideWinner(yambotFast, { ...lavalinkSlow, p50: 10 })).toBe("tie");
  });

  test("labels a missing side as can't tell yet", () => {
    expect(decideWinner(yambotFast, null)).toBe("can't tell yet");
    expect(decideWinner(null, lavalinkSlow)).toBe("can't tell yet");
  });
});

describe("buildWinnerRow", () => {
  test("fills delta as yambot minus Lavalink", () => {
    const row = buildWinnerRow("load_ms", yambotFast, lavalinkSlow, "http");
    expect(row.deltaP50).toBe(-10);
    expect(row.winner).toBe("yambot");
    expect(row.note).toBe("http");
  });
});

describe("winnerMarkdown", () => {
  test("prints a table with a can't-tell row", () => {
    const table = winnerMarkdown([
      buildWinnerRow("load_ms", yambotFast, lavalinkSlow, "http"),
      buildWinnerRow("youtube_load_ms", null, null, "bot wall"),
    ]);
    expect(table).toContain("| load_ms | 10 | 12 | 20 | 25 | -10 | yambot |");
    expect(table).toContain("can't tell yet");
    expect(table).toContain("| youtube_load_ms | — | — | — | — | — |");
  });
});
