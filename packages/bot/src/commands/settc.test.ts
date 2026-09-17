import { afterEach, describe, expect, test } from "bun:test";

import type { CommandContext } from "../command-context.ts";
import {
  clearAllOverlays,
  getGuildOperatorView,
  setGuildOverlayTextChannelId,
} from "../operator-config.ts";
import { executeSetTc } from "./settc.ts";

const GUILD_ID = "settc-guild-1";
const CHANNEL_ID = "22345678901234567";

afterEach(() => {
  clearAllOverlays();
});

describe("executeSetTc", () => {
  test("sets the overlay from a raw snowflake and a channel mention", async () => {
    const snowflakeCtx = createContext(CHANNEL_ID);
    await executeSetTc(snowflakeCtx);
    expect(snowflakeCtx.replies).toEqual([
      `Text channel set to <#${CHANNEL_ID}>.`,
    ]);
    expect(getGuildOperatorView(GUILD_ID, process.env).textChannelId).toBe(
      CHANNEL_ID,
    );

    const mentionCtx = createContext(`<#${CHANNEL_ID}>`);
    await executeSetTc(mentionCtx);
    expect(mentionCtx.replies).toEqual([
      `Text channel set to <#${CHANNEL_ID}>.`,
    ]);
    expect(getGuildOperatorView(GUILD_ID, process.env).textChannelId).toBe(
      CHANNEL_ID,
    );
  });

  test("clears the overlay on empty, none, and NONE", async () => {
    setGuildOverlayTextChannelId(GUILD_ID, CHANNEL_ID);

    const emptyCtx = createContext("");
    await executeSetTc(emptyCtx);
    expect(emptyCtx.replies).toEqual(["Text channel cleared."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).textChannelId).toBeNull();

    setGuildOverlayTextChannelId(GUILD_ID, CHANNEL_ID);
    const noneCtx = createContext("none");
    await executeSetTc(noneCtx);
    expect(noneCtx.replies).toEqual(["Text channel cleared."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).textChannelId).toBeNull();

    setGuildOverlayTextChannelId(GUILD_ID, CHANNEL_ID);
    const upperCtx = createContext(" NONE ");
    await executeSetTc(upperCtx);
    expect(upperCtx.replies).toEqual(["Text channel cleared."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).textChannelId).toBeNull();
  });

  test("replies usage and does not change overlay for invalid args", async () => {
    setGuildOverlayTextChannelId(GUILD_ID, CHANNEL_ID);
    const cases: readonly string[] = [
      "abc",
      "123",
      `<@&${CHANNEL_ID}>`,
      `<@${CHANNEL_ID}>`,
      "1234567890123456",
      "123456789012345678901",
    ];
    for (const args of cases) {
      const ctx = createContext(args);
      await executeSetTc(ctx);
      expect(ctx.replies).toEqual(["Usage: /settc <channel>"]);
    }
    expect(getGuildOperatorView(GUILD_ID, process.env).textChannelId).toBe(
      CHANNEL_ID,
    );
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
