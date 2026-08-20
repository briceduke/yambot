import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { executePause } from "./pause.ts";

describe("executePause", () => {
  test("replies nothing playing when session is missing or idle", async () => {
    const missingCtx = createContext();
    await executePause(missingCtx, undefined);
    expect(missingCtx.replies).toEqual(["Nothing is playing."]);

    const session = new FakeSession();
    const idleCtx = createContext();
    await executePause(idleCtx, session.asGuildSession());
    expect(idleCtx.replies).toEqual(["Nothing is playing."]);
    expect(session.pauseCallCount).toBe(0);
    expect(session.idleHookCallCount).toBe(0);
  });

  test("replies Already paused and does not pause again", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    session.paused = true;
    const ctx = createContext();

    await executePause(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Already paused."]);
    expect(session.pauseCallCount).toBe(0);
    expect(session.idleHookCallCount).toBe(0);
  });

  test("replies Paused and does not call the idle advance hook", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    const ctx = createContext();

    await executePause(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Paused: Never Gonna Give You Up"]);
    expect(session.pauseCallCount).toBe(1);
    expect(session.paused).toBe(true);
    expect(session.idleHookCallCount).toBe(0);
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
  pauseCallCount = 0;
  idleHookCallCount = 0;

  isPaused(): boolean {
    return this.paused;
  }

  pause(): boolean {
    this.pauseCallCount += 1;
    this.paused = true;
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
