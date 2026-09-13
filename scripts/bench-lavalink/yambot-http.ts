import {
  openTrackAudio,
  prewarmHttpRemuxAsync,
  resolveTrack,
  stopHttpRemuxPool,
  type Track,
} from "@yambot/audio-engine";
import {
  summarizeSamples,
  timeManyAsync,
  type SampleSummary,
} from "../../packages/audio-engine/src/bench/stats.ts";
import { HeadlessVoicePort } from "../../packages/bot/src/bench/headless-voice.ts";
import {
  createSession,
  dropSession,
} from "../../packages/bot/src/guild-music-session.ts";
import { sleepAsync } from "../../packages/bot/src/bench/stats.ts";

const PREFETCH_WAIT_MS = 120;

/** yambot timings on one local HTTP fixture pair. */
export interface YambotHttpMetrics {
  readonly load_ms: SampleSummary;
  readonly open_ms: SampleSummary;
  readonly ttfa_ms: SampleSummary;
  readonly skip_ms: SampleSummary;
  readonly rss_mb: number;
  readonly heap_mb: number;
  readonly cpu_pct: number | null;
}

/**
 * Times real HTTP resolve/open/play/skip on localhost fixtures.
 * @param input - Two audio URLs, repeat count, and CPU hold.
 * @returns Summaries. TTFA is playNow of already-opened audio until
 *   AudioPlayer Playing. Skip plays the next track without Idle padding.
 */
export async function measureYambotHttpAsync(input: {
  readonly urlA: string;
  readonly urlB: string;
  readonly n: number;
  readonly holdMs: number;
}): Promise<YambotHttpMetrics> {
  await prewarmHttpRemuxAsync();
  const load_ms = await timeManyAsync(input.n, async () => {
    await resolveTrack({ query: input.urlA });
  });
  const open_ms = await timeManyAsync(input.n, async () => {
    const resolved = await resolveTrack({ query: input.urlA });
    const track: Track | undefined = resolved.tracks[0];
    if (track === undefined) {
      throw new Error("yambot HTTP resolve returned no track");
    }
    const audio = await openTrackAudio({ track });
    const reader = audio.stream.getReader();
    try {
      await reader.read();
    } finally {
      await reader.cancel();
    }
  });
  const ttfaSamples: number[] = [];
  for (let index = 0; index < input.n; index += 1) {
    ttfaSamples.push(await measurePlayNowMsAsync(input.urlA));
  }
  const ttfa_ms: SampleSummary = summarizeSamples(ttfaSamples);
  const skipSamples: number[] = [];
  for (let index = 0; index < input.n; index += 1) {
    skipSamples.push(await measureSkipMsAsync(input.urlA, input.urlB));
  }
  const skip_ms: SampleSummary = summarizeSamples(skipSamples);
  const cpu_pct: number | null = await measureCpuAsync(input.urlA, input.holdMs);
  stopHttpRemuxPool();
  const memory = process.memoryUsage();
  return {
    load_ms,
    open_ms,
    ttfa_ms,
    skip_ms,
    rss_mb: bytesToMb(memory.rss),
    heap_mb: bytesToMb(memory.heapUsed),
    cpu_pct,
  };
}

/**
 * One live resolve attempt. Returns elapsed ms or an error string.
 * @param url - YouTube or SoundCloud URL.
 * @returns Sample of 1, or null plus reason.
 */
export async function attemptYambotLiveLoadAsync(
  url: string,
): Promise<{ readonly summary: SampleSummary | null; readonly error: string | null }> {
  const startedAt: number = performance.now();
  try {
    const resolved = await Promise.race([
      resolveTrack({ query: url }),
      timeoutRejectAsync(12_000, "yambot live resolve timed out"),
    ]);
    if (resolved.tracks[0] === undefined) {
      return { summary: null, error: "no tracks" };
    }
    const elapsed: number = performance.now() - startedAt;
    return {
      summary: {
        n: 1,
        p50: round3(elapsed),
        p95: round3(elapsed),
        min: round3(elapsed),
        max: round3(elapsed),
      },
      error: null,
    };
  } catch (error) {
    return { summary: null, error: errorMessage(error) };
  }
}

async function measurePlayNowMsAsync(url: string): Promise<number> {
  const guildId: string = uniqueId("yt");
  const session = createSession({
    guildId,
    engine: liveEngine(),
    voice: new HeadlessVoicePort(true),
  });
  try {
    await session.joinInvoker("voice-1");
    const resolved = await session.engine.resolveTrack({ query: url });
    const track: Track | undefined = resolved.tracks[0];
    if (track === undefined) {
      throw new Error("no track");
    }
    const audio = await session.engine.openTrackAudio({ track });
    const startedAt: number = performance.now();
    await session.playNow(track, audio);
    return performance.now() - startedAt;
  } finally {
    dropSession(guildId);
  }
}

async function measureSkipMsAsync(urlA: string, urlB: string): Promise<number> {
  const guildId: string = uniqueId("ys");
  const session = createSession({
    guildId,
    engine: liveEngine(),
    voice: new HeadlessVoicePort(true),
  });
  try {
    await session.joinInvoker("voice-1");
    const first = await session.engine.resolveTrack({ query: urlA });
    const second = await session.engine.resolveTrack({ query: urlB });
    const trackA: Track | undefined = first.tracks[0];
    const trackB: Track | undefined = second.tracks[0];
    if (trackA === undefined || trackB === undefined) {
      throw new Error("expected two HTTP tracks");
    }
    await session.playNow(trackA);
    session.enqueue(trackB);
    await sleepAsync(PREFETCH_WAIT_MS);
    const startedAt: number = performance.now();
    session.skipCurrent();
    const ready: boolean = await waitTitleAsync(session, trackB.title, 10_000);
    if (!ready) {
      throw new Error("yambot skip did not reach the next track");
    }
    return performance.now() - startedAt;
  } finally {
    dropSession(guildId);
  }
}

async function measureCpuAsync(url: string, holdMs: number): Promise<number | null> {
  const guildId: string = uniqueId("yc");
  const session = createSession({
    guildId,
    engine: liveEngine(),
    voice: new HeadlessVoicePort(true),
  });
  const cpuStart = process.cpuUsage();
  const wallStart: number = performance.now();
  try {
    await session.joinInvoker("voice-1");
    const resolved = await session.engine.resolveTrack({ query: url });
    const track: Track | undefined = resolved.tracks[0];
    if (track === undefined) {
      return null;
    }
    await session.playNow(track);
    await sleepAsync(holdMs);
  } catch {
    return null;
  } finally {
    dropSession(guildId);
  }
  const wallMs: number = performance.now() - wallStart;
  if (wallMs <= 0) {
    return null;
  }
  const cpu = process.cpuUsage(cpuStart);
  const cpuMs: number = (cpu.user + cpu.system) / 1000;
  return Math.round((cpuMs / wallMs) * 10000) / 100;
}

function liveEngine(): {
  resolveTrack: typeof resolveTrack;
  openTrackAudio: typeof openTrackAudio;
} {
  return { resolveTrack, openTrackAudio };
}

async function waitTitleAsync(
  session: { readonly currentTrack: Track | null },
  title: string,
  timeoutMs: number,
): Promise<boolean> {
  const startedAt: number = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (session.currentTrack?.title === title) {
      return true;
    }
    await sleepAsync(0);
  }
  return false;
}

function uniqueId(label: string): string {
  return `${label}-${Math.random().toString(16).slice(2)}`;
}

function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function timeoutRejectAsync(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
}
