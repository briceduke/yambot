import { afterEach, describe, expect, test } from "bun:test";

import type { CommandContext } from "../command-context.ts";
import {
  clearAllOverlays,
  getGuildOperatorView,
  setGuildOverlayDjRoleId,
} from "../operator-config.ts";
import { executeSetDj } from "./setdj.ts";

const GUILD_ID = "setdj-guild-1";
const ROLE_ID = "12345678901234567";

afterEach(() => {
  clearAllOverlays();
});

describe("executeSetDj", () => {
  test("sets the overlay from a raw snowflake and a role mention", async () => {
    const snowflakeCtx = createContext(ROLE_ID);
    await executeSetDj(snowflakeCtx);
    expect(snowflakeCtx.replies).toEqual([`DJ role set to <@&${ROLE_ID}>.`]);
    expect(getGuildOperatorView(GUILD_ID, process.env).djRoleId).toBe(ROLE_ID);

    const mentionCtx = createContext(`<@&${ROLE_ID}>`);
    await executeSetDj(mentionCtx);
    expect(mentionCtx.replies).toEqual([`DJ role set to <@&${ROLE_ID}>.`]);
    expect(getGuildOperatorView(GUILD_ID, process.env).djRoleId).toBe(ROLE_ID);
  });

  test("clears the overlay on empty, none, and NONE", async () => {
    setGuildOverlayDjRoleId(GUILD_ID, ROLE_ID);

    const emptyCtx = createContext("");
    await executeSetDj(emptyCtx);
    expect(emptyCtx.replies).toEqual(["DJ role cleared. DJ commands are open."]);
    expect(getGuildOperatorView(GUILD_ID, { DJ_ROLE_ID: "env-role" }).djRoleId).toBe(
      null,
    );

    setGuildOverlayDjRoleId(GUILD_ID, ROLE_ID);
    const noneCtx = createContext("none");
    await executeSetDj(noneCtx);
    expect(noneCtx.replies).toEqual(["DJ role cleared. DJ commands are open."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).djRoleId).toBeNull();

    setGuildOverlayDjRoleId(GUILD_ID, ROLE_ID);
    const upperCtx = createContext(" NONE ");
    await executeSetDj(upperCtx);
    expect(upperCtx.replies).toEqual(["DJ role cleared. DJ commands are open."]);
    expect(getGuildOperatorView(GUILD_ID, process.env).djRoleId).toBeNull();
  });

  test("replies usage and does not change overlay for invalid args", async () => {
    setGuildOverlayDjRoleId(GUILD_ID, ROLE_ID);
    const cases: readonly string[] = [
      "abc",
      "123",
      `<@${ROLE_ID}>`,
      `<#${ROLE_ID}>`,
      "1234567890123456",
      "123456789012345678901",
    ];
    for (const args of cases) {
      const ctx = createContext(args);
      await executeSetDj(ctx);
      expect(ctx.replies).toEqual(["Usage: /setdj <role>"]);
    }
    expect(getGuildOperatorView(GUILD_ID, process.env).djRoleId).toBe(ROLE_ID);
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
