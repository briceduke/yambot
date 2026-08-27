import { StreamType } from "@discordjs/voice";
import { describe, expect, test } from "bun:test";

import {
  mapHlsPlayError,
  mapHttpPlayError,
  streamTypeFor,
} from "./discord-voice.ts";

describe("streamTypeFor", () => {
  test("maps webm/opus to StreamType.WebmOpus", () => {
    expect(streamTypeFor("webm/opus")).toBe(StreamType.WebmOpus);
  });

  test("maps hls/aac to StreamType.Arbitrary", () => {
    expect(streamTypeFor("hls/aac")).toBe(StreamType.Arbitrary);
  });

  test("maps http/mpeg to StreamType.Arbitrary", () => {
    expect(streamTypeFor("http/mpeg")).toBe(StreamType.Arbitrary);
  });
});

describe("mapHlsPlayError", () => {
  test("maps a missing ffmpeg spawn error to the pinned message", () => {
    const mapped: Error = mapHlsPlayError(new Error("FFmpeg/avconv not found!"));
    expect(mapped.message).toBe(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
  });

  test("maps ENOENT that mentions ffmpeg to the pinned message", () => {
    const error = new Error("spawn ffmpeg ENOENT") as Error & {
      code: string;
    };
    error.code = "ENOENT";
    const mapped: Error = mapHlsPlayError(error);
    expect(mapped.message).toBe(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
  });

  test("keeps a non-ffmpeg error message", () => {
    const mapped: Error = mapHlsPlayError(new Error("player exploded"));
    expect(mapped.message).toBe("player exploded");
  });
});

describe("mapHttpPlayError", () => {
  test("maps a missing ffmpeg spawn error to the stream message", () => {
    const mapped: Error = mapHttpPlayError(
      new Error("FFmpeg/avconv not found!"),
    );
    expect(mapped.message).toBe(
      "Couldn't play that stream: ffmpeg is not installed.",
    );
  });

  test("keeps the SoundCloud string on the HLS mapper", () => {
    const mapped: Error = mapHlsPlayError(
      new Error("FFmpeg/avconv not found!"),
    );
    expect(mapped.message).toBe(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
  });
});
