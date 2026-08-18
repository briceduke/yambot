import { describe, expect, test } from "bun:test";

import { TrackResolveError } from "../track.ts";
import {
  openTrackAudioWithClient,
  parseYoutubeQuery,
  resolveTrackWithClient,
  type YoutubeClient,
} from "./youtube.ts";

const VIDEO_ID = "dQw4w9WgXcQ";
const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const SHORT_URL = `https://youtu.be/${VIDEO_ID}`;

function createFakeStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

function createClient(overrides: Partial<YoutubeClient> = {}): YoutubeClient {
  return {
    async getVideo(videoId) {
      return {
        title: "Never Gonna Give You Up",
        durationSeconds: 213,
        videoId,
        hasWebmOpus: true,
      };
    },
    async searchFirstVideoId() {
      return VIDEO_ID;
    },
    async openAudioWebm() {
      return createFakeStream();
    },
    ...overrides,
  };
}

describe("parseYoutubeQuery", () => {
  test("classifies a watch URL as a video id", () => {
    expect(parseYoutubeQuery(WATCH_URL)).toEqual({
      kind: "video-id",
      videoId: VIDEO_ID,
    });
  });

  test("classifies a youtu.be URL as a video id", () => {
    expect(parseYoutubeQuery(SHORT_URL)).toEqual({
      kind: "video-id",
      videoId: VIDEO_ID,
    });
  });

  test("classifies search words as search", () => {
    expect(parseYoutubeQuery("never gonna give you up")).toEqual({
      kind: "search",
      query: "never gonna give you up",
    });
  });
});

describe("resolveTrackWithClient", () => {
  test("resolves a watch URL through getVideo", async () => {
    const client = createClient();
    const track = await resolveTrackWithClient({ query: WATCH_URL }, client);
    expect(track).toEqual({
      title: "Never Gonna Give You Up",
      uri: WATCH_URL,
      durationSeconds: 213,
    });
  });

  test("plays the top search hit", async () => {
    const track = await resolveTrackWithClient(
      { query: "never gonna give you up" },
      createClient({
        async searchFirstVideoId(query) {
          expect(query).toBe("never gonna give you up");
          return VIDEO_ID;
        },
      }),
    );
    expect(track.uri).toBe(WATCH_URL);
    expect(track.title).toBe("Never Gonna Give You Up");
  });

  test("rejects a video with no webm/opus", async () => {
    const error = await resolveTrackWithClient(
      { query: WATCH_URL },
      createClient({
        async getVideo(videoId) {
          return {
            title: "Silent",
            durationSeconds: 10,
            videoId,
            hasWebmOpus: false,
          };
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "That video has no playable audio.",
    );
  });

  test("maps no search hit", async () => {
    const error = await resolveTrackWithClient(
      { query: "zzzz-no-results" },
      createClient({
        async searchFirstVideoId() {
          return null;
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "No YouTube results for that search.",
    );
  });

  test("maps other InnerTube failures", async () => {
    const error = await resolveTrackWithClient(
      { query: WATCH_URL },
      createClient({
        async getVideo() {
          throw new Error("private video");
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "Couldn't play that YouTube video.",
    );
  });
});

describe("openTrackAudioWithClient", () => {
  test("yields webm/opus and the fake stream", async () => {
    const stream = createFakeStream();
    const audio = await openTrackAudioWithClient(
      {
        track: {
          title: "Never Gonna Give You Up",
          uri: WATCH_URL,
          durationSeconds: 213,
        },
      },
      createClient({
        async openAudioWebm(videoId) {
          expect(videoId).toBe(VIDEO_ID);
          return stream;
        },
      }),
    );
    expect(audio.format).toBe("webm/opus");
    expect(audio.stream).toBe(stream);
  });
});
