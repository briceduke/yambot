import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession, SessionSnapshot } from "../guild-music-session.ts";
import { executeRemove } from "./remove.ts";

describe("executeRemove", () => {
  test("replies Removed and removes at the 0-based index", async () => {
    const session = new FakeSession();
    session.upcoming = [
      sampleTrack("First", 100),
      sampleTrack("Second", 200),
    ];
    const ctx = createContext("2");

    await executeRemove(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Removed: Second"]);
    expect(session.removedIndexes).toEqual([1]);
    expect(session.upcoming.map((track) => track.title)).toEqual(["First"]);
  });

  test("replies no track and does not mutate for 0 and 99", async () => {
    const session = new FakeSession();
    session.upcoming = [sampleTrack("Only", 100)];
    const zeroCtx = createContext("0");
    await executeRemove(zeroCtx, session.asGuildSession());
    expect(zeroCtx.replies).toEqual(["No track at position 0."]);

    const largeCtx = createContext("99");
    await executeRemove(largeCtx, session.asGuildSession());
    expect(largeCtx.replies).toEqual(["No track at position 99."]);

    expect(session.removedIndexes).toEqual([]);
    expect(session.upcoming.map((track) => track.title)).toEqual(["Only"]);
  });

  test("replies usage and does not mutate for empty args and abc", async () => {
    const session = new FakeSession();
    session.upcoming = [sampleTrack("Only", 100)];
    const emptyCtx = createContext("");
    await executeRemove(emptyCtx, session.asGuildSession());
    expect(emptyCtx.replies).toEqual(["Usage: /remove <position>"]);

    const abcCtx = createContext("abc");
    await executeRemove(abcCtx, session.asGuildSession());
    expect(abcCtx.replies).toEqual(["Usage: /remove <position>"]);

    expect(session.removedIndexes).toEqual([]);
    expect(session.upcoming.map((track) => track.title)).toEqual(["Only"]);
  });

  test("replies no track when the session is missing", async () => {
    const ctx = createContext("1");
    await executeRemove(ctx, undefined);
    expect(ctx.replies).toEqual(["No track at position 1."]);
  });
});

class FakeContext implements CommandContext {
  readonly guildId = "guild-1";
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

class FakeSession {
  currentTrack: Track | null = null;
  upcoming: Track[] = [];
  readonly removedIndexes: number[] = [];

  snapshot(): SessionSnapshot {
    return { current: this.currentTrack, upcoming: this.upcoming };
  }

  removeUpcomingAt(index: number): Track | null {
    this.removedIndexes.push(index);
    if (index < 0 || index >= this.upcoming.length) {
      return null;
    }
    const removed: Track | undefined = this.upcoming.splice(index, 1)[0];
    return removed ?? null;
  }

  asGuildSession(): GuildMusicSession {
    return this as unknown as GuildMusicSession;
  }
}

function createContext(args: string): FakeContext {
  return new FakeContext(args);
}

function sampleTrack(title: string, durationSeconds: number): Track {
  return {
    title,
    uri: `https://www.youtube.com/watch?v=${title}`,
    durationSeconds,
  };
}
