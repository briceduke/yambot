import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  NoSubscriberBehavior,
  type AudioPlayer,
} from "@discordjs/voice";
import {
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";
import {
  errorMessage,
  sleepAsync,
  summarizeSamples,
  timeManyAsync,
  type SampleSummary,
} from "@yambot/audio-engine/bench";
import { createReadStream } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";

import type { CommandContext } from "../command-context.ts";
import { executePlay } from "../commands/play.ts";
import { streamTypeFor } from "../discord-voice.ts";
import {
  createSession,
  dropSession,
  type EnginePort,
} from "../guild-music-session.ts";
import {
  removeSineFixture,
  WEBM_OPUS_ARGS,
  writeSineFixture,
} from "./sine-file.ts";
import { StubVoicePort } from "./stub-voice.ts";

const JOIN_DELAY_MS = 40;
const RESOLVE_DELAY_MS = 40;
const OPEN_DELAY_MS = 50;
const DEFAULT_N = 10;
const WEBM_SECONDS = 2;

export interface BotBenchReport {
  readonly mode: "offline";
  readonly n: number;
  readonly ttfa_ms: SampleSummary;
  readonly skip_ms: SampleSummary;
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
  const decode: DecodeMeasure = await measureDecodeAsync();
  if (decode.note !== undefined) {
    notes.push(decode.note);
  }
  return {
    mode: "offline",
    n,
    ttfa_ms: ttfa,
    skip_ms: skip,
    cpu_pct: decode.cpuPct,
    event_loop_lag_ms: decode.lag,
    notes,
  };
}

async function runTtfaOnceAsync(): Promise<void> {
  const guildId: string = uniqueGuildId("ttfa");
  const session = createSession({
    guildId,
    engine: new DelayedEngine(RESOLVE_DELAY_MS, OPEN_DELAY_MS),
    voice: new StubVoicePort(JOIN_DELAY_MS),
  });
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
  const session = createSession({
    guildId,
    engine: new DelayedEngine(0, OPEN_DELAY_MS),
    voice: new StubVoicePort(),
  });
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

interface DecodeMeasure {
  readonly cpuPct: number | null;
  readonly lag: { readonly mean: number; readonly max: number } | null;
  readonly note?: string;
}

async function measureDecodeAsync(): Promise<DecodeMeasure> {
  const fixture = writeSineFixture({
    fileName: "sine.webm",
    durationSeconds: WEBM_SECONDS,
    extraArgs: WEBM_OPUS_ARGS,
  });
  if (fixture === null) {
    return {
      cpuPct: null,
      lag: null,
      note: "cpu_pct skipped: ffmpeg could not write a webm/opus fixture.",
    };
  }
  const histogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  const cpuStart = process.cpuUsage();
  const wallStart: number = performance.now();
  try {
    await playWebmUntilIdleAsync(fixture.path);
  } catch (error) {
    return {
      cpuPct: null,
      lag: null,
      note: `cpu_pct skipped: ${errorMessage(error)}`,
    };
  } finally {
    histogram.disable();
    removeSineFixture(fixture);
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
