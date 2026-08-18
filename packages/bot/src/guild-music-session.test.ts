import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  TrackResolveError,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";

import {
  createSession,
  getSession,
  type EnginePort,
  type VoicePort,
} from "./guild-music-session.ts";

describe("GuildMusicSession", () => {
  test("queues FIFO after playNow then enqueue", async () => {
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-fifo",
      engine: createEngine(),
      voice,
    });
    const first = sampleTrack("one");
    const second = sampleTrack("two");
    const third = sampleTrack("three");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    expect(session.enqueue(second)).toBe(2);
    expect(session.enqueue(third)).toBe(3);
    expect(session.snapshot()).toEqual({
      current: first,
      upcoming: [second, third],
    });
    expect(getSession("guild-fifo")).toBe(session);
  });

  test("advances on idle and skips a dead track without stalling", async () => {
    const voice = new FakeVoice();
    const announces: string[] = [];
    const session = createSession({
      guildId: "guild-advance",
      engine: createEngine({ failTitles: new Set(["dead"]) }),
      voice,
    });
    session.bindAnnounce(async (text) => {
      announces.push(text);
    });
    const first = sampleTrack("one", 213);
    const dead = sampleTrack("dead", 10);
    const third = sampleTrack("three", 61);

    await session.playNow(first);
    session.enqueue(dead);
    session.enqueue(third);
    voice.emitIdle();

    await waitUntilAsync(() => session.currentTrack === third);
    expect(announces).toEqual([
      "Skipping dead: couldn't play it",
      "Now playing: three (1:01)",
    ]);
    expect(session.snapshot().upcoming).toEqual([]);
  });

  test("voice drop clears current and keeps the queue", async () => {
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-drop",
      engine: createEngine(),
      voice,
    });
    const first = sampleTrack("one");
    const queued = sampleTrack("two");
    const nextPlay = sampleTrack("three");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.enqueue(queued);
    voice.emitDisconnected();

    expect(session.snapshot()).toEqual({
      current: null,
      upcoming: [queued],
    });

    await session.joinInvoker("channel-b");
    await session.playNow(nextPlay);
    expect(session.snapshot()).toEqual({
      current: nextPlay,
      upcoming: [queued],
    });
  });

  test("playNow pipes fixture webm/opus audio to voice.play", async () => {
    const voice = new FakeVoice();
    const stream = readFixtureStream();
    const session = createSession({
      guildId: "guild-pipe",
      engine: createEngine({ stream }),
      voice,
    });
    const track = sampleTrack("piped");

    await session.playNow(track);
    expect(voice.played).toHaveLength(1);
    expect(voice.played[0]?.stream).toBe(stream);
    expect(voice.played[0]?.format).toBe("webm/opus");
  });

  test("first-track open failure throws and does not set current", async () => {
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-open-fail",
      engine: createEngine({ failTitles: new Set(["broken"]) }),
      voice,
    });
    const track = sampleTrack("broken");

    await expect(session.playNow(track)).rejects.toBeInstanceOf(
      TrackResolveError,
    );
    expect(session.snapshot()).toEqual({ current: null, upcoming: [] });
    expect(voice.played).toEqual([]);
  });
});

class FakeVoice implements VoicePort {
  readonly played: TrackAudio[] = [];
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;
  #disconnectedHandler: (() => void) | undefined;

  async join(channelId: string): Promise<void> {
    this.#channelId = channelId;
  }

  getChannelId(): string | null {
    return this.#channelId;
  }

  getChannelName(): string {
    return "music";
  }

  async play(audio: TrackAudio): Promise<void> {
    this.played.push(audio);
  }

  stop(): void {
    this.#idleHandler?.();
  }

  onIdle(handler: () => void): void {
    this.#idleHandler = handler;
  }

  onDisconnected(handler: () => void): void {
    this.#disconnectedHandler = handler;
  }

  emitIdle(): void {
    this.#idleHandler?.();
  }

  emitDisconnected(): void {
    this.#channelId = null;
    this.#disconnectedHandler?.();
  }
}

function createEngine(options: {
  readonly failTitles?: ReadonlySet<string>;
  readonly stream?: ReadableStream<Uint8Array>;
} = {}): EnginePort {
  const failTitles: ReadonlySet<string> = options.failTitles ?? new Set();
  const stream: ReadableStream<Uint8Array> = options.stream ?? emptyStream();
  return {
    async resolveTrack(): Promise<Track> {
      throw new Error("resolveTrack is not used in session tests");
    },
    async openTrackAudio(input: { readonly track: Track }): Promise<TrackAudio> {
      if (failTitles.has(input.track.title)) {
        throw new TrackResolveError("couldn't play it");
      }
      return { stream, format: "webm/opus" };
    },
  };
}

function sampleTrack(title: string, durationSeconds = 213): Track {
  return {
    title,
    uri: `https://www.youtube.com/watch?v=${title}`,
    durationSeconds,
  };
}

function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

function readFixtureStream(): ReadableStream<Uint8Array> {
  const bytes: Uint8Array = new Uint8Array(
    readFileSync(join(import.meta.dirname, "../test/fixtures/webm-opus.bin")),
  );
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function waitUntilAsync(isReady: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (isReady()) {
      return;
    }
    await sleepAsync();
  }
  throw new Error("Timed out waiting for session state.");
}

function sleepAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
