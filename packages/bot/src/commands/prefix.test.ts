import { afterEach, describe, expect, test } from "bun:test";

import type { CommandContext } from "../command-context.ts";
import {
  clearAllOverlays,
  getGuildOperatorView,
  readOperatorEnv,
  setGuildOverlayPrefix,
} from "../operator-config.ts";
import { executePrefix } from "./prefix.ts";

const GUILD_ID = "prefix-guild-1";

afterEach(() => {
  clearAllOverlays();
});

describe("executePrefix", () => {
  test("sets a 1-character and an 8-character prefix", async () => {
    const shortCtx = createContext("?");
    await executePrefix(shortCtx);
    expect(shortCtx.replies).toEqual(["Prefix set to `?`."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).prefix).toBe("?");

    const longCtx = createContext("abcdefgh");
    await executePrefix(longCtx);
    expect(longCtx.replies).toEqual(["Prefix set to `abcdefgh`."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).prefix).toBe("abcdefgh");
  });

  test("replies usage for empty args and does not change overlay", async () => {
    const ctx = createContext("");
    await executePrefix(ctx);
    expect(ctx.replies).toEqual(["Usage: /prefix <prefix>"]);
    expect(getGuildOperatorView(GUILD_ID, process.env).prefix).toBe(
      readOperatorEnv(process.env).commandPrefix,
    );
  });

  test("rejects whitespace-only and prefixes longer than 8 characters", async () => {
    const whitespaceCtx = createContext("   ");
    await executePrefix(whitespaceCtx);
    expect(whitespaceCtx.replies).toEqual(["Prefix must be 1 to 8 characters."]);

    const tooLongCtx = createContext("abcdefghi");
    await executePrefix(tooLongCtx);
    expect(tooLongCtx.replies).toEqual(["Prefix must be 1 to 8 characters."]);

    expect(getGuildOperatorView(GUILD_ID, process.env).prefix).toBe(
      readOperatorEnv(process.env).commandPrefix,
    );
  });

  test("none clears the overlay and replies with the env prefix", async () => {
    setGuildOverlayPrefix(GUILD_ID, "?");
    const envPrefix: string = readOperatorEnv(process.env).commandPrefix;
    const ctx = createContext("none");

    await executePrefix(ctx);

    expect(ctx.replies).toEqual([`Prefix reset to \`${envPrefix}\`.`]);
    expect(getGuildOperatorView(GUILD_ID, process.env).prefix).toBe(envPrefix);
  });
});

class FakeContext implements CommandContext {
  readonly guildId = GUILD_ID;
  readonly channelId = "text-1";
  readonly invokerVoiceChannelId: string | null = null;
  readonly args: string;
  readonly replies: string[] = [];

  constructor(args: string) {
    this.args = args;
  }

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }
}

function createContext(args: string): FakeContext {
  return new FakeContext(args);
}
