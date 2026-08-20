import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { executeNowPlaying } from "./nowplaying.ts";

describe("executeNowPlaying", () => {
  test("replies nothing playing when session is missing or idle", async () => {
    const missingCtx = createContext();
    await executeNowPlaying(missingCtx, undefined);
    expect(missingCtx.replies).toEqual(["Nothing is playing."]);

    const session = new FakeSession();
    const idleCtx = createContext();
    await executeNowPlaying(idleCtx, session.asGuildSession());
    expect(idleCtx.replies).toEqual(["Nothing is playing."]);
  });

  test("replies Now playing with elapsed, duration, and wrapped URL", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    session.elapsedMs = 65_000;
    const ctx = createContext();

    await executeNowPlaying(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Now playing: Never Gonna Give You Up (1:05 / 3:33)\n<https://www.youtube.com/watch?v=dQw4w9wgGcQ>",
    ]);
  });

  test("replies Paused with elapsed, duration, and wrapped URL", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Never Gonna Give You Up", 213);
    session.elapsedMs = 65_000;
    session.paused = true;
    const ctx = createContext();

    await executeNowPlaying(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Paused: Never Gonna Give You Up (1:05 / 3:33)\n<https://www.youtube.com/watch?v=dQw4w9wgGcQ>",
    ]);
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
  elapsedMs = 0;

  isPaused(): boolean {
    return this.paused;
  }

  playbackDurationMs(): number {
    return this.elapsedMs;
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
    uri: "https://www.youtube.com/watch?v=dQw4w9wgGcQ",
    durationSeconds,
  };
}
