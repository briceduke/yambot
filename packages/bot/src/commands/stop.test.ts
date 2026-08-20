import { describe, expect, test } from "bun:test";
import type { Track, TrackAudio } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import {
  createSession,
  getSession,
  type EnginePort,
  type VoicePort,
} from "../guild-music-session.ts";
import { executeStop } from "./stop.ts";

describe("executeStop", () => {
  test("replies nothing playing when session is missing", async () => {
    const ctx = createContext("guild-stop-missing");

    await executeStop(ctx, undefined);

    expect(ctx.replies).toEqual(["Nothing is playing."]);
  });

  test("replies nothing playing and leaves leftover upcoming unchanged", async () => {
    const leftover = sampleTrack("queued", 61);
    const session = createSession({
      guildId: "guild-stop-leftover",
      engine: createEngine(),
      voice: new FakeVoice(),
    });
    session.enqueue(leftover);
    const ctx = createContext("guild-stop-leftover");

    await executeStop(ctx, session);

    expect(ctx.replies).toEqual(["Nothing is playing."]);
    expect(session.snapshot().upcoming).toEqual([leftover]);
    expect(getSession("guild-stop-leftover")).toBe(session);
  });

  test("replies Stopped and drops now when a track is current", async () => {
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-stop-current",
      engine: createEngine(),
      voice,
    });
    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("now", 213));
    session.enqueue(sampleTrack("next", 61));
    const ctx = createContext("guild-stop-current");

    await executeStop(ctx, session);

    expect(ctx.replies).toEqual(["Stopped."]);
    expect(getSession("guild-stop-current")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
  });

  test("replies Stopped and drops now during idle wait", async () => {
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-stop-idle",
      engine: createEngine(),
      voice,
    });
    await session.joinInvoker("channel-a");
    const ctx = createContext("guild-stop-idle");

    await executeStop(ctx, session);

    expect(ctx.replies).toEqual(["Stopped."]);
    expect(getSession("guild-stop-idle")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
  });
});

class FakeContext implements CommandContext {
  readonly guildId: string;
  readonly channelId = "text-1";
  readonly invokerVoiceChannelId: string | null = null;
  readonly args = "";
  readonly replies: string[] = [];

  constructor(guildId: string) {
    this.guildId = guildId;
  }

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }
}

class FakeVoice implements VoicePort {
  destroyed = false;
  #channelId: string | null = null;

  async join(channelId: string): Promise<void> {
    this.#channelId = channelId;
  }

  getChannelId(): string | null {
    return this.#channelId;
  }

  getChannelName(): string {
    return "music";
  }

  async play(_audio: TrackAudio): Promise<void> {}

  stop(): void {}

  pause(): boolean {
    return false;
  }

  unpause(): boolean {
    return false;
  }

  isPaused(): boolean {
    return false;
  }

  playbackDurationMs(): number {
    return 0;
  }

  destroy(): void {
    this.#channelId = null;
    this.destroyed = true;
  }

  onIdle(_handler: () => void): void {}

  onDisconnected(_handler: () => void): void {}
}

function createContext(guildId: string): FakeContext {
  return new FakeContext(guildId);
}

function createEngine(): EnginePort {
  return {
    async resolveTrack(): Promise<Track> {
      throw new Error("resolveTrack is not used by stop tests");
    },
    async openTrackAudio(): Promise<TrackAudio> {
      return {
        stream: new ReadableStream({
          start(controller: ReadableStreamDefaultController<Uint8Array>) {
            controller.close();
          },
        }),
        format: "webm/opus",
      };
    },
  };
}

function sampleTrack(title: string, durationSeconds: number): Track {
  return {
    title,
    uri: `https://www.youtube.com/watch?v=${title}`,
    durationSeconds,
  };
}
