import { Innertube } from "youtubei.js";

import {
  MAX_PLAYLIST_TRACKS,
  TrackQueue,
  type Track,
} from "../index.ts";
import {
  openTrackAudioWithClients,
  resolveTrackWithClients,
  type ResolveClients,
} from "../resolve.ts";
import type { HttpStreamClient } from "../sources/http.ts";
import type { SoundCloudClient } from "../sources/soundcloud.ts";
import {
  createYoutubeClientFromInnertube,
  type YoutubeClient,
} from "../sources/youtube.ts";
import {
  bytesToMb,
  sleepAsync,
  timeManyAsync,
  type SampleSummary,
} from "./stats.ts";

const VIDEO_ID = "dQw4w9WgXcQ";
const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const SEARCH_QUERY = "never gonna give you up";
const SOUNDCLOUD_URL = "https://soundcloud.com/artist/track";
const SOUNDCLOUD_PERMALINK = "https://soundcloud.com/artist/canonical-track";
const GET_BASIC_INFO_DELAY_MS = 30;
const GET_FULL_INFO_DELAY_MS = 60;
const DOWNLOAD_DELAY_MS = 30;
const DEFAULT_N = 10;
const MEMORY_TRACK_COUNT = 50;

export interface EngineBenchReport {
  readonly mode: "offline";
  readonly n: number;
  readonly resolve_ms: {
    readonly youtube_url: SampleSummary;
    readonly youtube_search: SampleSummary;
    readonly soundcloud_url: SampleSummary;
  };
  readonly open_audio_ms: {
    readonly youtube: SampleSummary;
    readonly soundcloud: SampleSummary;
  };
  readonly youtube_resolve_then_open_ms: SampleSummary;
  readonly playlist_enqueue_ms: SampleSummary;
  readonly rss_mb: number;
  readonly heap_mb: number;
}

/**
 * Runs the offline audio-engine bench. No Java. No live YouTube.
 * @param n - Repeats per timed metric (default 10).
 * @returns Machine-readable report.
 */
export async function runEngineBench(
  n: number = DEFAULT_N,
): Promise<EngineBenchReport> {
  const clients: ResolveClients = createOfflineClients();
  const innertubeYoutube: YoutubeClient = createYoutubeClientFromInnertube(
    createFakeInnertube() as unknown as Innertube,
  );
  const innertubeClients: ResolveClients = {
    ...clients,
    youtube: innertubeYoutube,
  };
  const youtubeUrl: SampleSummary = await timeManyAsync(n, async () => {
    await resolveTrackWithClients({ query: WATCH_URL }, innertubeClients);
  });
  const youtubeSearch: SampleSummary = await timeManyAsync(n, async () => {
    await resolveTrackWithClients({ query: SEARCH_QUERY }, innertubeClients);
  });
  const soundcloudUrl: SampleSummary = await timeManyAsync(n, async () => {
    await resolveTrackWithClients({ query: SOUNDCLOUD_URL }, clients);
  });
  const youtubeOpen: SampleSummary = await timeOpenAudioAsync(
    n,
    {
      ...clients,
      youtube: createYoutubeClientFromInnertube(
        createFakeInnertube() as unknown as Innertube,
      ),
    },
    youtubeTrack(),
  );
  const soundcloudOpen: SampleSummary = await timeOpenAudioAsync(
    n,
    clients,
    soundcloudTrack(),
  );
  const resolveThenOpen: SampleSummary = await timeManyAsync(n, async () => {
    const resolved = await resolveTrackWithClients(
      { query: WATCH_URL },
      innertubeClients,
    );
    const track: Track | undefined = resolved.tracks[0];
    if (track === undefined) {
      throw new Error("expected a YouTube track");
    }
    await readFirstByteAsync(
      await openTrackAudioWithClients({ track }, innertubeClients),
    );
  });
  const playlistEnqueue: SampleSummary = await timeManyAsync(n, async () => {
    await enqueuePlaylistAsync(clients);
  });
  await resolveAndOpenManyAsync(innertubeClients, MEMORY_TRACK_COUNT);
  const memory = process.memoryUsage();
  return {
    mode: "offline",
    n,
    resolve_ms: {
      youtube_url: youtubeUrl,
      youtube_search: youtubeSearch,
      soundcloud_url: soundcloudUrl,
    },
    open_audio_ms: {
      youtube: youtubeOpen,
      soundcloud: soundcloudOpen,
    },
    youtube_resolve_then_open_ms: resolveThenOpen,
    playlist_enqueue_ms: playlistEnqueue,
    rss_mb: bytesToMb(memory.rss),
    heap_mb: bytesToMb(memory.heapUsed),
  };
}

async function timeOpenAudioAsync(
  n: number,
  clients: ResolveClients,
  track: Track,
): Promise<SampleSummary> {
  return timeManyAsync(n, async () => {
    await readFirstByteAsync(
      await openTrackAudioWithClients({ track }, clients),
    );
  });
}

async function readFirstByteAsync(audio: {
  readonly stream: ReadableStream<Uint8Array>;
}): Promise<void> {
  const reader = audio.stream.getReader();
  try {
    await reader.read();
  } finally {
    await reader.cancel();
  }
}

async function enqueuePlaylistAsync(clients: ResolveClients): Promise<void> {
  const playlistUrl =
    "https://www.youtube.com/playlist?list=PLbench000000000000000000000000";
  const resolved = await resolveTrackWithClients(
    { query: playlistUrl },
    clients,
  );
  const queue = new TrackQueue();
  for (const track of resolved.tracks) {
    queue.enqueue(track);
  }
  if (queue.size !== MAX_PLAYLIST_TRACKS) {
    throw new Error(`expected ${MAX_PLAYLIST_TRACKS} queued tracks`);
  }
}

async function resolveAndOpenManyAsync(
  clients: ResolveClients,
  count: number,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const resolved = await resolveTrackWithClients(
      { query: WATCH_URL },
      clients,
    );
    const track: Track | undefined = resolved.tracks[0];
    if (track === undefined) {
      throw new Error("expected a YouTube track");
    }
    await readFirstByteAsync(
      await openTrackAudioWithClients({ track }, clients),
    );
  }
}

function createOfflineClients(): ResolveClients {
  return {
    youtube: createFakeYoutubeClient(),
    soundcloud: createFakeSoundCloudClient(),
    http: createFakeHttpClient(),
  };
}

function createFakeYoutubeClient(): YoutubeClient {
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
      return {
        title: "Bench Mix",
        videos: playlistVideos(),
      };
    },
    async searchFirstVideoId() {
      return VIDEO_ID;
    },
    async openAudioWebm() {
      return createImmediateStream();
    },
  };
}

function createFakeSoundCloudClient(): SoundCloudClient {
  return {
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
      await sleepAsync(5);
      return createImmediateStream();
    },
  };
}

function createFakeHttpClient(): HttpStreamClient {
  return {
    async probe() {
      return { isAudio: true, contentType: "audio/mpeg", icyName: null };
    },
    async openBody() {
      return createImmediateStream();
    },
  };
}

function createFakeInnertube(): {
  getInfo: (videoId: string) => Promise<FakeMediaInfo>;
  getBasicInfo: (videoId: string) => Promise<FakeMediaInfo>;
  download: (videoId: string) => Promise<ReadableStream<Uint8Array>>;
  search: (query: string) => Promise<{ videos: { video_id: string }[] }>;
  getPlaylist: () => Promise<{
    info: { title: string };
    items: unknown[];
    has_continuation: boolean;
  }>;
} {
  return {
    async getInfo(videoId: string) {
      await sleepAsync(GET_FULL_INFO_DELAY_MS);
      return createFakeMedia(videoId);
    },
    async getBasicInfo(videoId: string) {
      await sleepAsync(GET_BASIC_INFO_DELAY_MS);
      return createFakeMedia(videoId);
    },
    async download() {
      await sleepAsync(DOWNLOAD_DELAY_MS);
      return createImmediateStream();
    },
    async search() {
      await sleepAsync(GET_BASIC_INFO_DELAY_MS);
      return { videos: [{ video_id: VIDEO_ID }] };
    },
    async getPlaylist() {
      return {
        info: { title: "Bench Mix" },
        items: [],
        has_continuation: false,
      };
    },
  };
}

interface FakeMediaInfo {
  readonly basic_info: {
    readonly title: string;
    readonly duration: number;
    readonly id: string;
  };
  readonly playability_status: { readonly status: string };
  chooseFormat: () => Record<string, never>;
  download: () => Promise<ReadableStream<Uint8Array>>;
}

function createFakeMedia(videoId: string): FakeMediaInfo {
  return {
    basic_info: {
      title: "Never Gonna Give You Up",
      duration: 213,
      id: videoId,
    },
    playability_status: { status: "OK" },
    chooseFormat: () => ({}),
    async download() {
      return createImmediateStream();
    },
  };
}

function playlistVideos(): readonly {
  readonly videoId: string;
  readonly title: string;
  readonly durationSeconds: number;
  readonly isPlayable: boolean;
}[] {
  return Array.from({ length: MAX_PLAYLIST_TRACKS }, (_, index) => ({
    videoId: padVideoId(index),
    title: `Track ${index}`,
    durationSeconds: 1,
    isPlayable: true,
  }));
}

function padVideoId(index: number): string {
  const raw: string = index.toString().padStart(11, "0");
  return raw.slice(-11);
}

function youtubeTrack(): Track {
  return {
    title: "Never Gonna Give You Up",
    uri: WATCH_URL,
    durationSeconds: 213,
  };
}

function soundcloudTrack(): Track {
  return {
    title: "Lo-Fi Study",
    uri: SOUNDCLOUD_PERMALINK,
    durationSeconds: 180,
  };
}

function createImmediateStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      controller.close();
    },
  });
}
