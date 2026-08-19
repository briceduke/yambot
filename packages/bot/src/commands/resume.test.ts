import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { executeResume } from "./resume.ts";

describe("executeResume", () => {
  test("replies nothing playing when session is missing or idle", async () => {
    const missingCtx = createContext();
    await executeResume(missingCtx, undefined);
    expect(missingCtx.replies).toEqual(["Nothing is playing."]);

    const session = new FakeSession();
    const idleCtx = createContext();
    await executeResume(idleCtx, session.asGuildSession());
    expect(idleCtx.replies).toEqual(["Nothing is playing."]);
    expect(session.unpauseCallCount).toBe(0);
  });

  test("replies Nothing is paused when current and playing", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    const ctx = createContext();

    await executeResume(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Nothing is paused."]);
    expect(session.unpauseCallCount).toBe(0);
  });

  test("replies Resumed and unpauses", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    session.paused = true;
    const ctx = createContext();

    await executeResume(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Resumed: Never Gonna Give You Up"]);
    expect(session.unpauseCallCount).toBe(1);
    expect(session.paused).toBe(false);
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
  paused = false;
  unpauseCallCount = 0;

  isPaused(): boolean {
    return this.paused;
  }

  unpause(): boolean {
    this.unpauseCallCount += 1;
    this.paused = false;
    return true;
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
