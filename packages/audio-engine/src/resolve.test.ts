import { describe, expect, test } from "bun:test";

import { TrackResolveError } from "./track.ts";
import {
  openTrackAudioWithClients,
  pickSource,
  resolveTrackWithClients,
  type ResolveClients,
} from "./resolve.ts";
import type { SoundCloudClient } from "./sources/soundcloud.ts";
import type { YoutubeClient } from "./sources/youtube.ts";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const SOUNDCLOUD_URL = "https://soundcloud.com/artist/track";
const SOUNDCLOUD_PERMALINK = "https://soundcloud.com/artist/canonical-track";

function createFakeStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

function createClients(
  overrides: {
    readonly youtube?: Partial<YoutubeClient>;
    readonly soundcloud?: Partial<SoundCloudClient>;
  } = {},
): ResolveClients {
  const youtube: YoutubeClient = {
    async getVideo(videoId) {
      return {
        title: "Never Gonna Give You Up",
        durationSeconds: 213,
        videoId,
        hasWebmOpus: true,
      };
    },
    async getPlaylist() {
      return { title: "unused", videos: [] };
    },
    async searchFirstVideoId() {
      return "dQw4w9WgXcQ";
    },
    async openAudioWebm() {
      return createFakeStream();
    },
    ...overrides.youtube,
  };
  const soundcloud: SoundCloudClient = {
    async getTrack() {
      return {
        title: "Lo-Fi Study",
        durationSeconds: 180,
        permalinkUrl: SOUNDCLOUD_PERMALINK,
        kind: "track",
        hasHlsAudio: true,
      };
    },
    async getPlaylist() {
      return { title: "unused", tracks: [] };
    },
    async searchFirstTrackUrl() {
      return SOUNDCLOUD_URL;
    },
    async openHlsAudio() {
      return createFakeStream();
    },
    ...overrides.soundcloud,
  };
  return { youtube, soundcloud };
}

describe("pickSource", () => {
  test("routes a SoundCloud URL to soundcloud", () => {
    expect(pickSource({ query: SOUNDCLOUD_URL })).toBe("soundcloud");
  });

  test("routes a YouTube URL to youtube", () => {
    expect(pickSource({ query: YOUTUBE_URL })).toBe("youtube");
  });

  test("routes bare words to youtube", () => {
    expect(pickSource({ query: "never gonna give you up" })).toBe("youtube");
  });

  test("routes source soundcloud and search words to soundcloud", () => {
    expect(
      pickSource({ query: "lofi beats", source: "soundcloud" }),
    ).toBe("soundcloud");
  });

  test("rejects a YouTube URL when source is soundcloud", () => {
    expect(() =>
      pickSource({ query: YOUTUBE_URL, source: "soundcloud" }),
    ).toThrow(TrackResolveError);
    try {
      pickSource({ query: YOUTUBE_URL, source: "soundcloud" });
    } catch (error) {
      expect(error).toBeInstanceOf(TrackResolveError);
      expect((error as TrackResolveError).message).toBe(
        "That is not a SoundCloud track.",
      );
    }
  });
});

describe("resolveTrackWithClients", () => {
  test("resolves a SoundCloud URL through the SoundCloud client", async () => {
    const track = await resolveTrackWithClients(
      { query: SOUNDCLOUD_URL },
      createClients({
        soundcloud: {
          async getTrack(url) {
            expect(url).toBe(SOUNDCLOUD_URL);
            return {
              title: "Lo-Fi Study",
              durationSeconds: 180,
              permalinkUrl: SOUNDCLOUD_PERMALINK,
              kind: "track",
              hasHlsAudio: true,
            };
          },
        },
      }),
    );
    expect(track).toEqual({
      tracks: [
        {
          title: "Lo-Fi Study",
          uri: SOUNDCLOUD_PERMALINK,
          durationSeconds: 180,
        },
      ],
      playlistTitle: null,
      truncated: false,
    });
  });

  test("resolves a YouTube URL through the YouTube client", async () => {
    const track = await resolveTrackWithClients(
      { query: YOUTUBE_URL },
      createClients(),
    );
    expect(track).toEqual({
      tracks: [
        {
          title: "Never Gonna Give You Up",
          uri: YOUTUBE_URL,
          durationSeconds: 213,
        },
      ],
      playlistTitle: null,
      truncated: false,
    });
  });

  test("resolves bare words through YouTube search", async () => {
    const track = await resolveTrackWithClients(
      { query: "never gonna give you up" },
      createClients(),
    );
    expect(track.tracks[0]?.uri).toBe(YOUTUBE_URL);
  });

  test("rejects a YouTube URL when source is soundcloud", async () => {
    const error = await resolveTrackWithClients(
      { query: YOUTUBE_URL, source: "soundcloud" },
      createClients(),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "That is not a SoundCloud track.",
    );
  });
});

describe("openTrackAudioWithClients", () => {
  test("opens a SoundCloud uri as hls/aac", async () => {
    const stream = createFakeStream();
    const audio = await openTrackAudioWithClients(
      {
        track: {
          title: "Lo-Fi Study",
          uri: SOUNDCLOUD_PERMALINK,
          durationSeconds: 180,
        },
      },
      createClients({
        soundcloud: {
          async openHlsAudio(permalinkUrl) {
            expect(permalinkUrl).toBe(SOUNDCLOUD_PERMALINK);
            return stream;
          },
        },
      }),
    );
    expect(audio.format).toBe("hls/aac");
    expect(audio.stream).toBe(stream);
  });

  test("opens a YouTube uri as webm/opus", async () => {
    const stream = createFakeStream();
    const audio = await openTrackAudioWithClients(
      {
        track: {
          title: "Never Gonna Give You Up",
          uri: YOUTUBE_URL,
          durationSeconds: 213,
        },
      },
      createClients({
        youtube: {
          async openAudioWebm() {
            return stream;
          },
        },
      }),
    );
    expect(audio.format).toBe("webm/opus");
    expect(audio.stream).toBe(stream);
  });

  test("rejects an unknown host", async () => {
    const error = await openTrackAudioWithClients(
      {
        track: {
          title: "Nope",
          uri: "https://example.com/track",
          durationSeconds: 10,
        },
      },
      createClients(),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "Couldn't play that track.",
    );
  });
});
