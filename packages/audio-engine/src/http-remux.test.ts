import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";

import { remuxHttpMpegToWebmAsync } from "./http-remux.ts";
import { TrackResolveError, type TrackAudio } from "./track.ts";

function hasFfmpeg(): boolean {
  return spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0;
}

function mp3SineStream(): ReadableStream<Uint8Array> {
  const result = spawnSync(
    "ffmpeg",
    [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      "-f",
      "mp3",
      "pipe:1",
    ],
    { encoding: "buffer" },
  );
  if (result.status !== 0 || result.stdout === null) {
    throw new Error("could not build mp3 fixture");
  }
  return Readable.toWeb(Readable.from(result.stdout)) as ReadableStream<Uint8Array>;
}

describe("remuxHttpMpegToWebmAsync", () => {
  test("leaves non-mpeg audio unchanged", async () => {
    const stream = Readable.toWeb(Readable.from(Buffer.from([1, 2]))) as ReadableStream<Uint8Array>;
    const input: TrackAudio = { stream, format: "webm/opus" };
    const output = await remuxHttpMpegToWebmAsync(input);
    expect(output).toBe(input);
  });

  test("remuxes mpeg to webm/opus when ffmpeg exists", async () => {
    if (!hasFfmpeg()) {
      return;
    }
    const audio = await remuxHttpMpegToWebmAsync({
      stream: mp3SineStream(),
      format: "http/mpeg",
    });
    expect(audio.format).toBe("webm/opus");
    const reader = audio.stream.getReader();
    try {
      const first = await reader.read();
      expect(first.done).toBe(false);
      expect((first.value?.byteLength ?? 0) > 0).toBe(true);
    } finally {
      await reader.cancel();
    }
  });

  test("throws when the mpeg body is empty", async () => {
    if (!hasFfmpeg()) {
      return;
    }
    const empty = Readable.toWeb(Readable.from(Buffer.alloc(0))) as ReadableStream<Uint8Array>;
    const error = await remuxHttpMpegToWebmAsync({
      stream: empty,
      format: "http/mpeg",
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
  });
});
