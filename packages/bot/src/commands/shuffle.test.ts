import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession, SessionSnapshot } from "../guild-music-session.ts";
import { executeShuffle } from "./shuffle.ts";

describe("executeShuffle", () => {
  test("replies empty when the session is missing or upcoming is empty", async () => {
    const missingCtx = createContext();
    await executeShuffle(missingCtx, undefined);
    expect(missingCtx.replies).toEqual(["The queue is empty."]);

    const session = new FakeSession();
    const emptyCtx = createContext();
    await executeShuffle(emptyCtx, session.asGuildSession());
    expect(emptyCtx.replies).toEqual(["The queue is empty."]);
    expect(session.shuffleCallCount).toBe(0);
  });

  test("replies Shuffled n tracks including size 1", async () => {
    const one = new FakeSession();
    one.upcoming = [sampleTrack("Only", 100)];
    const oneCtx = createContext();
    await executeShuffle(oneCtx, one.asGuildSession());
    expect(oneCtx.replies).toEqual(["Shuffled 1 tracks."]);
    expect(one.shuffleCallCount).toBe(1);

    const many = new FakeSession();
    many.upcoming = [
      sampleTrack("A", 10),
      sampleTrack("B", 20),
      sampleTrack("C", 30),
    ];
    const manyCtx = createContext();
    await executeShuffle(manyCtx, many.asGuildSession());
    expect(manyCtx.replies).toEqual(["Shuffled 3 tracks."]);
    expect(many.shuffleCallCount).toBe(1);
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
  shuffleCallCount = 0;

  snapshot(): SessionSnapshot {
    return { current: this.currentTrack, upcoming: this.upcoming };
  }

  shuffleUpcoming(): void {
    this.shuffleCallCount += 1;
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
