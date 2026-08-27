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
    async getPlaylist() {
      return { title: "unused", tracks: [] };
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

  test("classifies a /sets/ URL as a playlist-url", () => {
    expect(parseSoundCloudQuery(SET_URL)).toEqual({
      kind: "playlist-url",
      url: SET_URL,
    });
  });
});

describe("resolveSoundCloudTrackWithClient", () => {
  test("resolves a track URL through getTrack", async () => {
    const result = await resolveSoundCloudTrackWithClient(
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
    expect(result).toEqual({
      tracks: [
        {
          title: "Lo-Fi Study",
          uri: PERMALINK_URL,
          durationSeconds: 180,
        },
      ],
      playlistTitle: null,
      truncated: false,
    });
  });

  test("plays the top search hit", async () => {
    const result = await resolveSoundCloudTrackWithClient(
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
    expect(result.tracks[0]?.uri).toBe(PERMALINK_URL);
    expect(result.tracks[0]?.title).toBe("Lo-Fi Study");
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

  test("expands a set URL through getPlaylist", async () => {
    const result = await resolveSoundCloudTrackWithClient(
      { query: SET_URL },
      createClient({
        async getPlaylist(url) {
          expect(url).toBe(SET_URL);
          return {
            title: "Album",
            tracks: [
              {
                title: "A",
                permalinkUrl: "https://soundcloud.com/artist/a",
                durationSeconds: 10,
                hasHlsAudio: true,
              },
              {
                title: "B",
                permalinkUrl: "https://soundcloud.com/artist/b",
                durationSeconds: 20,
                hasHlsAudio: false,
              },
              {
                title: "C",
                permalinkUrl: "https://soundcloud.com/artist/c",
                durationSeconds: 30,
                hasHlsAudio: true,
              },
            ],
          };
        },
      }),
    );
    expect(result).toEqual({
      playlistTitle: "Album",
      truncated: false,
      tracks: [
        {
          title: "A",
          uri: "https://soundcloud.com/artist/a",
          durationSeconds: 10,
        },
        {
          title: "C",
          uri: "https://soundcloud.com/artist/c",
          durationSeconds: 30,
        },
      ],
    });
  });

  test("follows getTrack kind playlist to getPlaylist", async () => {
    const result = await resolveSoundCloudTrackWithClient(
      { query: SHORT_URL },
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
        async getPlaylist(url) {
          expect(url).toBe(SET_URL);
          return {
            title: "Album",
            tracks: [
              {
                title: "A",
                permalinkUrl: "https://soundcloud.com/artist/a",
                durationSeconds: 10,
                hasHlsAudio: true,
              },
            ],
          };
        },
      }),
    );
    expect(result.tracks).toHaveLength(1);
    expect(result.playlistTitle).toBe("Album");
  });

  test("rejects an empty set", async () => {
    const error = await resolveSoundCloudTrackWithClient(
      { query: SET_URL },
      createClient({
        async getPlaylist() {
          return { title: "Empty", tracks: [] };
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "That playlist has no playable tracks.",
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
