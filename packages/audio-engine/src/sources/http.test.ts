import { describe, expect, test } from "bun:test";

import { TrackResolveError } from "../track.ts";
import {
  NOT_HTTP_STREAM,
  openHttpAudioWithClient,
  parseHttpQuery,
  resolveHttpStreamWithClient,
  type HttpStreamClient,
} from "./http.ts";

const MP3_URL = "https://radio.example.com/stream.mp3";
const PAGE_URL = "https://example.com";

function createFakeStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

function createClient(
  overrides: Partial<HttpStreamClient> = {},
): HttpStreamClient {
  return {
    async probe() {
      return { isAudio: false, contentType: "text/html", icyName: null };
    },
    async openBody() {
      return createFakeStream();
    },
    ...overrides,
  };
}

describe("parseHttpQuery", () => {
  test("classifies a non-YouTube HTTP URL", () => {
    expect(parseHttpQuery(PAGE_URL)).toEqual({
      kind: "http-url",
      url: PAGE_URL,
    });
  });

  test("returns null for a YouTube URL", () => {
    expect(
      parseHttpQuery("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
  });

  test("returns null for search words", () => {
    expect(parseHttpQuery("never gonna give you up")).toBeNull();
  });
});

describe("resolveHttpStreamWithClient", () => {
  test("resolves an audio-extension URL as a stream without probing", async () => {
    const result = await resolveHttpStreamWithClient(
      { query: MP3_URL },
      createClient({
        async probe() {
          throw new Error("probe should not run for audio extensions");
        },
      }),
    );
    expect(result).toEqual({
      tracks: [
        {
          title: "stream",
          uri: MP3_URL,
          durationSeconds: 0,
        },
      ],
      playlistTitle: null,
      truncated: false,
    });
  });

  test("throws NOT_HTTP_STREAM when probe is not audio", async () => {
    const error = await resolveHttpStreamWithClient(
      { query: PAGE_URL },
      createClient(),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(NOT_HTTP_STREAM);
  });

  test("uses icy-name when probe says audio", async () => {
    const result = await resolveHttpStreamWithClient(
      { query: "https://radio.example.com/live" },
      createClient({
        async probe() {
          return {
            isAudio: true,
            contentType: "audio/mpeg",
            icyName: "Campus Radio",
          };
        },
      }),
    );
    expect(result.tracks[0]).toEqual({
      title: "Campus Radio",
      uri: "https://radio.example.com/live",
      durationSeconds: 0,
    });
  });
});

describe("openHttpAudioWithClient", () => {
  test("yields http/mpeg and the fake body stream", async () => {
    const stream = createFakeStream();
    const audio = await openHttpAudioWithClient(
      {
        track: {
          title: "stream",
          uri: MP3_URL,
          durationSeconds: 0,
        },
      },
      createClient({
        async openBody(url) {
          expect(url).toBe(MP3_URL);
          return stream;
        },
      }),
    );
    expect(audio.format).toBe("http/mpeg");
    expect(audio.stream).toBe(stream);
  });
});
