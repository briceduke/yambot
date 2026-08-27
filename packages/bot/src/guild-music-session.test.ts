import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  TrackResolveError,
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";

import {
  createSession,
  dropSession,
  getSession,
  IDLE_LEAVE_AFTER_MS,
  type EnginePort,
  type LeavePolicy,
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

  test("pause does not advance the queue", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const announces: string[] = [];
    const session = createSession({
      guildId: "guild-pause",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    session.bindAnnounce(async (text) => {
      announces.push(text);
    });
    const first = sampleTrack("one");
    const second = sampleTrack("two");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.enqueue(second);
    expect(session.pause()).toBe(true);

    expect(session.currentTrack).toBe(first);
    expect(session.isPaused()).toBe(true);
    expect(session.snapshot().upcoming).toEqual([second]);
    expect(session.isOccupiedInOtherChannel("channel-b")).toBe(true);
    expect(announces).toEqual([]);
    expect(getSession("guild-pause")).toBe(session);
    expect(clock.isScheduled).toBe(false);
  });

  test("skip while paused starts the next track playing", async () => {
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-skip-paused",
      engine: createEngine(),
      voice,
    });
    const first = sampleTrack("one");
    const second = sampleTrack("two", 61);

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.enqueue(second);
    session.pause();
    session.skipCurrent();

    await waitUntilAsync(() => session.currentTrack === second);
    expect(session.isPaused()).toBe(false);
    expect(session.snapshot().upcoming).toEqual([]);
  });

  test("last-track skip schedules idle leave then fire drops the session", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const announces: string[] = [];
    const session = createSession({
      guildId: "guild-last-skip",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    session.bindAnnounce(async (text) => {
      announces.push(text);
    });
    const first = sampleTrack("one");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.skipCurrent();

    expect(getSession("guild-last-skip")).toBe(session);
    expect(session.currentTrack).toBeNull();
    expect(session.hasVoiceConnection()).toBe(true);
    expect(clock.scheduledDelayMs).toBe(IDLE_LEAVE_AFTER_MS);
    expect(announces).toEqual([]);

    clock.fire();
    expect(getSession("guild-last-skip")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
  });

  test("natural idle schedules idle leave then fire drops the session", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const announces: string[] = [];
    const session = createSession({
      guildId: "guild-natural-idle",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    session.bindAnnounce(async (text) => {
      announces.push(text);
    });

    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    voice.emitIdle();

    expect(getSession("guild-natural-idle")).toBe(session);
    expect(session.currentTrack).toBeNull();
    expect(clock.scheduledDelayMs).toBe(IDLE_LEAVE_AFTER_MS);
    expect(announces).toEqual([]);

    clock.fire();
    expect(getSession("guild-natural-idle")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
  });

  test("last dead-open schedules idle leave then fire drops the session", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const announces: string[] = [];
    const session = createSession({
      guildId: "guild-last-dead",
      engine: createEngine({ failTitles: new Set(["dead"]) }),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    session.bindAnnounce(async (text) => {
      announces.push(text);
    });
    const first = sampleTrack("one");
    const dead = sampleTrack("dead");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.enqueue(dead);
    voice.emitIdle();

    await waitUntilAsync(() => clock.isScheduled);
    expect(getSession("guild-last-dead")).toBe(session);
    expect(session.currentTrack).toBeNull();
    expect(clock.scheduledDelayMs).toBe(IDLE_LEAVE_AFTER_MS);
    expect(announces).toEqual(["Skipping dead: couldn't play it"]);

    clock.fire();
    expect(getSession("guild-last-dead")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
  });

  test("playNow after idle-leave schedule cancels so fire is a no-op", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-cancel-idle",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    const later = sampleTrack("later");

    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    voice.emitIdle();
    expect(clock.isScheduled).toBe(true);

    await session.playNow(later);
    expect(clock.isScheduled).toBe(false);
    expect(session.currentTrack).toBe(later);

    clock.fire();
    expect(getSession("guild-cancel-idle")).toBe(session);
    expect(session.currentTrack).toBe(later);
    expect(voice.destroyed).toBe(false);
  });

  test("dropSession while a track is current leaves now", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-drop-now",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    dropSession("guild-drop-now");

    expect(getSession("guild-drop-now")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
    expect(clock.isScheduled).toBe(false);
    dropSession("guild-drop-now");
  });

  test("clearUpcoming and pause while current do not drop the session", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-clear-pause-stay",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    const first = sampleTrack("one");
    const queued = sampleTrack("two");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.enqueue(queued);
    expect(session.clearUpcoming()).toBe(1);
    expect(getSession("guild-clear-pause-stay")).toBe(session);
    expect(session.currentTrack).toBe(first);
    expect(clock.isScheduled).toBe(false);

    session.pause();
    expect(getSession("guild-clear-pause-stay")).toBe(session);
    expect(session.currentTrack).toBe(first);
    expect(session.isPaused()).toBe(true);
    expect(clock.isScheduled).toBe(false);
  });

  test("voice drop while paused drops current, keeps upcoming, does not schedule idle leave", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-drop-paused",
      engine: createEngine(),
      voice,
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });
    const first = sampleTrack("one");
    const queued = sampleTrack("two");

    await session.joinInvoker("channel-a");
    await session.playNow(first);
    session.enqueue(queued);
    session.pause();
    voice.emitDisconnected();

    expect(getSession("guild-drop-paused")).toBe(session);
    expect(session.snapshot()).toEqual({
      current: null,
      upcoming: [queued],
    });
    expect(clock.isScheduled).toBe(false);
    expect(session.hasVoiceConnection()).toBe(false);
    expect(voice.destroyed).toBe(false);
  });

  test("stayInChannel skips idle leave after the last track", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-stay-in-channel",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ stayInChannel: true }),
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    session.skipCurrent();

    expect(getSession("guild-stay-in-channel")).toBe(session);
    expect(session.currentTrack).toBeNull();
    expect(session.hasVoiceConnection()).toBe(true);
    expect(clock.isScheduled).toBe(false);

    clock.fire();
    expect(getSession("guild-stay-in-channel")).toBe(session);
    expect(voice.destroyed).toBe(false);
  });

  test("custom idleLeaveMs is the delay that fires idle leave", async () => {
    const clock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const customIdleMs: number = 45_000;
    const session = createSession({
      guildId: "guild-custom-idle",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ idleLeaveMs: customIdleMs }),
      scheduleIdleLeave: (callback, delayMs) =>
        clock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    session.skipCurrent();

    expect(clock.scheduledDelayMs).toBe(customIdleMs);
    expect(clock.scheduledDelayMs).not.toBe(IDLE_LEAVE_AFTER_MS);

    clock.fire();
    expect(getSession("guild-custom-idle")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
  });

  test("aloneTimeUntilStopMs 0 never arms the alone timer", async () => {
    const idleClock = new FakeIdleLeaveClock();
    const aloneClock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-alone-off",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ aloneTimeUntilStopMs: 0 }),
      scheduleIdleLeave: (callback, delayMs) =>
        idleClock.schedule(callback, delayMs),
      scheduleAloneLeave: (callback, delayMs) =>
        aloneClock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    session.noteHumanListenerCount(0);

    expect(aloneClock.isScheduled).toBe(false);
    expect(getSession("guild-alone-off")).toBe(session);

    aloneClock.fire();
    expect(getSession("guild-alone-off")).toBe(session);
    expect(voice.destroyed).toBe(false);
  });

  test("alone timer arms on count 0 and fire drops with no extra message", async () => {
    const idleClock = new FakeIdleLeaveClock();
    const aloneClock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const announces: string[] = [];
    const aloneMs: number = 15_000;
    const session = createSession({
      guildId: "guild-alone-arm",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ aloneTimeUntilStopMs: aloneMs }),
      scheduleIdleLeave: (callback, delayMs) =>
        idleClock.schedule(callback, delayMs),
      scheduleAloneLeave: (callback, delayMs) =>
        aloneClock.schedule(callback, delayMs),
    });
    session.bindAnnounce(async (text) => {
      announces.push(text);
    });

    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    session.noteHumanListenerCount(0);

    expect(getSession("guild-alone-arm")).toBe(session);
    expect(aloneClock.isScheduled).toBe(true);
    expect(aloneClock.scheduledDelayMs).toBe(aloneMs);
    expect(idleClock.isScheduled).toBe(false);

    aloneClock.fire();
    expect(getSession("guild-alone-arm")).toBeUndefined();
    expect(voice.destroyed).toBe(true);
    expect(announces).toEqual([]);
  });

  test("alone timer cancel on count greater than 0 so fire is a no-op", async () => {
    const aloneClock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-alone-cancel-humans",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ aloneTimeUntilStopMs: 15_000 }),
      scheduleAloneLeave: (callback, delayMs) =>
        aloneClock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    session.noteHumanListenerCount(0);
    expect(aloneClock.isScheduled).toBe(true);

    session.noteHumanListenerCount(1);
    expect(aloneClock.isScheduled).toBe(false);

    aloneClock.fire();
    expect(getSession("guild-alone-cancel-humans")).toBe(session);
    expect(voice.destroyed).toBe(false);
  });

  test("leaveNow cancels the alone timer so fire is a no-op", async () => {
    const aloneClock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-leave-cancels-alone",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ aloneTimeUntilStopMs: 15_000 }),
      scheduleAloneLeave: (callback, delayMs) =>
        aloneClock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    session.noteHumanListenerCount(0);
    expect(aloneClock.isScheduled).toBe(true);

    session.leaveNow();
    expect(getSession("guild-leave-cancels-alone")).toBeUndefined();
    expect(aloneClock.isScheduled).toBe(false);
    expect(voice.destroyed).toBe(true);

    aloneClock.fire();
    expect(voice.destroyed).toBe(true);
  });

  test("voice drop cancels the alone timer so fire is a no-op", async () => {
    const aloneClock = new FakeIdleLeaveClock();
    const voice = new FakeVoice();
    const session = createSession({
      guildId: "guild-voice-drop-cancels-alone",
      engine: createEngine(),
      voice,
      leavePolicy: createLeavePolicy({ aloneTimeUntilStopMs: 15_000 }),
      scheduleAloneLeave: (callback, delayMs) =>
        aloneClock.schedule(callback, delayMs),
    });

    await session.joinInvoker("channel-a");
    session.noteHumanListenerCount(0);
    expect(aloneClock.isScheduled).toBe(true);

    voice.emitDisconnected();
    expect(getSession("guild-voice-drop-cancels-alone")).toBe(session);
    expect(aloneClock.isScheduled).toBe(false);

    aloneClock.fire();
    expect(getSession("guild-voice-drop-cancels-alone")).toBe(session);
    expect(voice.destroyed).toBe(false);
  });
});

class FakeVoice implements VoicePort {
  readonly played: TrackAudio[] = [];
  destroyed = false;
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;
  #disconnectedHandler: (() => void) | undefined;
  #isPlaying = false;
  #paused = false;
  #playbackDurationMs = 0;

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
    this.#isPlaying = true;
    this.#paused = false;
  }

  stop(): void {
    this.#isPlaying = false;
    this.#paused = false;
    this.#idleHandler?.();
  }

  pause(): boolean {
    if (!this.#isPlaying || this.#paused) {
      return false;
    }
    this.#paused = true;
    return true;
  }

  unpause(): boolean {
    if (!this.#isPlaying || !this.#paused) {
      return false;
    }
    this.#paused = false;
    return true;
  }

  isPaused(): boolean {
    return this.#paused;
  }

  playbackDurationMs(): number {
    return this.#playbackDurationMs;
  }

  destroy(): void {
    this.#channelId = null;
    this.destroyed = true;
  }

  onIdle(handler: () => void): void {
    this.#idleHandler = handler;
  }

  onDisconnected(handler: () => void): void {
    this.#disconnectedHandler = handler;
  }

  emitIdle(): void {
    this.#isPlaying = false;
    this.#paused = false;
    this.#idleHandler?.();
  }

  emitDisconnected(): void {
    this.#channelId = null;
    this.#disconnectedHandler?.();
  }
}

class FakeIdleLeaveClock {
  #callback: (() => void) | undefined;
  #delayMs: number | null = null;

  get scheduledDelayMs(): number | null {
    return this.#delayMs;
  }

  get isScheduled(): boolean {
    return this.#callback !== undefined;
  }

  schedule(callback: () => void, delayMs: number): () => void {
    this.#callback = callback;
    this.#delayMs = delayMs;
    return (): void => {
      this.#callback = undefined;
      this.#delayMs = null;
    };
  }

  fire(): void {
    const pending: (() => void) | undefined = this.#callback;
    this.#callback = undefined;
    this.#delayMs = null;
    pending?.();
  }
}

function createEngine(
  options: {
    readonly failTitles?: ReadonlySet<string>;
    readonly stream?: ReadableStream<Uint8Array>;
  } = {},
): EnginePort {
  const failTitles: ReadonlySet<string> = options.failTitles ?? new Set();
  const stream: ReadableStream<Uint8Array> = options.stream ?? emptyStream();
  return {
    async resolveTrack(): Promise<ResolveResult> {
      throw new Error("resolveTrack is not used in session tests");
    },
    async openTrackAudio(input: {
      readonly track: Track;
    }): Promise<TrackAudio> {
      if (failTitles.has(input.track.title)) {
        throw new TrackResolveError("couldn't play it");
      }
      return { stream, format: "webm/opus" };
    },
  };
}

function createLeavePolicy(overrides: {
  readonly idleLeaveMs?: number;
  readonly stayInChannel?: boolean;
  readonly aloneTimeUntilStopMs?: number;
}): LeavePolicy {
  return {
    idleLeaveMs: overrides.idleLeaveMs ?? IDLE_LEAVE_AFTER_MS,
    stayInChannel: overrides.stayInChannel ?? false,
    aloneTimeUntilStopMs: overrides.aloneTimeUntilStopMs ?? 0,
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
