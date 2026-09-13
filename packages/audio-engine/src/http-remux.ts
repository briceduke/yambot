import { spawn, spawnSync, type ChildProcessByStdio } from "node:child_process";
import { Readable, type Writable } from "node:stream";

import { TrackResolveError, type TrackAudio } from "./track.ts";

const POOL_SIZE = 2;
const WARM_WAIT_MS = 50;
const FIRST_BYTE_TIMEOUT_MS = 5_000;
const PLAYABLE_PREFIX_BYTES = 4_096;
const PLAY_FAILED = "Couldn't play that stream.";

const MP3_TO_WEBM_ARGS: readonly string[] = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-fflags",
  "nobuffer",
  "-flags",
  "low_delay",
  "-probesize",
  "32",
  "-analyzeduration",
  "0",
  "-f",
  "mp3",
  "-i",
  "pipe:0",
  "-c:a",
  "libopus",
  "-b:a",
  "64k",
  "-application",
  "lowdelay",
  "-frame_duration",
  "20",
  "-f",
  "webm",
  "-cluster_size_limit",
  "2k",
  "-cluster_time_limit",
  "1",
  "pipe:1",
];

type RemuxWorker = ChildProcessByStdio<Writable, Readable, null>;

const idleWorkers: RemuxWorker[] = [];
let ffmpegAvailable: boolean | null = null;
let poolIsWarm = false;

/**
 * Starts idle mp3→webm ffmpeg workers so the first HTTP open skips spawn.
 * @returns Resolves after workers exist, or immediately when ffmpeg is missing.
 */
export async function prewarmHttpRemuxAsync(): Promise<void> {
  if (!hasFfmpeg()) {
    return;
  }
  fillPool();
  if (poolIsWarm) {
    return;
  }
  await sleepAsync(WARM_WAIT_MS);
  poolIsWarm = true;
}

/**
 * Kills idle remux workers so benches can drop RSS after HTTP measure.
 */
export function stopHttpRemuxPool(): void {
  while (idleWorkers.length > 0) {
    const worker: RemuxWorker | undefined = idleWorkers.pop();
    worker?.kill("SIGKILL");
  }
  poolIsWarm = false;
}

/**
 * Remuxes HTTP MPEG to webm/opus through a warm ffmpeg worker.
 * Returns the original audio when ffmpeg is missing.
 * @param audio - Open HTTP body.
 * @returns webm/opus when remux starts, otherwise the input.
 */
export async function remuxHttpMpegToWebmAsync(
  audio: TrackAudio,
): Promise<TrackAudio> {
  if (audio.format !== "http/mpeg") {
    return audio;
  }
  if (!hasFfmpeg()) {
    return audio;
  }
  await prewarmHttpRemuxAsync();
  const worker: RemuxWorker | null = takeWorker();
  if (worker === null) {
    return audio;
  }
  return remuxWithWorkerAsync(audio, worker);
}

function hasFfmpeg(): boolean {
  if (ffmpegAvailable !== null) {
    return ffmpegAvailable;
  }
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  ffmpegAvailable = result.status === 0;
  return ffmpegAvailable;
}

function fillPool(): void {
  while (idleWorkers.length < POOL_SIZE) {
    const worker: RemuxWorker | null = spawnWorkerOrNull();
    if (worker === null) {
      return;
    }
    idleWorkers.push(worker);
  }
}

function takeWorker(): RemuxWorker | null {
  const pooled: RemuxWorker | undefined = idleWorkers.pop();
  fillPool();
  if (pooled !== undefined) {
    return pooled;
  }
  return spawnWorkerOrNull();
}

function spawnWorkerOrNull(): RemuxWorker | null {
  try {
    const child: RemuxWorker = spawn("ffmpeg", [...MP3_TO_WEBM_ARGS], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    child.unref();
    unrefIfPresent(child.stdin);
    unrefIfPresent(child.stdout);
    child.once("error", () => {
      child.kill("SIGKILL");
    });
    return child;
  } catch {
    return null;
  }
}

async function remuxWithWorkerAsync(
  audio: TrackAudio,
  worker: RemuxWorker,
): Promise<TrackAudio> {
  const nodeIn: Readable = Readable.fromWeb(audio.stream);
  nodeIn.on("error", () => {
    worker.kill("SIGKILL");
  });
  nodeIn.pipe(worker.stdin);
  try {
    await waitBufferedPrefixAsync(worker.stdout, PLAYABLE_PREFIX_BYTES);
  } catch {
    worker.kill("SIGKILL");
    throw new TrackResolveError(PLAY_FAILED);
  }
  return {
    stream: Readable.toWeb(worker.stdout) as ReadableStream<Uint8Array>,
    format: "webm/opus",
  };
}

function waitBufferedPrefixAsync(
  stream: Readable,
  minBytes: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      cleanup();
      reject(new Error("http remux prefix timed out"));
    }, FIRST_BYTE_TIMEOUT_MS);
    function onReadable(): void {
      drainToChunks();
      if (total >= minBytes) {
        finishOk();
      }
    }
    function onEnd(): void {
      if (total > 0) {
        finishOk();
        return;
      }
      cleanup();
      reject(new Error("http remux ended before first byte"));
    }
    function onFail(error: Error): void {
      cleanup();
      reject(error);
    }
    function drainToChunks(): void {
      let chunk: Buffer | null = stream.read() as Buffer | null;
      while (chunk !== null) {
        chunks.push(chunk);
        total += chunk.length;
        chunk = stream.read() as Buffer | null;
      }
    }
    function finishOk(): void {
      cleanup();
      stream.unshift(Buffer.concat(chunks));
      resolve();
    }
    function cleanup(): void {
      clearTimeout(timer);
      stream.off("readable", onReadable);
      stream.off("error", onFail);
      stream.off("end", onEnd);
    }
    stream.pause();
    stream.on("readable", onReadable);
    stream.once("error", onFail);
    stream.once("end", onEnd);
    onReadable();
  });
}

function hasUnref(stream: object): stream is { unref: () => void } {
  return "unref" in stream && typeof stream.unref === "function";
}

function unrefIfPresent(stream: object): void {
  if (hasUnref(stream)) {
    stream.unref();
  }
}

function sleepAsync(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
