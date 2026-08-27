import { afterEach, describe, expect, test } from "bun:test";

import type { CommandContext } from "../command-context.ts";
import {
  clearAllOverlays,
  getGuildOperatorView,
  setGuildOverlayVoiceChannelId,
} from "../operator-config.ts";
import { executeSetVc } from "./setvc.ts";

const GUILD_ID = "setvc-guild-1";
const CHANNEL_ID = "32345678901234567";

afterEach(() => {
  clearAllOverlays();
});

describe("executeSetVc", () => {
  test("sets the overlay from a raw snowflake and a channel mention", async () => {
    const snowflakeCtx = createContext(CHANNEL_ID);
    await executeSetVc(snowflakeCtx);
    expect(snowflakeCtx.replies).toEqual([
      `Voice channel set to <#${CHANNEL_ID}>.`,
    ]);
    expect(getGuildOperatorView(GUILD_ID, process.env).voiceChannelId).toBe(
      CHANNEL_ID,
    );

    const mentionCtx = createContext(`<#${CHANNEL_ID}>`);
    await executeSetVc(mentionCtx);
    expect(mentionCtx.replies).toEqual([
      `Voice channel set to <#${CHANNEL_ID}>.`,
    ]);
    expect(getGuildOperatorView(GUILD_ID, process.env).voiceChannelId).toBe(
      CHANNEL_ID,
    );
  });

  test("clears the overlay on empty, none, and NONE", async () => {
    setGuildOverlayVoiceChannelId(GUILD_ID, CHANNEL_ID);

    const emptyCtx = createContext("");
    await executeSetVc(emptyCtx);
    expect(emptyCtx.replies).toEqual(["Voice channel cleared."]);
    expect(
      getGuildOperatorView(GUILD_ID, process.env).voiceChannelId,
    ).toBeNull();

    setGuildOverlayVoiceChannelId(GUILD_ID, CHANNEL_ID);
    const noneCtx = createContext("none");
    await executeSetVc(noneCtx);
    expect(noneCtx.replies).toEqual(["Voice channel cleared."]);
    expect(
      getGuildOperatorView(GUILD_ID, process.env).voiceChannelId,
    ).toBeNull();

    setGuildOverlayVoiceChannelId(GUILD_ID, CHANNEL_ID);
    const upperCtx = createContext(" NONE ");
    await executeSetVc(upperCtx);
    expect(upperCtx.replies).toEqual(["Voice channel cleared."]);
    expect(
      getGuildOperatorView(GUILD_ID, process.env).voiceChannelId,
    ).toBeNull();
  });

  test("replies usage and does not change overlay for invalid args", async () => {
    setGuildOverlayVoiceChannelId(GUILD_ID, CHANNEL_ID);
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
      await executeSetVc(ctx);
      expect(ctx.replies).toEqual(["Usage: /setvc <channel>"]);
    }
    expect(getGuildOperatorView(GUILD_ID, process.env).voiceChannelId).toBe(
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
