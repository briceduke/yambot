import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  NoSubscriberBehavior,
  type AudioPlayer,
} from "@discordjs/voice";
import {
  TrackQueue,
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";
import { spawnSync } from "node:child_process";
import { createReadStream, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";

import type { CommandContext } from "../command-context.ts";
import { executePlay } from "../commands/play.ts";
import { streamTypeFor } from "../discord-voice.ts";
import {
  createSession,
  dropSession,
  type EnginePort,
  type VoicePort,
} from "../guild-music-session.ts";
import {
  sleepAsync,
  summarizeSamples,
  timeManyAsync,
  type SampleSummary,
} from "./stats.ts";

const JOIN_DELAY_MS = 40;
const RESOLVE_DELAY_MS = 40;
const OPEN_DELAY_MS = 50;
const DEFAULT_N = 10;
const PLAYLIST_SIZE = 1000;
const WEBM_SECONDS = 2;

export interface BotBenchReport {
  readonly mode: "offline";
  readonly n: number;
  readonly ttfa_ms: SampleSummary;
  readonly skip_ms: SampleSummary;
  readonly playlist_enqueue_ms: SampleSummary;
  readonly cpu_pct: number | null;
  readonly event_loop_lag_ms: {
    readonly mean: number;
    readonly max: number;
  } | null;
  readonly notes: readonly string[];
}

/**
 * Runs the offline bot/session bench. No Java. No live Discord.
 * @param n - Repeats per timed metric (default 10).
 * @returns Machine-readable report.
 */
export async function runBotBench(
  n: number = DEFAULT_N,
): Promise<BotBenchReport> {
  const notes: string[] = [
    "ttfa_ms is play request to currentTrack set (join, resolve, open, play). Voice is mocked.",
    "Live Discord AudioPlayer Playing and audible audio are human-smoke only.",
    `Injected delays: join ${JOIN_DELAY_MS}ms, resolve ${RESOLVE_DELAY_MS}ms, open ${OPEN_DELAY_MS}ms.`,
    "skip_ms waits for prefetch of the next track, then times skipCurrent to next current.",
  ];
  const ttfa: SampleSummary = await timeManyAsync(n, async () => {
    await runTtfaOnceAsync();
  });
  const skip: SampleSummary = await timeSkipAsync(n);
  const playlistEnqueue: SampleSummary = await timeManyAsync(n, async () => {
    enqueuePlaylist(PLAYLIST_SIZE);
  });
  const decode: DecodeMeasure = await measureDecodeAsync();
  if (decode.note !== undefined) {
    notes.push(decode.note);
  }
  return {
    mode: "offline",
    n,
    ttfa_ms: ttfa,
    skip_ms: skip,
    playlist_enqueue_ms: playlistEnqueue,
    cpu_pct: decode.cpuPct,
    event_loop_lag_ms: decode.lag,
    notes,
  };
}

async function runTtfaOnceAsync(): Promise<void> {
  const guildId: string = uniqueGuildId("ttfa");
  const voice = new DelayedVoice(JOIN_DELAY_MS);
  const engine = new DelayedEngine(RESOLVE_DELAY_MS, OPEN_DELAY_MS);
  const session = createSession({ guildId, engine, voice });
  const ctx = new BenchContext("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  try {
    await executePlay(ctx, session);
    if (session.currentTrack === null) {
      throw new Error(`ttfa play failed: ${ctx.replies.join(" | ")}`);
    }
  } finally {
    dropSession(guildId);
  }
}

async function timeSkipAsync(n: number): Promise<SampleSummary> {
  const samples: number[] = [];
  for (let index = 0; index < n; index += 1) {
    samples.push(await measureSkipOnceAsync());
  }
  return summarizeSamples(samples);
}

async function measureSkipOnceAsync(): Promise<number> {
  const guildId: string = uniqueGuildId("skip");
  const voice = new DelayedVoice(0);
  const engine = new DelayedEngine(0, OPEN_DELAY_MS);
  const session = createSession({ guildId, engine, voice });
  try {
    await session.joinInvoker("channel-a");
    await session.playNow(sampleTrack("one"));
    session.enqueue(sampleTrack("two"));
    await sleepAsync(OPEN_DELAY_MS + 10);
    const startedAt: number = performance.now();
    session.skipCurrent();
    await waitUntilAsync(() => session.currentTrack?.title === "two");
    return performance.now() - startedAt;
  } finally {
    dropSession(guildId);
  }
}

async function waitUntilAsync(isReady: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (isReady()) {
      return;
    }
    await sleepAsync(1);
  }
  throw new Error("Timed out waiting for session state.");
}

function enqueuePlaylist(count: number): void {
  const queue = new TrackQueue();
  for (let index = 0; index < count; index += 1) {
    queue.enqueue(sampleTrack(`t${index}`));
  }
  if (queue.size !== count) {
    throw new Error("playlist enqueue lost tracks");
  }
}

interface DecodeMeasure {
  readonly cpuPct: number | null;
  readonly lag: { readonly mean: number; readonly max: number } | null;
  readonly note?: string;
}

async function measureDecodeAsync(): Promise<DecodeMeasure> {
  const webmPath: string | null = writeWebmFixture();
  if (webmPath === null) {
    return {
      cpuPct: null,
      lag: null,
      note: "cpu_pct skipped: ffmpeg could not write a webm/opus fixture.",
    };
  }
  const dir: string = join(webmPath, "..");
  const histogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  const cpuStart = process.cpuUsage();
  const wallStart: number = performance.now();
  try {
    await playWebmUntilIdleAsync(webmPath);
  } catch (error) {
    return {
      cpuPct: null,
      lag: null,
      note: `cpu_pct skipped: ${errorMessage(error)}`,
    };
  } finally {
    histogram.disable();
    rmSync(dir, { recursive: true, force: true });
  }
  const wallMs: number = performance.now() - wallStart;
  const cpu = process.cpuUsage(cpuStart);
  const cpuMs: number = (cpu.user + cpu.system) / 1000;
  const cpuPct: number =
    wallMs <= 0 ? 0 : Math.round((cpuMs / wallMs) * 10000) / 100;
  return {
    cpuPct,
    lag: {
      mean: roundLagMs(histogram.mean),
      max: roundLagMs(histogram.max),
    },
  };
}

async function playWebmUntilIdleAsync(webmPath: string): Promise<void> {
  const player: AudioPlayer = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  const resource = createAudioResource(createReadStream(webmPath), {
    inputType: streamTypeFor("webm/opus"),
    inlineVolume: false,
  });
  player.play(resource);
  await entersState(player, AudioPlayerStatus.Playing, 5_000);
  await entersState(player, AudioPlayerStatus.Idle, 15_000);
  player.stop();
}

function writeWebmFixture(): string | null {
  const dir: string = mkdtempSync(join(tmpdir(), "yambot-bench-"));
  const outPath: string = join(dir, "sine.webm");
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=440:duration=${WEBM_SECONDS}`,
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      "-f",
      "webm",
      outPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    return null;
  }
  return outPath;
}

function roundLagMs(nanoseconds: number): number {
  return Math.round((nanoseconds / 1e6) * 1000) / 1000;
}

class DelayedEngine implements EnginePort {
  readonly #resolveDelayMs: number;
  readonly #openDelayMs: number;

  constructor(resolveDelayMs: number, openDelayMs: number) {
    this.#resolveDelayMs = resolveDelayMs;
    this.#openDelayMs = openDelayMs;
  }

  async resolveTrack(): Promise<ResolveResult> {
    await sleepAsync(this.#resolveDelayMs);
    return {
      tracks: [sampleTrack("one")],
      playlistTitle: null,
      truncated: false,
    };
  }

  async openTrackAudio(): Promise<TrackAudio> {
    await sleepAsync(this.#openDelayMs);
    return { stream: immediateStream(), format: "webm/opus" };
  }
}

class DelayedVoice implements VoicePort {
  readonly #joinDelayMs: number;
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;

  constructor(joinDelayMs: number) {
    this.#joinDelayMs = joinDelayMs;
  }

  async join(channelId: string): Promise<void> {
    await sleepAsync(this.#joinDelayMs);
    this.#channelId = channelId;
  }

  getChannelId(): string | null {
    return this.#channelId;
  }

  getChannelName(): string {
    return "music";
  }

  async play(_audio: TrackAudio): Promise<void> {
    return;
  }

  stop(): void {
    this.#idleHandler?.();
  }

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
  }

  onIdle(handler: () => void): void {
    this.#idleHandler = handler;
  }

  onDisconnected(_handler: () => void): void {
    return;
  }
}

class BenchContext implements CommandContext {
  readonly guildId = "bench-guild";
  readonly channelId = "text-1";
  readonly invokerVoiceChannelId: string | null = "voice-1";
  readonly args: string;
  readonly replies: string[] = [];

  constructor(args: string) {
    this.args = args;
  }

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }
}

function sampleTrack(title: string): Track {
  return {
    title,
    uri: `https://www.youtube.com/watch?v=${title.padEnd(11, "x").slice(0, 11)}`,
    durationSeconds: 213,
  };
}

function immediateStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      controller.close();
    },
  });
}

function uniqueGuildId(label: string): string {
  return `${label}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
