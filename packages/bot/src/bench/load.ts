import {
  openTrackAudio,
  resolveTrack,
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";
import { readFileSync } from "node:fs";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Readable } from "node:stream";

import type { EnginePort, VoicePort } from "../guild-music-session.ts";
import {
  createSession,
  dropSession,
  type GuildMusicSession,
} from "../guild-music-session.ts";
import { HeadlessVoicePort } from "./headless-voice.ts";
import {
  MP3_ARGS,
  OGG_OPUS_ARGS,
  removeSineFixture,
  WEBM_OPUS_ARGS,
  writeSineFixture,
  type SineFixture,
} from "./sine-file.ts";
import {
  sleepAsync,
  summarizeSamples,
  type SampleSummary,
} from "./stats.ts";

const DEFAULT_SESSION_COUNTS: readonly number[] = [1, 10, 50, 100];
const DEFAULT_HOLD_MS = 2_000;
const DEFAULT_QUEUE_DEPTH = 50;
const DEFAULT_SKIP_STORMS = 5;
const PREFETCH_WAIT_MS = 80;
const TTFA_P95_CLIFF_MS = 2_000;
const LAG_CLIFF_MS = 250;
const FAIL_CLIFF_RATE = 0.05;

/** How the load bench plays audio. */
export type LoadMode = "mock" | "webm" | "http";

/** Failures counted in one N point. */
export interface LoadFailures {
  readonly timeouts: number;
  readonly errors: number;
  readonly started: number;
}

/** One N on the scale axis. */
export interface LoadPoint {
  readonly sessions: number;
  readonly ttfa_ms: SampleSummary | null;
  readonly skip_ms: SampleSummary | null;
  readonly queue_skip_storm_ms: SampleSummary | null;
  readonly rss_mb: number;
  readonly heap_mb: number;
  readonly cpu_pct: number | null;
  readonly event_loop_lag_ms: { readonly mean: number; readonly max: number };
  readonly failures: LoadFailures;
  readonly fail_rate: number;
  readonly cliff: string | null;
}

/** Full load report. */
export interface LoadReport {
  readonly command: "bun run bench:load";
  readonly java: false;
  readonly mode: LoadMode;
  readonly holdMs: number;
  readonly queueDepth: number;
  readonly skipStorms: number;
  readonly points: readonly LoadPoint[];
  readonly notes: readonly string[];
}

/** Options for the headless load sweep. */
export interface LoadBenchOptions {
  readonly sessionCounts?: readonly number[];
  readonly mode?: LoadMode;
  readonly holdMs?: number;
  readonly queueDepth?: number;
  readonly skipStorms?: number;
}

/**
 * Runs a concurrent-guild load sweep. Mock mode is CI-safe (no ffmpeg).
 * webm/http modes need ffmpeg and are opt-in via `bun run bench:load`.
 * @param options - Sweep size, play mode, and hold time.
 * @returns Machine-readable scale report.
 */
export async function runLoadBench(
  options: LoadBenchOptions = {},
): Promise<LoadReport> {
  const mode: LoadMode = options.mode ?? "webm";
  const sessionCounts: readonly number[] =
    options.sessionCounts ?? DEFAULT_SESSION_COUNTS;
  const holdMs: number = options.holdMs ?? DEFAULT_HOLD_MS;
  const queueDepth: number = options.queueDepth ?? DEFAULT_QUEUE_DEPTH;
  const skipStorms: number = options.skipStorms ?? DEFAULT_SKIP_STORMS;
  const notes: string[] = [
    "Voice is headless (no Discord UDP). Audible send is unverifiable here.",
    `Mode ${mode}: mock uses instant play; webm uses StreamType.WebmOpus; http remuxes mpeg to webm/opus in the engine.`,
    "TTFA is playNow after join/resolve (same stage as Lavalink PATCH until TrackStart).",
  ];
  const fixture = mode === "mock" ? null : await setupFixtureAsync(mode);
  if (mode !== "mock" && fixture === null) {
    return {
      command: "bun run bench:load",
      java: false,
      mode,
      holdMs,
      queueDepth,
      skipStorms,
      points: [],
      notes: [...notes, "ffmpeg could not write a fixture; load sweep skipped."],
    };
  }
  const points: LoadPoint[] = [];
  try {
    for (const sessions of sessionCounts) {
      process.stderr.write(`load ${mode} N=${sessions}…\n`);
      const point: LoadPoint = await measurePointAsync({
        sessions,
        mode,
        holdMs,
        queueDepth,
        skipStorms,
        fixture,
      });
      points.push(point);
      if (point.cliff !== null) {
        notes.push(point.cliff);
        break;
      }
    }
  } finally {
    if (fixture?.kind === "http") {
      fixture.server.stop();
    }
    if (fixture !== null) {
      removeSineFixture(fixture.sine);
    }
  }
  return {
    command: "bun run bench:load",
    java: false,
    mode,
    holdMs,
    queueDepth,
    skipStorms,
    points,
    notes,
  };
}

interface MeasureInput {
  readonly sessions: number;
  readonly mode: LoadMode;
  readonly holdMs: number;
  readonly queueDepth: number;
  readonly skipStorms: number;
  readonly fixture: PreparedFixture | null;
}

async function measurePointAsync(input: MeasureInput): Promise<LoadPoint> {
  const histogram = monitorEventLoopDelay({ resolution: 1 });
  histogram.enable();
  if (input.mode !== "mock" && input.sessions === 1) {
    const warmSamples: number[] = [];
    const warm = await startSessionAsync(-1, input, warmSamples);
    if (warm !== null) {
      dropSession(warm.guildId);
    }
  }
  const cpuStart = process.cpuUsage();
  const wallStart: number = performance.now();
  const handles: SessionHandle[] = [];
  const ttfaSamples: number[] = [];
  const skipSamples: number[] = [];
  const stormSamples: number[] = [];
  let timeouts = 0;
  let errors = 0;
  try {
    const starts = Array.from({ length: input.sessions }, (_, index) =>
      startSessionAsync(index, input, ttfaSamples),
    );
    const started = await Promise.all(starts);
    for (const handle of started) {
      if (handle === null) {
        errors += 1;
        continue;
      }
      handles.push(handle);
    }
    await sleepAsync(input.holdMs);
    const skipResults = await Promise.all(handles.map(skipOnceAsync));
    for (const skipMs of skipResults) {
      if (skipMs === null) {
        timeouts += 1;
        continue;
      }
      skipSamples.push(skipMs);
    }
    for (const handle of handles) {
      enqueueMany(handle.session, handle.playUri, input.queueDepth);
    }
    await sleepAsync(PREFETCH_WAIT_MS);
    const storms = handles.map((handle) =>
      skipStormAsync(handle, input.skipStorms, stormSamples),
    );
    const stormResults = await Promise.all(storms);
    timeouts += stormResults.reduce((sum, failed) => sum + failed, 0);
  } catch {
    errors += 1;
  } finally {
    for (const handle of handles) {
      dropSession(handle.guildId);
    }
    histogram.disable();
  }
  const wallMs: number = performance.now() - wallStart;
  const cpu = process.cpuUsage(cpuStart);
  const memory = process.memoryUsage();
  const started: number = input.sessions;
  const operations: number = started + handles.length + handles.length * input.skipStorms;
  const failCount: number = timeouts + errors;
  const failRate: number =
    operations === 0 ? 1 : failCount / operations;
  const ttfa = optionalSummary(ttfaSamples);
  const lag = {
    mean: roundLagMs(histogram.mean),
    max: roundLagMs(histogram.max),
  };
  return {
    sessions: input.sessions,
    ttfa_ms: ttfa,
    skip_ms: optionalSummary(skipSamples),
    queue_skip_storm_ms: optionalSummary(stormSamples),
    rss_mb: bytesToMb(memory.rss),
    heap_mb: bytesToMb(memory.heapUsed),
    cpu_pct: cpuPct(cpu, wallMs),
    event_loop_lag_ms: lag,
    failures: { timeouts, errors, started },
    fail_rate: Math.round(failRate * 10000) / 10000,
    cliff: cliffNote(input.sessions, ttfa, lag.max, failRate),
  };
}

interface SessionHandle {
  readonly guildId: string;
  readonly session: GuildMusicSession;
  readonly playUri: string;
}

async function startSessionAsync(
  index: number,
  input: MeasureInput,
  ttfaSamples: number[],
): Promise<SessionHandle | null> {
  const guildId: string = `load-${input.sessions}-${index}-${Math.random().toString(16).slice(2)}`;
  const engine: EnginePort = createEngine(input);
  const voice: VoicePort = createVoice(input.mode);
  const session = createSession({ guildId, engine, voice });
  try {
    await session.joinInvoker("voice-1");
    const resolved: ResolveResult = await session.engine.resolveTrack({
      query: resolveQuery(input, index),
    });
    const first: Track | undefined = resolved.tracks[0];
    if (first === undefined) {
      dropSession(guildId);
      return null;
    }
    const startedAt: number = performance.now();
    await session.playNow(first);
    ttfaSamples.push(performance.now() - startedAt);
    return { guildId, session, playUri: first.uri };
  } catch {
    dropSession(guildId);
    return null;
  }
}

async function skipOnceAsync(handle: SessionHandle): Promise<number | null> {
  handle.session.enqueue(nextTrack("skip-target", handle.playUri));
  await sleepAsync(PREFETCH_WAIT_MS);
  const startedAt: number = performance.now();
  handle.session.skipCurrent();
  const ready: boolean = await waitUntilAsync(
    () => handle.session.currentTrack?.title === "skip-target",
    8_000,
  );
  if (!ready) {
    return null;
  }
  return performance.now() - startedAt;
}

async function skipStormAsync(
  handle: SessionHandle,
  storms: number,
  samples: number[],
): Promise<number> {
  let timeouts = 0;
  for (let index = 0; index < storms; index += 1) {
    const previous: string = handle.session.currentTrack?.title ?? "";
    if (handle.session.snapshot().upcoming.length === 0) {
      handle.session.enqueue(nextTrack(`storm-${index}`, handle.playUri));
      await sleepAsync(PREFETCH_WAIT_MS);
    }
    const startedAt: number = performance.now();
    handle.session.skipCurrent();
    const ready: boolean = await waitUntilAsync(
      () =>
        handle.session.currentTrack !== null &&
        handle.session.currentTrack.title !== previous,
      8_000,
    );
    if (!ready) {
      timeouts += 1;
      continue;
    }
    samples.push(performance.now() - startedAt);
  }
  return timeouts;
}

function enqueueMany(session: GuildMusicSession, playUri: string, count: number): void {
  for (let index = 0; index < count; index += 1) {
    session.enqueue(nextTrack(`q${index}`, playUri));
  }
}

function createEngine(input: MeasureInput): EnginePort {
  if (input.mode === "mock") {
    return new InstantEngine();
  }
  if (input.mode === "http" && input.fixture?.kind === "http") {
    return new LiveHttpEngine();
  }
  if (input.fixture?.kind === "webm") {
    return new FileEngine(input.fixture.bytes, "webm/opus");
  }
  return new InstantEngine();
}

function createVoice(mode: LoadMode): VoicePort {
  if (mode === "mock") {
    return new InstantVoice();
  }
  return new HeadlessVoicePort(true);
}

function resolveQuery(input: MeasureInput, index: number): string {
  if (input.fixture?.kind === "http") {
    return `${input.fixture.baseUrl}/a-${index}.mp3`;
  }
  return "https://bench.local/fixture.webm";
}

function nextTrack(title: string, uri: string = "https://bench.local/fixture.webm"): Track {
  return {
    title,
    uri,
    durationSeconds: 8,
  };
}

function cliffNote(
  sessions: number,
  ttfa: SampleSummary | null,
  lagMax: number,
  failRate: number,
): string | null {
  if (failRate >= FAIL_CLIFF_RATE) {
    return `cliff at N=${sessions}: fail_rate ${failRate}`;
  }
  if (ttfa !== null && ttfa.p95 >= TTFA_P95_CLIFF_MS) {
    return `cliff at N=${sessions}: ttfa p95 ${ttfa.p95} ms`;
  }
  if (lagMax >= LAG_CLIFF_MS) {
    return `cliff at N=${sessions}: event-loop lag max ${lagMax} ms`;
  }
  return null;
}

function optionalSummary(samples: readonly number[]): SampleSummary | null {
  if (samples.length === 0) {
    return null;
  }
  return summarizeSamples(samples);
}

function cpuPct(
  cpu: NodeJS.CpuUsage,
  wallMs: number,
): number | null {
  if (wallMs <= 0) {
    return null;
  }
  const cpuMs: number = (cpu.user + cpu.system) / 1000;
  return Math.round((cpuMs / wallMs) * 10000) / 100;
}

function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function roundLagMs(nanoseconds: number): number {
  return Math.round((nanoseconds / 1e6) * 1000) / 1000;
}

async function waitUntilAsync(
  isReady: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt: number = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (isReady()) {
      return true;
    }
    await sleepAsync(0);
  }
  return false;
}

type PreparedFixture =
  | { readonly kind: "webm"; readonly sine: SineFixture; readonly bytes: Buffer }
  | {
      readonly kind: "http";
      readonly sine: SineFixture;
      readonly baseUrl: string;
      readonly server: { stop: () => void };
    };

async function setupFixtureAsync(
  mode: "webm" | "http",
): Promise<PreparedFixture | null> {
  if (mode === "webm") {
    const sine = writeSineFixture({
      fileName: "sine.webm",
      durationSeconds: 12,
      extraArgs: WEBM_OPUS_ARGS,
    });
    if (sine === null) {
      return null;
    }
    return { kind: "webm", sine, bytes: readFileSync(sine.path) };
  }
  const mp3 = writeSineFixture({
    fileName: "sine.mp3",
    durationSeconds: 12,
    extraArgs: MP3_ARGS,
  });
  const sine =
    mp3 ??
    writeSineFixture({
      fileName: "sine.opus",
      durationSeconds: 12,
      extraArgs: OGG_OPUS_ARGS,
    });
  if (sine === null) {
    return null;
  }
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      return new Response(Bun.file(sine.path), {
        headers: {
          "content-type": sine.path.endsWith(".mp3")
            ? "audio/mpeg"
            : "audio/opus",
        },
      });
    },
  });
  return {
    kind: "http",
    sine,
    baseUrl: `http://127.0.0.1:${server.port}`,
    server,
  };
}

class FileEngine implements EnginePort {
  readonly #bytes: Buffer;
  readonly #format: TrackAudio["format"];

  constructor(bytes: Buffer, format: TrackAudio["format"]) {
    this.#bytes = bytes;
    this.#format = format;
  }

  async resolveTrack(): Promise<ResolveResult> {
    return {
      tracks: [nextTrack("fixture")],
      playlistTitle: null,
      truncated: false,
    };
  }

  async openTrackAudio(): Promise<TrackAudio> {
    return {
      stream: Readable.toWeb(
        Readable.from(this.#bytes),
      ) as ReadableStream<Uint8Array>,
      format: this.#format,
    };
  }
}

class LiveHttpEngine implements EnginePort {
  async resolveTrack(input: {
    readonly query: string;
    readonly source?: "soundcloud";
  }): Promise<ResolveResult> {
    return resolveTrack({ query: input.query });
  }

  async openTrackAudio(input: { readonly track: Track }): Promise<TrackAudio> {
    return openTrackAudio(input);
  }
}

class InstantEngine implements EnginePort {
  async resolveTrack(): Promise<ResolveResult> {
    return {
      tracks: [nextTrack("fixture")],
      playlistTitle: null,
      truncated: false,
    };
  }

  async openTrackAudio(): Promise<TrackAudio> {
    return { stream: immediateStream(), format: "webm/opus" };
  }
}

class InstantVoice implements VoicePort {
  #channelId: string | null = null;
  #idleHandler: (() => void) | undefined;

  async join(channelId: string): Promise<void> {
    this.#channelId = channelId;
  }

  getChannelId(): string | null {
    return this.#channelId;
  }

  getChannelName(): string {
    return "bench";
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

function immediateStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      controller.close();
    },
  });
}

/**
 * Markdown table for a load report.
 * @param report - Scale points.
 * @returns Markdown table.
 */
export function loadMarkdown(report: LoadReport): string {
  const lines: string[] = [
    `| N | ttfa p50 | ttfa p95 | skip p50 | skip p95 | rss_mb | heap_mb | cpu_pct | lag max | fail_rate | cliff |`,
    `|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|`,
  ];
  for (const point of report.points) {
    lines.push(
      `| ${point.sessions} | ${fmt(point.ttfa_ms?.p50 ?? null)} | ${fmt(point.ttfa_ms?.p95 ?? null)} | ${fmt(point.skip_ms?.p50 ?? null)} | ${fmt(point.skip_ms?.p95 ?? null)} | ${point.rss_mb} | ${point.heap_mb} | ${fmt(point.cpu_pct)} | ${point.event_loop_lag_ms.max} | ${point.fail_rate} | ${point.cliff ?? ""} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function fmt(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return String(value);
}
