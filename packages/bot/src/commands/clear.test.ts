import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import * as guildMusicSession from "../guild-music-session.ts";
import type { GuildMusicSession, SessionSnapshot } from "../guild-music-session.ts";
import { executeClear } from "./clear.ts";

describe("executeClear", () => {
  afterEach(() => {
    mock.restore();
  });

  test("replies empty when the session is missing or upcoming is empty", async () => {
    const drop = spyOn(guildMusicSession, "dropSession").mockImplementation(
      (_guildId: string): void => {},
    );
    const missingCtx = createContext();
    await executeClear(missingCtx, undefined);
    expect(missingCtx.replies).toEqual(["The queue is empty."]);

    const session = new FakeSession();
    const emptyCtx = createContext();
    await executeClear(emptyCtx, session.asGuildSession());
    expect(emptyCtx.replies).toEqual(["The queue is empty."]);
    expect(session.clearCallCount).toBe(0);
    expect(drop).not.toHaveBeenCalled();
  });

  test("replies Cleared n tracks and does not drop while current", async () => {
    const drop = spyOn(guildMusicSession, "dropSession").mockImplementation(
      (_guildId: string): void => {},
    );
    const session = new FakeSession();
    session.currentTrack = sampleTrack("Now", 213);
    session.upcoming = [sampleTrack("A", 10), sampleTrack("B", 20)];
    const ctx = createContext();

    await executeClear(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Cleared 2 tracks."]);
    expect(session.clearCallCount).toBe(1);
    expect(session.upcoming).toEqual([]);
    expect(session.currentTrack?.title).toBe("Now");
    expect(drop).not.toHaveBeenCalled();
  });

  test("calls dropSession after clearing leftover with no current", async () => {
    const drop = spyOn(guildMusicSession, "dropSession").mockImplementation(
      (_guildId: string): void => {},
    );
    const session = new FakeSession();
    session.upcoming = [sampleTrack("Left", 10)];
    const ctx = createContext();

    await executeClear(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Cleared 1 tracks."]);
    expect(session.clearCallCount).toBe(1);
    expect(drop).toHaveBeenCalledTimes(1);
    expect(drop).toHaveBeenCalledWith("guild-1");
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
  upcoming: Track[] = [];
  clearCallCount = 0;

  snapshot(): SessionSnapshot {
    return { current: this.currentTrack, upcoming: this.upcoming };
  }

  clearUpcoming(): number {
    this.clearCallCount += 1;
    const size: number = this.upcoming.length;
    this.upcoming = [];
    return size;
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
