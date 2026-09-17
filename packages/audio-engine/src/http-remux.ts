import { spawn, spawnSync, type ChildProcessByStdio } from "node:child_process";
import { Readable, type Writable } from "node:stream";

import { TrackResolveError, type TrackAudio } from "./track.ts";

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

type RemuxProcess = ChildProcessByStdio<Writable, Readable, null>;

let ffmpegAvailable: boolean | null = null;

/**
 * Remuxes HTTP MPEG to webm/opus through PATH ffmpeg.
 * Waits for a playable webm prefix so Discord can start without a pause.
 * Returns the original audio when ffmpeg is missing or the format is not mpeg.
 * @param audio - Open HTTP body.
 * @returns webm/opus when remux starts, otherwise the input.
 */
export async function remuxHttpMpegToWebmAsync(
  audio: TrackAudio,
): Promise<TrackAudio> {
  if (audio.format !== "http/mpeg" || !hasFfmpeg()) {
    return audio;
  }
  const child: RemuxProcess | null = spawnRemuxOrNull();
  if (child === null) {
    return audio;
  }
  return remuxWithProcessAsync(audio, child);
}

function hasFfmpeg(): boolean {
  if (ffmpegAvailable !== null) {
    return ffmpegAvailable;
  }
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  ffmpegAvailable = result.status === 0;
  return ffmpegAvailable;
}

function spawnRemuxOrNull(): RemuxProcess | null {
  try {
    const child: RemuxProcess = spawn("ffmpeg", [...MP3_TO_WEBM_ARGS], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    child.once("error", () => {
      child.kill("SIGKILL");
    });
    return child;
  } catch {
    return null;
  }
}

async function remuxWithProcessAsync(
  audio: TrackAudio,
  child: RemuxProcess,
): Promise<TrackAudio> {
  const nodeIn: Readable = Readable.fromWeb(audio.stream);
  nodeIn.on("error", () => {
    child.kill("SIGKILL");
  });
  nodeIn.pipe(child.stdin);
  try {
    await waitBufferedPrefixAsync(child.stdout, PLAYABLE_PREFIX_BYTES);
  } catch {
    child.kill("SIGKILL");
    throw new TrackResolveError(PLAY_FAILED);
  }
  return {
    stream: Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
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
