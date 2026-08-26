import { describe, expect, test } from "bun:test";

import { TrackResolveError } from "../track.ts";
import {
  openSoundCloudAudioWithClient,
  parseSoundCloudQuery,
  resolveSoundCloudTrackWithClient,
  type SoundCloudClient,
} from "./soundcloud.ts";

const TRACK_URL = "https://soundcloud.com/artist/track";
const PERMALINK_URL = "https://soundcloud.com/artist/canonical-track";
const ON_HOST_URL = "https://on.soundcloud.com/abc123";
const SHORT_URL = "https://snd.sc/xyz";
const SET_URL = "https://soundcloud.com/artist/sets/album";

function createFakeStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

function createClient(
  overrides: Partial<SoundCloudClient> = {},
): SoundCloudClient {
  return {
    async getTrack() {
      return {
        title: "Lo-Fi Study",
        durationSeconds: 180,
        permalinkUrl: PERMALINK_URL,
        kind: "track",
        hasHlsAudio: true,
      };
    },
    async searchFirstTrackUrl() {
      return TRACK_URL;
    },
    async openHlsAudio() {
      return createFakeStream();
    },
    ...overrides,
  };
}

describe("parseSoundCloudQuery", () => {
  test("classifies a track URL as a track-url", () => {
    expect(parseSoundCloudQuery(TRACK_URL)).toEqual({
      kind: "track-url",
      url: TRACK_URL,
    });
  });

  test("classifies an on.soundcloud.com URL as a track-url", () => {
    expect(parseSoundCloudQuery(ON_HOST_URL)).toEqual({
      kind: "track-url",
      url: ON_HOST_URL,
    });
  });

  test("classifies a snd.sc URL as a track-url", () => {
    expect(parseSoundCloudQuery(SHORT_URL)).toEqual({
      kind: "track-url",
      url: SHORT_URL,
    });
  });

  test("classifies search words as search", () => {
    expect(parseSoundCloudQuery("lofi beats")).toEqual({
      kind: "search",
      query: "lofi beats",
    });
  });

  test("rejects a /sets/ playlist URL", () => {
    expect(() => parseSoundCloudQuery(SET_URL)).toThrow(TrackResolveError);
    try {
      parseSoundCloudQuery(SET_URL);
    } catch (error) {
      expect(error).toBeInstanceOf(TrackResolveError);
      expect((error as TrackResolveError).message).toBe(
        "Playlists are not supported yet. Use a track URL or search words.",
      );
    }
  });
});

describe("resolveSoundCloudTrackWithClient", () => {
  test("resolves a track URL through getTrack", async () => {
    const track = await resolveSoundCloudTrackWithClient(
      { query: TRACK_URL },
      createClient({
        async getTrack(url) {
          expect(url).toBe(TRACK_URL);
          return {
            title: "Lo-Fi Study",
            durationSeconds: 180,
            permalinkUrl: PERMALINK_URL,
            kind: "track",
            hasHlsAudio: true,
          };
        },
      }),
    );
    expect(track).toEqual({
      title: "Lo-Fi Study",
      uri: PERMALINK_URL,
      durationSeconds: 180,
    });
  });

  test("plays the top search hit", async () => {
    const track = await resolveSoundCloudTrackWithClient(
      { query: "lofi beats" },
      createClient({
        async searchFirstTrackUrl(query) {
          expect(query).toBe("lofi beats");
          return TRACK_URL;
        },
        async getTrack(url) {
          expect(url).toBe(TRACK_URL);
          return {
            title: "Lo-Fi Study",
            durationSeconds: 180,
            permalinkUrl: PERMALINK_URL,
            kind: "track",
            hasHlsAudio: true,
          };
        },
      }),
    );
    expect(track.uri).toBe(PERMALINK_URL);
    expect(track.title).toBe("Lo-Fi Study");
  });

  test("maps no search hit", async () => {
    const error = await resolveSoundCloudTrackWithClient(
      { query: "zzzz-no-results" },
      createClient({
        async searchFirstTrackUrl() {
          return null;
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "No SoundCloud results for that search.",
    );
  });

  test("rejects kind that is not track", async () => {
    const error = await resolveSoundCloudTrackWithClient(
      { query: TRACK_URL },
      createClient({
        async getTrack() {
          return {
            title: "Album",
            durationSeconds: 3600,
            permalinkUrl: SET_URL,
            kind: "playlist",
            hasHlsAudio: true,
          };
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "Playlists are not supported yet. Use a track URL or search words.",
    );
  });

  test("rejects a track with no HLS audio", async () => {
    const error = await resolveSoundCloudTrackWithClient(
      { query: TRACK_URL },
      createClient({
        async getTrack() {
          return {
            title: "Silent",
            durationSeconds: 10,
            permalinkUrl: PERMALINK_URL,
            kind: "track",
            hasHlsAudio: false,
          };
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "That track has no playable audio.",
    );
  });

  test("maps other library failures", async () => {
    const error = await resolveSoundCloudTrackWithClient(
      { query: TRACK_URL },
      createClient({
        async getTrack() {
          throw new Error("private track");
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "Couldn't play that SoundCloud track.",
    );
  });
});

describe("openSoundCloudAudioWithClient", () => {
  test("yields hls/aac and the fake HLS segment stream", async () => {
    const stream = createFakeStream();
    const audio = await openSoundCloudAudioWithClient(
      {
        track: {
          title: "Lo-Fi Study",
          uri: PERMALINK_URL,
          durationSeconds: 180,
        },
      },
      createClient({
        async openHlsAudio(permalinkUrl) {
          expect(permalinkUrl).toBe(PERMALINK_URL);
          return stream;
        },
      }),
    );
    expect(audio.format).toBe("hls/aac");
    expect(audio.stream).toBe(stream);
  });
});
