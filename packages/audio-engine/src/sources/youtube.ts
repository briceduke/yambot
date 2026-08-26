import { Innertube } from "youtubei.js";

import { TrackResolveError, type Track, type TrackAudio } from "../track.ts";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_UNSUPPORTED =
  "Playlists are not supported yet. Use a video URL or search words.";
const NO_SEARCH_HIT = "No YouTube results for that search.";
const NO_PLAYABLE_AUDIO = "That video has no playable audio.";
const PLAY_FAILED = "Couldn't play that YouTube video.";
// download() defaults quality to 360p, which drops audio-only formats.
// WEB format lists have no stream URLs in youtubei.js v18; VISIONOS still does.
const AUDIO_WEBM_OPUS = {
  type: "audio",
  format: "webm",
  codec: "opus",
  quality: "best",
  client: "VISIONOS",
} as const;

export interface YoutubeVideoIdQuery {
  readonly kind: "video-id";
  readonly videoId: string;
}

export interface YoutubeSearchQuery {
  readonly kind: "search";
  readonly query: string;
}

export interface YoutubeClient {
  getVideo(
    videoId: string,
  ): Promise<{
    readonly title: string;
    readonly durationSeconds: number;
    readonly videoId: string;
    readonly hasWebmOpus: boolean;
  }>;
  searchFirstVideoId(query: string): Promise<string | null>;
  openAudioWebm(videoId: string): Promise<ReadableStream<Uint8Array>>;
}

let defaultClientPromise: Promise<YoutubeClient> | undefined;

/**
 * Classifies a play query as a YouTube video id or a search string.
 * @param query - Raw URL or search words.
 * @returns Video id or search payload.
 */
export function parseYoutubeQuery(
  query: string,
): YoutubeVideoIdQuery | YoutubeSearchQuery {
  const trimmed: string = query.trim();
  if (!URL.canParse(trimmed)) {
    return { kind: "search", query: trimmed };
  }
  const url: URL = new URL(trimmed);
  if (!isYoutubeHost(url.hostname)) {
    return { kind: "search", query: trimmed };
  }
  const videoId: string | null = readYoutubeVideoId(url);
  if (videoId !== null) {
    return { kind: "video-id", videoId };
  }
  if (isPlaylistUrl(url)) {
    throw new TrackResolveError(PLAYLIST_UNSUPPORTED);
  }
  return { kind: "search", query: trimmed };
}

/**
 * Resolves a query to one playable track using a YouTube client seam.
 * @param input - Query to resolve.
 * @param client - Testable InnerTube wrapper.
 * @returns One track.
 */
export async function resolveTrackWithClient(
  input: { readonly query: string },
  client: YoutubeClient,
): Promise<Track> {
  const parsed = parseYoutubeQuery(input.query);
  const videoId: string = await resolveVideoIdAsync(parsed, client);
  const video = await fetchVideoAsync(client, videoId);
  if (!video.hasWebmOpus) {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  return {
    title: video.title,
    uri: canonicalWatchUri(video.videoId),
    durationSeconds: video.durationSeconds,
  };
}

/**
 * Opens webm/opus audio for a resolved track using a YouTube client seam.
 * @param input - Track whose `uri` is a canonical watch URL.
 * @param client - Testable InnerTube wrapper.
 * @returns Stream and format.
 */
export async function openTrackAudioWithClient(
  input: { readonly track: Track },
  client: YoutubeClient,
): Promise<TrackAudio> {
  const parsed = parseYoutubeQuery(input.track.uri);
  if (parsed.kind !== "video-id") {
    throw new TrackResolveError(PLAY_FAILED);
  }
  try {
    const stream: ReadableStream<Uint8Array> = await client.openAudioWebm(
      parsed.videoId,
    );
    return { stream, format: "webm/opus" };
  } catch (error) {
    throw toResolveError(error);
  }
}

/**
 * Returns the shared default YouTube client.
 * @returns Injectable wrapper around InnerTube.
 */
export async function getDefaultYoutubeClientAsync(): Promise<YoutubeClient> {
  defaultClientPromise ??= Innertube.create().then(wrapInnertube);
  return defaultClientPromise;
}

function wrapInnertube(innertube: Innertube): YoutubeClient {
  return {
    getVideo: (videoId) => getVideoFromInnertubeAsync(innertube, videoId),
    searchFirstVideoId: (query) => searchFirstVideoIdAsync(innertube, query),
    openAudioWebm: (videoId) => openAudioWebmAsync(innertube, videoId),
  };
}

async function getVideoFromInnertubeAsync(
  innertube: Innertube,
  videoId: string,
): Promise<{
  readonly title: string;
  readonly durationSeconds: number;
  readonly videoId: string;
  readonly hasWebmOpus: boolean;
}> {
  try {
    const info = await innertube.getInfo(videoId, {
      client: AUDIO_WEBM_OPUS.client,
    });
    if (isUnplayable(info.playability_status?.status)) {
      throw new TrackResolveError(PLAY_FAILED);
    }
    return {
      title: info.basic_info.title ?? "",
      durationSeconds: info.basic_info.duration ?? 0,
      videoId: info.basic_info.id ?? videoId,
      hasWebmOpus: hasWebmOpusFormat(info),
    };
  } catch (error) {
    throw toResolveError(error);
  }
}

async function searchFirstVideoIdAsync(
  innertube: Innertube,
  query: string,
): Promise<string | null> {
  try {
    const search = await innertube.search(query, { type: "video" });
    const first = search.videos[0];
    if (first === undefined || !("video_id" in first)) {
      return null;
    }
    const videoId: unknown = first.video_id;
    if (typeof videoId !== "string" || videoId === "") {
      return null;
    }
    return videoId;
  } catch (error) {
    throw toResolveError(error);
  }
}

async function openAudioWebmAsync(
  innertube: Innertube,
  videoId: string,
): Promise<ReadableStream<Uint8Array>> {
  try {
    return await innertube.download(videoId, AUDIO_WEBM_OPUS);
  } catch (error) {
    throw toResolveError(error);
  }
}

function hasWebmOpusFormat(info: {
  chooseFormat: (options: typeof AUDIO_WEBM_OPUS) => unknown;
}): boolean {
  try {
    info.chooseFormat(AUDIO_WEBM_OPUS);
    return true;
  } catch {
    return false;
  }
}

function isUnplayable(status: string | undefined): boolean {
  return status !== undefined && status !== "OK";
}

async function resolveVideoIdAsync(
  parsed: YoutubeVideoIdQuery | YoutubeSearchQuery,
  client: YoutubeClient,
): Promise<string> {
  if (parsed.kind === "video-id") {
    return parsed.videoId;
  }
  try {
    const videoId: string | null = await client.searchFirstVideoId(
      parsed.query,
    );
    if (videoId === null) {
      throw new TrackResolveError(NO_SEARCH_HIT);
    }
    return videoId;
  } catch (error) {
    throw toResolveError(error);
  }
}

async function fetchVideoAsync(
  client: YoutubeClient,
  videoId: string,
): Promise<{
  readonly title: string;
  readonly durationSeconds: number;
  readonly videoId: string;
  readonly hasWebmOpus: boolean;
}> {
  try {
    return await client.getVideo(videoId);
  } catch (error) {
    throw toResolveError(error);
  }
}

function toResolveError(error: unknown): TrackResolveError {
  if (error instanceof TrackResolveError) {
    return error;
  }
  return new TrackResolveError(PLAY_FAILED);
}

function canonicalWatchUri(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function isYoutubeHost(hostname: string): boolean {
  return hostname === "youtu.be" || hostname.endsWith("youtube.com");
}

function readYoutubeVideoId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    return videoIdOrNull(pathSegments(url)[0]);
  }
  const segments: readonly string[] = pathSegments(url);
  const kind: string | undefined = segments[0];
  if (kind === "shorts" || kind === "embed") {
    return videoIdOrNull(segments[1]);
  }
  return videoIdOrNull(url.searchParams.get("v") ?? undefined);
}

function isPlaylistUrl(url: URL): boolean {
  return pathSegments(url)[0] === "playlist" || url.searchParams.has("list");
}

function pathSegments(url: URL): readonly string[] {
  return url.pathname.split("/").filter((part) => part !== "");
}

function videoIdOrNull(value: string | undefined): string | null {
  if (value === undefined || !VIDEO_ID_PATTERN.test(value)) {
    return null;
  }
  return value;
}
