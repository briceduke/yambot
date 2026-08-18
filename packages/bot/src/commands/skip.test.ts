import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { executeSkip } from "./skip.ts";

describe("executeSkip", () => {
  test("replies nothing playing when session is missing or idle", async () => {
    const missingCtx = createContext();
    await executeSkip(missingCtx, undefined);
    expect(missingCtx.replies).toEqual(["Nothing is playing."]);

    const session = new FakeSession();
    const idleCtx = createContext();
    await executeSkip(idleCtx, session.asGuildSession());
    expect(idleCtx.replies).toEqual(["Nothing is playing."]);
    expect(session.skipCallCount).toBe(0);
  });

  test("replies Skipped and calls skipCurrent", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    const ctx = createContext();

    await executeSkip(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Skipped: Never Gonna Give You Up"]);
    expect(session.skipCallCount).toBe(1);
  });
});

class FakeContext implements CommandContext {
  readonly guildId = "guild-1";
  readonly channelId = "text-1";
  readonly invokerVoiceChannelId: string | null = null;
  readonly args = "";
  readonly replies: string[] = [];

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }
}

class FakeSession {
  currentTrack: Track | null = null;
  skipCallCount = 0;

  skipCurrent(): Track | null {
    this.skipCallCount += 1;
    const skipped: Track | null = this.currentTrack;
    this.currentTrack = null;
    return skipped;
  }

  asGuildSession(): GuildMusicSession {
    return this as unknown as GuildMusicSession;
  }
}

function createContext(): FakeContext {
  return new FakeContext();
}

function sampleTrack(title: string, durationSeconds: number): Track {
  return {
    title,
    uri: `https://www.youtube.com/watch?v=${title}`,
    durationSeconds,
  };
}
