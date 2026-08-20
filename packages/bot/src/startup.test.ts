import { describe, expect, test } from "bun:test";

import {
  disallowedIntentsMessage,
  exitIfDisallowedIntents,
  missingTokenMessage,
  requireDiscordToken,
} from "./startup.ts";

describe("requireDiscordToken", () => {
  test("writes the pinned message and exits 1 when the token is missing", () => {
    const result = runRequireToken({});
    expect(result.writes).toEqual([missingTokenMessage]);
    expect(result.exits).toEqual([1]);
    expect(result.token).toBe("");
  });

  test("writes the pinned message and exits 1 when the token is blank", () => {
    const result = runRequireToken({ DISCORD_TOKEN: "   " });
    expect(result.writes).toEqual([missingTokenMessage]);
    expect(result.exits).toEqual([1]);
  });

  test("returns the token and does not exit when it is set", () => {
    const result = runRequireToken({ DISCORD_TOKEN: "test-token" });
    expect(result.writes).toEqual([]);
    expect(result.exits).toEqual([]);
    expect(result.token).toBe("test-token");
  });
});

describe("exitIfDisallowedIntents", () => {
  test("writes the intents message and exits 1 on code 4014", () => {
    const result = runIntentExit(4014);
    expect(result.writes).toEqual([disallowedIntentsMessage]);
    expect(result.exits).toEqual([1]);
  });

  test("does not exit on other close codes", () => {
    expect(runIntentExit(1000)).toEqual({ writes: [], exits: [] });
    expect(runIntentExit(4004)).toEqual({ writes: [], exits: [] });
  });
});

function runRequireToken(env: NodeJS.ProcessEnv): {
  readonly token: string;
  readonly writes: readonly string[];
  readonly exits: readonly number[];
} {
  const writes: string[] = [];
  const exits: number[] = [];
  const token: string = requireDiscordToken(
    env,
    (message) => {
      writes.push(message);
    },
    (code) => {
      exits.push(code);
    },
  );
  return { token, writes, exits };
}

function runIntentExit(code: number): {
  readonly writes: readonly string[];
  readonly exits: readonly number[];
} {
  const writes: string[] = [];
  const exits: number[] = [];
  exitIfDisallowedIntents(
    code,
    (message) => {
      writes.push(message);
    },
    (exitCode) => {
      exits.push(exitCode);
    },
  );
  return { writes, exits };
}
