import { afterEach, describe, expect, test } from "bun:test";

import type { CommandContext } from "../command-context.ts";
import { clearAllOverlays, setGuildOverlayPrefix } from "../operator-config.ts";
import { executeHelp } from "./help.ts";

const GUILD_ID = "help-guild-1";

afterEach(() => {
  clearAllOverlays();
});

describe("executeHelp", () => {
  test("lists command classes and uses the guild view prefix", async () => {
    setGuildOverlayPrefix(GUILD_ID, "?");
    const ctx = createContext();

    await executeHelp(ctx);

    expect(ctx.replies).toEqual([
      [
        "Music: play, scsearch, queue, nowplaying (np), skip",
        "DJ (when a DJ role is set): pause, resume, remove, shuffle, clear, stop, skip",
        "Admin (Manage Server): prefix, setdj, settc, setvc",
        "Also: settings, help",
        "Prefix: ? and @mention. Example: ?play and @bot skip",
      ].join("\n"),
    ]);
  });

  test("writes @mention and @bot as words, not live mentions", async () => {
    const ctx = createContext();

    await executeHelp(ctx);

    const body: string | undefined = ctx.replies[0];
    expect(body).toBeDefined();
    expect(body).toContain("@mention");
    expect(body).toContain("@bot");
    expect(body).not.toMatch(/<@!?&?\d+>/);
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

function createContext(): FakeContext {
  return new FakeContext("");
}
