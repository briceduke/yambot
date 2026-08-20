import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { resolveAppRoot } from "../paths.ts";
import { runEngineSeam } from "./run.ts";

const fixtureRoot: string = join(import.meta.dir, "fixtures", "bad-engine");

describe("runEngineSeam", () => {
  test("reports a violation when the engine depends on discord.js", async () => {
    const result = await runEngineSeam(fixtureRoot);
    expect(result.scanner).toBe("engine-seam");
    expect(
      result.violations.some((violation) => violation.rule === "r1-no-discord"),
    ).toBe(true);
  });

  test("reports zero violations on the shipped app tree", async () => {
    const result = await runEngineSeam(resolveAppRoot());
    expect(result.violations).toEqual([]);
  });
});
