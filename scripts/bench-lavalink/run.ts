import { createServer } from "node:net";
import { readFileSync, rmSync } from "node:fs";

import { runBotBench } from "../../packages/bot/src/bench/run.ts";
import {
  loadMarkdown,
  runLoadBench,
  type LoadPoint,
  type LoadReport,
} from "../../packages/bot/src/bench/load.ts";
import {
  MP3_ARGS,
  OGG_OPUS_ARGS,
  removeSineFixture,
  writeSineFixture,
  type SineFixture,
} from "../../packages/bot/src/bench/sine-file.ts";
import { runEngineBench } from "../../packages/audio-engine/src/bench/run.ts";
import {
  summarizeSamples,
  type SampleSummary,
} from "../../packages/audio-engine/src/bench/stats.ts";
import {
  buildScaleTtfaRow,
  buildWinnerRow,
  winnerMarkdown,
  type WinnerRow,
} from "../../packages/audio-engine/src/bench/winner.ts";
import { stopHttpRemuxPool } from "@yambot/audio-engine";
import { LavalinkClient, type LoadOutcome } from "./client.ts";
import { LIVE_SOUNDCLOUD_URL, LIVE_YOUTUBE_URL, LAVALINK_VERSION } from "./pin.ts";
import {
  readJavaVersion,
  startLavalinkAsync,
  stopLavalink,
  type LavalinkProcess,
} from "./process.ts";
import {
  attemptYambotLiveLoadAsync,
  measureYambotHttpAsync,
  type YambotHttpMetrics,
} from "./yambot-http.ts";

const DEFAULT_N = 10;
const HOLD_MS = 2_000;
const SCALE_COUNTS: readonly number[] = [1, 10, 50, 100];

interface HttpFixtures {
  readonly sine: SineFixture;
  readonly baseUrl: string;
  readonly urlA: string;
  readonly urlB: string;
  readonly server: { readonly port: number; stop: () => void };
}

interface LavalinkHttpMetrics {
  readonly load_ms: SampleSummary;
  readonly ttfa_ms: SampleSummary | null;
  readonly skip_ms: SampleSummary | null;
  readonly rss_mb: number | null;
  readonly cpu_pct: number | null;
  readonly encodedA: string | null;
  readonly encodedB: string | null;
  readonly playError: string | null;
}

interface LiveAttempt {
  readonly yambot: SampleSummary | null;
  readonly lavalink: SampleSummary | null;
  readonly yambotError: string | null;
  readonly lavalinkError: string | null;
}

interface LiveHalf {
  readonly summary: SampleSummary | null;
  readonly error: string | null;
}

interface LavalinkScalePoint {
  readonly sessions: number;
  readonly ttfa_ms: SampleSummary | null;
  readonly rss_mb: number | null;
  readonly fail_rate: number;
  readonly error: string | null;
}

/** Full bake-off + scale report. */
export interface VsLavalinkReport {
  readonly command: "bun run bench:vs-lavalink";
  readonly java: true;
  readonly n: number;
  readonly host: {
    readonly bun: string;
    readonly node: string;
    readonly java: string;
    readonly lavalink: string;
  };
  readonly injected_perf: {
    readonly engine: Awaited<ReturnType<typeof runEngineBench>>;
    readonly bot: Awaited<ReturnType<typeof runBotBench>>;
  };
  readonly http_fixture: {
    readonly yambot: YambotHttpMetrics;
    readonly lavalink: LavalinkHttpMetrics | null;
  };
  readonly live: {
    readonly youtube: LiveAttempt;
    readonly soundcloud: LiveAttempt;
  };
  readonly scale: {
    readonly yambot: LoadReport;
    readonly lavalink: readonly LavalinkScalePoint[] | null;
    readonly lavalinkNote: string;
  };
  readonly winner_rows: readonly WinnerRow[];
  readonly notes: readonly string[];
}

function log(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Runs injected bench:perf, local HTTP bake-off, live attempts, and scale.
 * @param argv - CLI argv (`--n 10`).
 * @returns Full report object (caller prints JSON + markdown).
 */
export async function runVsLavalinkAsync(
  argv: readonly string[],
): Promise<VsLavalinkReport> {
  const n: number = readRepeatCount(argv);
  const notes: string[] = [
    "Lower p50 wins. Brice asked for end-user-shaped numbers, not Node vs JVM fairness.",
    "HTTP TTFA is playNow of already-opened audio until AudioPlayer Playing vs loadtracks + TrackStartEvent (no Discord UDP).",
    "Lavalink frameBufferDurationMs stays at the example default 5000.",
  ];
  log("injected bench:perf…");
  const injected_perf = {
    engine: await runEngineBench(n),
    bot: await runBotBench(n),
  };
  log("starting local HTTP fixtures…");
  const fixtures: HttpFixtures = await startHttpFixturesAsync();
  let ll: LavalinkProcess | undefined;
  let client: LavalinkClient | undefined;
  let lavalinkHttp: LavalinkHttpMetrics | null = null;
  let lavalinkYoutube: LiveHalf = { summary: null, error: "not run" };
  let lavalinkSoundcloud: LiveHalf = { summary: null, error: "not run" };
  let lavalinkScale: readonly LavalinkScalePoint[] | null = null;
  let lavalinkNote: string = "Lavalink multi-player not measured.";
  try {
    const port: number = await pickFreePortAsync();
    log(`starting Lavalink on port ${port}…`);
    ll = await startLavalinkAsync(port);
    log("Lavalink ready, opening websocket…");
    client = await LavalinkClient.connectAsync(port);
    log("measuring Lavalink HTTP fixture…");
    lavalinkHttp = await measureLavalinkHttpAsync(
      client,
      ll.pid,
      fixtures.urlA,
      fixtures.urlB,
      n,
    );
    if (lavalinkHttp.encodedA !== null && lavalinkHttp.playError === null) {
      log("measuring Lavalink N-player scale…");
      lavalinkScale = await measureLavalinkScaleAsync(
        client,
        ll.pid,
        lavalinkHttp.encodedA,
      );
      lavalinkNote = "Lavalink N players: PATCH play until TrackStartEvent, no Discord voice.";
    } else {
      lavalinkNote = `Lavalink multi-player not measured: ${lavalinkHttp.playError ?? "no encoded track"}.`;
      notes.push(lavalinkNote);
    }
    log("Lavalink live YouTube/SoundCloud load (12s cap)…");
    lavalinkYoutube = await attemptLavalinkLiveAsync(client, LIVE_YOUTUBE_URL);
    lavalinkSoundcloud = await attemptLavalinkLiveAsync(
      client,
      LIVE_SOUNDCLOUD_URL,
    );
  } catch (error) {
    notes.push(`Lavalink harness: ${errorMessage(error)}`);
    lavalinkYoutube = { summary: null, error: errorMessage(error) };
    lavalinkSoundcloud = lavalinkYoutube;
  } finally {
    client?.close();
    if (ll !== undefined) {
      stopLavalink(ll.child);
      await Bun.sleep(400);
    }
  }
  log("measuring yambot HTTP fixture…");
  const yambotHttp: YambotHttpMetrics = await measureYambotHttpAsync({
    urlA: fixtures.urlA,
    urlB: fixtures.urlB,
    n,
    holdMs: HOLD_MS,
  });
  stopHttpRemuxPool();
  log("measuring yambot webm/opus scale…");
  const yambotScale: LoadReport = await runLoadBench({
    mode: "webm",
    sessionCounts: SCALE_COUNTS,
    holdMs: HOLD_MS,
    queueDepth: 50,
    skipStorms: 3,
  });
  log("yambot live YouTube/SoundCloud load (12s cap)…");
  const youtubeLive: LiveAttempt = await mergeLiveAsync(
    LIVE_YOUTUBE_URL,
    lavalinkYoutube,
  );
  const soundcloudLive: LiveAttempt = await mergeLiveAsync(
    LIVE_SOUNDCLOUD_URL,
    lavalinkSoundcloud,
  );
  fixtures.server.stop();
  removeSineFixture(fixtures.sine);
  if (ll !== undefined) {
    rmSync(ll.workDir, { recursive: true, force: true });
  }
  const winner_rows: WinnerRow[] = buildRows(
    yambotHttp,
    lavalinkHttp,
    youtubeLive,
    soundcloudLive,
    yambotScale,
    lavalinkScale,
  );
  return {
    command: "bun run bench:vs-lavalink",
    java: true,
    n,
    host: {
      bun: Bun.version,
      node: process.version,
      java: readJavaVersion(),
      lavalink: LAVALINK_VERSION,
    },
    injected_perf,
    http_fixture: { yambot: yambotHttp, lavalink: lavalinkHttp },
    live: { youtube: youtubeLive, soundcloud: soundcloudLive },
    scale: { yambot: yambotScale, lavalink: lavalinkScale, lavalinkNote },
    winner_rows,
    notes,
  };
}

/**
 * Prints JSON, winner table, and scale tables.
 * @param report - Result of `runVsLavalinkAsync`.
 */
export function printVsLavalink(report: VsLavalinkReport): void {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n\n`);
  process.stdout.write("## Winner table (local HTTP mpeg)\n\n");
  process.stdout.write(winnerMarkdown(report.winner_rows));
  process.stdout.write("\n## yambot scale (webm/opus, headless)\n\n");
  process.stdout.write(loadMarkdown(report.scale.yambot));
  process.stdout.write(`\n${report.scale.lavalinkNote}\n`);
  if (report.scale.lavalink !== null) {
    process.stdout.write("\n## Lavalink scale (HTTP fixture players)\n\n");
    process.stdout.write(lavalinkScaleMarkdown(report.scale.lavalink));
  }
  for (const note of report.notes) {
    process.stdout.write(`${note}\n`);
  }
}

function buildRows(
  yambot: YambotHttpMetrics,
  lavalink: LavalinkHttpMetrics | null,
  youtube: LiveAttempt,
  soundcloud: LiveAttempt,
  yambotScale: LoadReport,
  lavalinkScale: readonly LavalinkScalePoint[] | null,
): WinnerRow[] {
  const rows: WinnerRow[] = [
    buildWinnerRow(
      "http_mpeg_load_ms",
      yambot.load_ms,
      lavalink?.load_ms ?? null,
      "resolveTrack vs REST loadtracks, same local URL",
    ),
    buildWinnerRow(
      "http_mpeg_ttfa_ms",
      yambot.ttfa_ms,
      lavalink?.ttfa_ms ?? null,
      "AudioPlayer Playing vs TrackStartEvent",
    ),
    buildWinnerRow(
      "http_mpeg_skip_ms",
      yambot.skip_ms,
      lavalink?.skip_ms ?? null,
      "skip to already-loaded next fixture",
    ),
    buildWinnerRow(
      "http_mpeg_rss_mb",
      scalarSummary(yambot.rss_mb),
      lavalink?.rss_mb === null || lavalink === null
        ? null
        : scalarSummary(lavalink.rss_mb),
      "bun RSS vs Lavalink JVM RSS after hold",
    ),
    buildWinnerRow(
      "http_mpeg_cpu_pct",
      yambot.cpu_pct === null ? null : scalarSummary(yambot.cpu_pct),
      lavalink?.cpu_pct === null || lavalink === null
        ? null
        : scalarSummary(lavalink.cpu_pct),
      "process CPU during hold; not Discord send",
    ),
    buildWinnerRow(
      "youtube_url_load_ms",
      youtube.yambot,
      youtube.lavalink,
      youtube.yambotError ?? youtube.lavalinkError ?? "live YouTube",
    ),
    buildWinnerRow(
      "soundcloud_url_load_ms",
      soundcloud.yambot,
      soundcloud.lavalink,
      soundcloud.yambotError ?? soundcloud.lavalinkError ?? "live SoundCloud",
    ),
  ];
  for (const sessions of SCALE_COUNTS) {
    const yPoint: LoadPoint | undefined = yambotScale.points.find(
      (point) => point.sessions === sessions,
    );
    const lPoint: LavalinkScalePoint | undefined = lavalinkScale?.find(
      (point) => point.sessions === sessions,
    );
    rows.push(
      buildScaleTtfaRow(
        `scale_ttfa_ms_N${sessions}`,
        yPoint?.ttfa_ms ?? null,
        yPoint?.fail_rate ?? 1,
        lPoint?.ttfa_ms ?? null,
        lPoint?.fail_rate ?? 1,
      ),
      buildWinnerRow(
        `scale_rss_mb_N${sessions}`,
        yPoint === undefined ? null : scalarSummary(yPoint.rss_mb),
        lPoint?.rss_mb === null || lPoint === undefined
          ? null
          : scalarSummary(lPoint.rss_mb),
        "RSS after N playing",
      ),
    );
  }
  return rows;
}

async function measureLavalinkHttpAsync(
  client: LavalinkClient,
  pid: number,
  urlA: string,
  urlB: string,
  n: number,
): Promise<LavalinkHttpMetrics> {
  const loadSamples: number[] = [];
  let encodedA: string | null = null;
  let encodedB: string | null = null;
  for (let index = 0; index < n; index += 1) {
    const loaded: LoadOutcome = await client.loadTracksAsync(urlA);
    loadSamples.push(loaded.elapsedMs);
    if (loaded.ok && loaded.encoded !== null) {
      encodedA = loaded.encoded;
    }
  }
  const loadedB: LoadOutcome = await client.loadTracksAsync(urlB);
  if (loadedB.ok) {
    encodedB = loadedB.encoded;
  }
  const load_ms: SampleSummary = summarizeSamples(loadSamples);
  if (encodedA === null) {
    return {
      load_ms,
      ttfa_ms: null,
      skip_ms: null,
      rss_mb: readRssMb(pid),
      cpu_pct: null,
      encodedA,
      encodedB,
      playError: "loadtracks did not return an encoded HTTP track",
    };
  }
  const ttfaSamples: number[] = [];
  let playError: string | null = null;
  try {
    for (let index = 0; index < n; index += 1) {
      const guildId: string = `2${String(index).padStart(3, "0")}`;
      ttfaSamples.push(await client.playUntilStartAsync(guildId, encodedA));
      await client.destroyPlayerAsync(guildId);
    }
  } catch (error) {
    playError = errorMessage(error);
  }
  const skipSamples: number[] = [];
  if (playError === null && encodedB !== null) {
    try {
      for (let index = 0; index < n; index += 1) {
        const guildId: string = `3${String(index).padStart(3, "0")}`;
        await client.playUntilStartAsync(guildId, encodedA);
        skipSamples.push(await client.playUntilStartAsync(guildId, encodedB));
        await client.destroyPlayerAsync(guildId);
      }
    } catch (error) {
      playError = playError ?? errorMessage(error);
    }
  }
  const cpuStart = readProcCpuSeconds(pid);
  const wallStart: number = performance.now();
  const cpuGuild = "2999";
  try {
    await client.playUntilStartAsync(cpuGuild, encodedA);
    await Bun.sleep(HOLD_MS);
  } catch (error) {
    playError = playError ?? errorMessage(error);
  }
  const cpuEnd = readProcCpuSeconds(pid);
  const wallMs: number = performance.now() - wallStart;
  await client.destroyPlayerAsync(cpuGuild).catch(() => {});
  return {
    load_ms,
    ttfa_ms: ttfaSamples.length === 0 ? null : summarizeSamples(ttfaSamples),
    skip_ms: skipSamples.length === 0 ? null : summarizeSamples(skipSamples),
    rss_mb: readRssMb(pid),
    cpu_pct: cpuPctFromProc(cpuStart, cpuEnd, wallMs),
    encodedA,
    encodedB,
    playError,
  };
}

async function measureLavalinkScaleAsync(
  client: LavalinkClient,
  pid: number,
  encoded: string,
): Promise<LavalinkScalePoint[]> {
  const points: LavalinkScalePoint[] = [];
  for (const sessions of SCALE_COUNTS) {
    log(`Lavalink scale N=${sessions}…`);
    const point: LavalinkScalePoint = await measureLavalinkScalePointAsync(
      client,
      pid,
      encoded,
      sessions,
    );
    points.push(point);
    if (point.fail_rate >= 0.05 || point.ttfa_ms === null) {
      break;
    }
  }
  return points;
}

async function measureLavalinkScalePointAsync(
  client: LavalinkClient,
  pid: number,
  encoded: string,
  sessions: number,
): Promise<LavalinkScalePoint> {
  const guildIds: string[] = Array.from(
    { length: sessions },
    (_, index) => `8${String(sessions).padStart(3, "0")}${String(index).padStart(3, "0")}`,
  );
  const samples: number[] = [];
  let fails = 0;
  let error: string | null = null;
  try {
    const batchSize = 10;
    for (let offset = 0; offset < guildIds.length; offset += batchSize) {
      const batch: readonly string[] = guildIds.slice(offset, offset + batchSize);
      await Promise.all(
        batch.map(async (guildId) => {
          try {
            samples.push(await client.playUntilStartAsync(guildId, encoded));
          } catch (caught) {
            fails += 1;
            error = error ?? errorMessage(caught);
          }
        }),
      );
    }
    await Bun.sleep(500);
  } finally {
    const batchSize = 10;
    for (let offset = 0; offset < guildIds.length; offset += batchSize) {
      const batch: readonly string[] = guildIds.slice(offset, offset + batchSize);
      await Promise.all(
        batch.map((guildId) => client.destroyPlayerAsync(guildId).catch(() => {})),
      );
    }
  }
  const started: number = sessions;
  return {
    sessions,
    ttfa_ms: samples.length === 0 ? null : summarizeSamples(samples),
    rss_mb: readRssMb(pid),
    fail_rate: Math.round((fails / started) * 10000) / 10000,
    error,
  };
}

async function attemptLavalinkLiveAsync(
  client: LavalinkClient,
  url: string,
): Promise<LiveHalf> {
  const loaded: LoadOutcome = await client.loadTracksAsync(url);
  if (!loaded.ok || loaded.encoded === null) {
    return { summary: null, error: loaded.error ?? "loadtracks failed" };
  }
  return {
    summary: {
      n: 1,
      p50: round3(loaded.elapsedMs),
      p95: round3(loaded.elapsedMs),
      min: round3(loaded.elapsedMs),
      max: round3(loaded.elapsedMs),
    },
    error: null,
  };
}

async function mergeLiveAsync(
  url: string,
  lavalink: LiveHalf,
): Promise<LiveAttempt> {
  const yambot = await attemptYambotLiveLoadAsync(url);
  return {
    yambot: yambot.summary,
    lavalink: lavalink.summary,
    yambotError: yambot.error,
    lavalinkError: lavalink.error,
  };
}

async function startHttpFixturesAsync(): Promise<HttpFixtures> {
  const mp3 = writeSineFixture({
    fileName: "sine.mp3",
    durationSeconds: 8,
    extraArgs: MP3_ARGS,
  });
  const sine =
    mp3 ??
    writeSineFixture({
      fileName: "sine.opus",
      durationSeconds: 8,
      extraArgs: OGG_OPUS_ARGS,
    });
  if (sine === null) {
    throw new Error("ffmpeg could not write an HTTP audio fixture.");
  }
  const fileName: string = sine.path.endsWith(".mp3") ? "track.mp3" : "track.opus";
  const contentType: string = sine.path.endsWith(".mp3") ? "audio/mpeg" : "audio/opus";
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      return new Response(Bun.file(sine.path), {
        headers: { "content-type": contentType },
      });
    },
  });
  const baseUrl: string = `http://127.0.0.1:${server.port}`;
  return {
    sine,
    baseUrl,
    urlA: `${baseUrl}/a-${fileName}`,
    urlB: `${baseUrl}/b-${fileName}`,
    server,
  };
}

function lavalinkScaleMarkdown(points: readonly LavalinkScalePoint[]): string {
  const lines: string[] = [
    `| N | ttfa p50 | ttfa p95 | rss_mb | fail_rate | error |`,
    `|---:|---:|---:|---:|---:|---|`,
  ];
  for (const point of points) {
    lines.push(
      `| ${point.sessions} | ${fmt(point.ttfa_ms?.p50 ?? null)} | ${fmt(point.ttfa_ms?.p95 ?? null)} | ${fmt(point.rss_mb)} | ${point.fail_rate} | ${point.error ?? ""} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function scalarSummary(value: number): SampleSummary {
  return { n: 1, p50: value, p95: value, min: value, max: value };
}

function readRssMb(pid: number): number | null {
  try {
    const status: string = readFileSync(`/proc/${pid}/status`, "utf8");
    const match: RegExpMatchArray | null = status.match(/VmRSS:\s+(\d+)\s+kB/);
    const kb: string | undefined = match?.[1];
    if (kb === undefined) {
      return null;
    }
    return Math.round((Number(kb) / 1024) * 100) / 100;
  } catch {
    return null;
  }
}

function readProcCpuSeconds(pid: number): number | null {
  try {
    const stat: string = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close: number = stat.lastIndexOf(")");
    const rest: readonly string[] = stat.slice(close + 2).split(" ");
    const utime: number = Number(rest[11]);
    const stime: number = Number(rest[12]);
    if (!Number.isFinite(utime) || !Number.isFinite(stime)) {
      return null;
    }
    return (utime + stime) / 100;
  } catch {
    return null;
  }
}

function cpuPctFromProc(
  start: number | null,
  end: number | null,
  wallMs: number,
): number | null {
  if (start === null || end === null || wallMs <= 0) {
    return null;
  }
  const cpuMs: number = (end - start) * 1000;
  return Math.round((cpuMs / wallMs) * 10000) / 100;
}

function pickFreePortAsync(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("could not bind a free port"));
        return;
      }
      const port: number = addr.port;
      server.close((closeError) => {
        if (closeError !== undefined) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function readRepeatCount(argv: readonly string[]): number {
  const flagIndex: number = argv.indexOf("--n");
  if (flagIndex === -1) {
    return DEFAULT_N;
  }
  const raw: string | undefined = argv[flagIndex + 1];
  const parsed: number = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_N;
  }
  return Math.floor(parsed);
}

function fmt(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return String(value);
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
