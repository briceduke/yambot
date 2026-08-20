import { describe, expect, test } from "bun:test";

import { formatDuration } from "./format-duration.ts";

describe("formatDuration", () => {
  test("formats m:ss under one hour", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(213)).toBe("3:33");
    expect(formatDuration(3599)).toBe("59:59");
  });

  test("formats h:mm:ss at one hour and over", () => {
    expect(formatDuration(3600)).toBe("1:00:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
