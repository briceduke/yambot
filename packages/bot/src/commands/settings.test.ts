import { afterEach, describe, expect, test } from "bun:test";

import type { CommandContext } from "../command-context.ts";
import {
  clearAllOverlays,
  readOperatorEnv,
  setGuildOverlayDjRoleId,
  setGuildOverlayPrefix,
  setGuildOverlayTextChannelId,
  setGuildOverlayVoiceChannelId,
} from "../operator-config.ts";
import { executeSettings } from "./settings.ts";

const GUILD_ID = "settings-guild-1";
const ROLE_ID = "12345678901234567";
const TEXT_ID = "22345678901234567";
const VOICE_ID = "32345678901234567";

afterEach(() => {
  clearAllOverlays();
});

describe("executeSettings", () => {
  test("shows none for DJ and channels when overlay is clear", async () => {
    setGuildOverlayDjRoleId(GUILD_ID, null);
    const ctx = createContext();

    await executeSettings(ctx);

    const env = readOperatorEnv(process.env);
    const aloneLine: string =
      env.aloneTimeUntilStopSeconds === 0
        ? "Alone time until stop: off"
        : `Alone time until stop: ${env.aloneTimeUntilStopSeconds}s`;
    expect(ctx.replies).toEqual([
      [
        `Prefix: \`${env.commandPrefix}\``,
        "DJ role: none — DJ commands are open",
        "Text channel: none",
        "Voice channel: none",
        `Stay in channel: ${env.stayInChannel ? "yes" : "no"}`,
        aloneLine,
        `Idle leave: ${env.idleLeaveSeconds}s`,
      ].join("\n"),
    ]);
  });

  test("shows overlay prefix, DJ role, and channel mentions", async () => {
    setGuildOverlayPrefix(GUILD_ID, "?");
    setGuildOverlayDjRoleId(GUILD_ID, ROLE_ID);
    setGuildOverlayTextChannelId(GUILD_ID, TEXT_ID);
    setGuildOverlayVoiceChannelId(GUILD_ID, VOICE_ID);
    const ctx = createContext();

    await executeSettings(ctx);

    const body: string | undefined = ctx.replies[0];
    expect(body).toBeDefined();
    expect(body).toContain("Prefix: `?`");
    expect(body).toContain(`DJ role: <@&${ROLE_ID}>`);
    expect(body).toContain(`Text channel: <#${TEXT_ID}>`);
    expect(body).toContain(`Voice channel: <#${VOICE_ID}>`);
    expect(body).not.toContain("DJ role: none — DJ commands are open");
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
