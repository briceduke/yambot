import { describe, expect, test } from "bun:test";
import type { Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type {
  GuildMusicSession,
  SessionSnapshot,
} from "../guild-music-session.ts";
import { executeQueue } from "./queue.ts";

describe("executeQueue", () => {
  test("replies empty when nothing is playing and the queue is empty", async () => {
    const missingCtx = createContext();
    await executeQueue(missingCtx, undefined);
    expect(missingCtx.replies).toEqual([
      "Nothing is playing and the queue is empty.",
    ]);

    const session = new FakeSession({ current: null, upcoming: [] });
    const idleCtx = createContext();
    await executeQueue(idleCtx, session.asGuildSession());
    expect(idleCtx.replies).toEqual([
      "Nothing is playing and the queue is empty.",
    ]);
  });

  test("replies leftover listing with no Now line when idle with upcoming", async () => {
    const session = new FakeSession({
      current: null,
      upcoming: [sampleTrack("Leftover", 61), sampleTrack("Later", 120)],
    });
    const ctx = createContext();

    await executeQueue(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Nothing is playing.\n1. Leftover (1:01)\n2. Later (2:00)",
    ]);
    expect(ctx.replies[0]).not.toContain("Now:");
  });

  test("replies Now plus one numbered upcoming track", async () => {
    const session = new FakeSession({
      current: sampleTrack("Current", 213),
      upcoming: [sampleTrack("Next", 61)],
    });
    const ctx = createContext();

    await executeQueue(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Now: Current (3:33)\n1. Next (1:01)"]);
  });

  test("shows 10 upcoming lines plus and 1 more when 11 are queued", async () => {
    const upcoming: Track[] = Array.from({ length: 11 }, (_, index) =>
      sampleTrack(`Song ${index + 1}`, 60),
    );
    const session = new FakeSession({
      current: sampleTrack("Current", 213),
      upcoming,
    });
    const ctx = createContext();

    await executeQueue(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      [
        "Now: Current (3:33)",
        "1. Song 1 (1:00)",
        "2. Song 2 (1:00)",
        "3. Song 3 (1:00)",
        "4. Song 4 (1:00)",
        "5. Song 5 (1:00)",
        "6. Song 6 (1:00)",
        "7. Song 7 (1:00)",
        "8. Song 8 (1:00)",
        "9. Song 9 (1:00)",
        "10. Song 10 (1:00)",
        "…and 1 more.",
      ].join("\n"),
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
  readonly #snapshot: SessionSnapshot;

  constructor(snapshot: SessionSnapshot) {
    this.#snapshot = snapshot;
  }

  snapshot(): SessionSnapshot {
    return this.#snapshot;
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
