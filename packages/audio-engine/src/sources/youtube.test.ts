import { describe, expect, test } from "bun:test";

import { TrackResolveError } from "../track.ts";
import {
  openTrackAudioWithClient,
  parseYoutubeQuery,
  playlistVideosFromItems,
  resolveTrackWithClient,
  type YoutubeClient,
} from "./youtube.ts";

const VIDEO_ID = "dQw4w9WgXcQ";
const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const SHORT_URL = `https://youtu.be/${VIDEO_ID}`;
const BRICE_PLAYLIST_ID = "PL8oEkrReXiOLp1N9czSJ6XAu1CvyZWgMB";
const BRICE_PLAYLIST_URL =
  `https://www.youtube.com/playlist?list=${BRICE_PLAYLIST_ID}`;

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
    async getPlaylist() {
      return { title: "unused", videos: [] };
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

  test("classifies a youtu.be URL with si as a video id", () => {
    expect(
      parseYoutubeQuery("https://youtu.be/Stu6m4IrIY8?si=eYTq6K7fJbHpPr7v"),
    ).toEqual({
      kind: "video-id",
      videoId: "Stu6m4IrIY8",
    });
  });

  test("classifies search words as search", () => {
    expect(parseYoutubeQuery("never gonna give you up")).toEqual({
      kind: "search",
      query: "never gonna give you up",
    });
  });

  test("classifies a playlist URL as a playlist id", () => {
    expect(parseYoutubeQuery(BRICE_PLAYLIST_URL)).toEqual({
      kind: "playlist-id",
      playlistId: BRICE_PLAYLIST_ID,
    });
  });

  test("keeps a watch URL with list as a video id", () => {
    expect(
      parseYoutubeQuery(`${WATCH_URL}&list=PLtest`),
    ).toEqual({
      kind: "video-id",
      videoId: VIDEO_ID,
    });
  });

  test("rejects a playlist path with no list", () => {
    expect(() =>
      parseYoutubeQuery("https://www.youtube.com/playlist"),
    ).toThrow(TrackResolveError);
  });
});

describe("resolveTrackWithClient", () => {
  test("resolves a watch URL through getVideo", async () => {
    const client = createClient();
    const result = await resolveTrackWithClient({ query: WATCH_URL }, client);
    expect(result).toEqual({
      tracks: [
        {
          title: "Never Gonna Give You Up",
          uri: WATCH_URL,
          durationSeconds: 213,
        },
      ],
      playlistTitle: null,
      truncated: false,
    });
  });

  test("plays the top search hit", async () => {
    const result = await resolveTrackWithClient(
      { query: "never gonna give you up" },
      createClient({
        async searchFirstVideoId(query) {
          expect(query).toBe("never gonna give you up");
          return VIDEO_ID;
        },
      }),
    );
    expect(result.tracks[0]?.uri).toBe(WATCH_URL);
    expect(result.tracks[0]?.title).toBe("Never Gonna Give You Up");
    expect(result.playlistTitle).toBeNull();
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

  test("expands a /playlist?list= URL into tracks", async () => {
    const result = await resolveTrackWithClient(
      { query: BRICE_PLAYLIST_URL },
      createClient({
        async getPlaylist(playlistId) {
          expect(playlistId).toBe(BRICE_PLAYLIST_ID);
          return {
            title: "Summer Mix",
            videos: [
              {
                videoId: "aaaaaaaaaaa",
                title: "One",
                durationSeconds: 10,
                isPlayable: true,
              },
              {
                videoId: "bbbbbbbbbbb",
                title: "Two",
                durationSeconds: 20,
                isPlayable: true,
              },
              {
                videoId: "ccccccccccc",
                title: "Skip",
                durationSeconds: 30,
                isPlayable: false,
              },
            ],
          };
        },
      }),
    );
    expect(result).toEqual({
      playlistTitle: "Summer Mix",
      truncated: false,
      tracks: [
        {
          title: "One",
          uri: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
          durationSeconds: 10,
        },
        {
          title: "Two",
          uri: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
          durationSeconds: 20,
        },
      ],
    });
  });

  test("rejects an empty playlist", async () => {
    const error = await resolveTrackWithClient(
      { query: "https://www.youtube.com/playlist?list=PLempty" },
      createClient({
        async getPlaylist() {
          return { title: "Empty", videos: [] };
        },
      }),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TrackResolveError);
    expect((error as TrackResolveError).message).toBe(
      "That playlist has no playable tracks.",
    );
  });

  test("caps a playlist at 1000 and marks truncated", async () => {
    const videos = Array.from({ length: 1001 }, (_, index) => ({
      videoId: `id${index.toString().padStart(8, "0")}`,
      title: `Track ${index}`,
      durationSeconds: 1,
      isPlayable: true,
    }));
    const result = await resolveTrackWithClient(
      { query: "https://www.youtube.com/playlist?list=PLlong" },
      createClient({
        async getPlaylist() {
          return { title: "Long", videos };
        },
      }),
    );
    expect(result.tracks).toHaveLength(1000);
    expect(result.truncated).toBe(true);
    expect(result.playlistTitle).toBe("Long");
  });

  test("keeps tracks when every item is marked unplayable", async () => {
    const result = await resolveTrackWithClient(
      { query: BRICE_PLAYLIST_URL },
      createClient({
        async getPlaylist() {
          return {
            title: "Flag Lie",
            videos: [
              {
                videoId: "aaaaaaaaaaa",
                title: "One",
                durationSeconds: 10,
                isPlayable: false,
              },
            ],
          };
        },
      }),
    );
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.title).toBe("One");
    expect(result.playlistTitle).toBe("Flag Lie");
  });
});

describe("playlistVideosFromItems", () => {
  test("maps PlaylistVideo id and Text title", () => {
    expect(
      playlistVideosFromItems([
        {
          id: VIDEO_ID,
          title: { text: "Never Gonna Give You Up" },
          duration: { seconds: 213 },
          is_playable: true,
        },
      ]),
    ).toEqual([
      {
        videoId: VIDEO_ID,
        title: "Never Gonna Give You Up",
        durationSeconds: 213,
        isPlayable: true,
      },
    ]);
  });

  test("maps video_id when id is missing", () => {
    expect(
      playlistVideosFromItems([
        { video_id: VIDEO_ID, title: "Never Gonna Give You Up" },
      ]),
    ).toEqual([
      {
        videoId: VIDEO_ID,
        title: "Never Gonna Give You Up",
        durationSeconds: 0,
        isPlayable: true,
      },
    ]);
  });

  test("maps LockupView content_id and metadata title", () => {
    expect(
      playlistVideosFromItems([
        {
          content_id: VIDEO_ID,
          metadata: { title: { text: "Never Gonna Give You Up" } },
        },
      ]),
    ).toEqual([
      {
        videoId: VIDEO_ID,
        title: "Never Gonna Give You Up",
        durationSeconds: 0,
        isPlayable: true,
      },
    ]);
  });

  test("maps LockupView overlay badge clock text to durationSeconds", () => {
    const mapped = playlistVideosFromItems([
      {
        content_id: VIDEO_ID,
        title: "Never Gonna Give You Up",
        content_image: {
          overlays: [
            { badges: [{ text: "3:45" }] },
          ],
        },
      },
    ]);
    expect(mapped[0]?.durationSeconds).toBe(225);
  });

  test("maps duration.text clock when seconds is missing", () => {
    const mapped = playlistVideosFromItems([
      {
        id: VIDEO_ID,
        title: "Never Gonna Give You Up",
        duration: { text: "3:45" },
      },
    ]);
    expect(mapped[0]?.durationSeconds).toBe(225);
  });

  test("maps length_seconds when duration.seconds is missing", () => {
    const mapped = playlistVideosFromItems([
      {
        id: VIDEO_ID,
        title: "Never Gonna Give You Up",
        length_seconds: 213,
      },
    ]);
    expect(mapped[0]?.durationSeconds).toBe(213);
  });

  test("maps LockupView metadata row clock text to durationSeconds", () => {
    const mapped = playlistVideosFromItems([
      {
        content_id: VIDEO_ID,
        metadata: {
          title: { text: "Never Gonna Give You Up" },
          metadata: {
            metadata_rows: [
              {
                metadata_parts: [
                  { text: { text: "Rick Astley" } },
                  { text: { text: "3:45" } },
                ],
              },
            ],
          },
        },
      },
    ]);
    expect(mapped[0]?.durationSeconds).toBe(225);
  });

  test("treats missing is_playable as playable", () => {
    const mapped = playlistVideosFromItems([
      {
        id: VIDEO_ID,
        title: "Rick",
        duration: { seconds: 213 },
        is_playable: undefined,
      },
    ]);
    expect(mapped[0]?.isPlayable).toBe(true);
  });

  test("throws PLAYLIST_FAILED when items exist but none have a video id", () => {
    expect(() =>
      playlistVideosFromItems([{ title: "no id here" }]),
    ).toThrow(TrackResolveError);
    try {
      playlistVideosFromItems([{ title: "no id here" }]);
    } catch (error) {
      expect(error).toBeInstanceOf(TrackResolveError);
      expect((error as TrackResolveError).message).toBe(
        "Couldn't play that playlist.",
      );
    }
  });

  test("returns an empty list when InnerTube returned no items", () => {
    expect(playlistVideosFromItems([])).toEqual([]);
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
