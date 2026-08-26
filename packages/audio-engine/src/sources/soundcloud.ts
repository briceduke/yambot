import {
  Soundcloud,
  type SoundcloudTrack,
  type SoundcloudTranscoding,
} from "soundcloud.ts";

import { TrackResolveError, type Track, type TrackAudio } from "../track.ts";

const PLAYLIST_UNSUPPORTED =
  "Playlists are not supported yet. Use a track URL or search words.";
const NO_SEARCH_HIT = "No SoundCloud results for that search.";
const NO_PLAYABLE_AUDIO = "That track has no playable audio.";
const PLAY_FAILED = "Couldn't play that SoundCloud track.";

export interface SoundCloudTrackUrlQuery {
  readonly kind: "track-url";
  readonly url: string;
}

export interface SoundCloudSearchQuery {
  readonly kind: "search";
  readonly query: string;
}

export interface SoundCloudClient {
  getTrack(url: string): Promise<{
    readonly title: string;
    readonly durationSeconds: number;
    readonly permalinkUrl: string;
    readonly kind: "track" | "playlist" | "other";
    readonly hasHlsAudio: boolean;
  }>;
  searchFirstTrackUrl(query: string): Promise<string | null>;
  openHlsAudio(permalinkUrl: string): Promise<ReadableStream<Uint8Array>>;
}

let defaultClient: SoundCloudClient | undefined;

/**
 * Classifies a play query as a SoundCloud track URL or search words.
 * @param query - Raw URL or search words.
 * @returns Track URL or search payload.
 */
export function parseSoundCloudQuery(
  query: string,
): SoundCloudTrackUrlQuery | SoundCloudSearchQuery {
  const trimmed: string = query.trim();
  if (!URL.canParse(trimmed)) {
    return { kind: "search", query: trimmed };
  }
  const url: URL = new URL(trimmed);
  if (!isSoundCloudHost(url.hostname)) {
    return { kind: "search", query: trimmed };
  }
  if (url.pathname.includes("/sets/")) {
    throw new TrackResolveError(PLAYLIST_UNSUPPORTED);
  }
  return { kind: "track-url", url: trimmed };
}

/**
 * Resolves a query to one playable track using a SoundCloud client seam.
 * @param input - Query to resolve.
 * @param client - Testable SoundCloud wrapper.
 * @returns One track.
 */
export async function resolveSoundCloudTrackWithClient(
  input: { readonly query: string },
  client: SoundCloudClient,
): Promise<Track> {
  const parsed = parseSoundCloudQuery(input.query);
  const url: string = await resolveTrackUrlAsync(parsed, client);
  const track = await fetchTrackAsync(client, url);
  if (track.kind !== "track") {
    throw new TrackResolveError(PLAYLIST_UNSUPPORTED);
  }
  if (!track.hasHlsAudio) {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  return {
    title: track.title,
    uri: track.permalinkUrl,
    durationSeconds: track.durationSeconds,
  };
}

/**
 * Opens HLS audio for a resolved track using a SoundCloud client seam.
 * @param input - Track whose `uri` is a SoundCloud permalink.
 * @param client - Testable SoundCloud wrapper.
 * @returns Stream and format.
 */
export async function openSoundCloudAudioWithClient(
  input: { readonly track: Track },
  client: SoundCloudClient,
): Promise<TrackAudio> {
  try {
    const stream: ReadableStream<Uint8Array> = await client.openHlsAudio(
      input.track.uri,
    );
    return { stream, format: "hls/aac" };
  } catch (error) {
    throw toResolveError(error);
  }
}

/**
 * Returns the shared default SoundCloud client. Finds a client id itself.
 * @returns Injectable wrapper around `soundcloud.ts`.
 */
export function getDefaultSoundCloudClient(): SoundCloudClient {
  defaultClient ??= wrapSoundcloudLibrary(new Soundcloud());
  return defaultClient;
}

function wrapSoundcloudLibrary(soundcloud: Soundcloud): SoundCloudClient {
  return {
    getTrack: (url) => getTrackFromLibraryAsync(soundcloud, url),
    searchFirstTrackUrl: (query) =>
      searchFirstTrackUrlAsync(soundcloud, query),
    openHlsAudio: (permalinkUrl) =>
      openHlsAudioFromLibraryAsync(soundcloud, permalinkUrl),
  };
}

async function getTrackFromLibraryAsync(
  soundcloud: Soundcloud,
  url: string,
): Promise<{
  readonly title: string;
  readonly durationSeconds: number;
  readonly permalinkUrl: string;
  readonly kind: "track" | "playlist" | "other";
  readonly hasHlsAudio: boolean;
}> {
  try {
    const apiTrack: SoundcloudTrack = await soundcloud.tracks.get(url);
    return {
      title: apiTrack.title ?? "",
      durationSeconds: durationSecondsFromMs(apiTrack.duration),
      permalinkUrl: apiTrack.permalink_url,
      kind: mapKind(apiTrack.kind),
      hasHlsAudio: hasHlsTranscoding(apiTrack),
    };
  } catch (error) {
    throw toResolveError(error);
  }
}

async function searchFirstTrackUrlAsync(
  soundcloud: Soundcloud,
  query: string,
): Promise<string | null> {
  try {
    const search = await soundcloud.tracks.search({ q: query });
    const first: SoundcloudTrack | undefined = search.collection[0];
    if (first === undefined) {
      return null;
    }
    const permalinkUrl: string | undefined = first.permalink_url;
    if (permalinkUrl === undefined || permalinkUrl === "") {
      return null;
    }
    return permalinkUrl;
  } catch (error) {
    throw toResolveError(error);
  }
}

async function openHlsAudioFromLibraryAsync(
  soundcloud: Soundcloud,
  permalinkUrl: string,
): Promise<ReadableStream<Uint8Array>> {
  try {
    const apiTrack: SoundcloudTrack = await soundcloud.tracks.get(permalinkUrl);
    const transcoding: SoundcloudTranscoding | null =
      pickHlsTranscoding(apiTrack);
    if (transcoding === null) {
      throw new TrackResolveError(NO_PLAYABLE_AUDIO);
    }
    const playlistUrl: string = await resolvePlaylistUrlAsync(
      soundcloud,
      transcoding.url,
    );
    const playlistText: string = await fetchTextAsync(
      playlistUrl,
      soundcloud.api.headers,
    );
    const segmentUrls: readonly string[] = parseM3u8SegmentUrls(playlistText);
    if (segmentUrls.length === 0) {
      throw new TrackResolveError(NO_PLAYABLE_AUDIO);
    }
    return createHlsSegmentStream(segmentUrls, soundcloud.api.headers);
  } catch (error) {
    throw toResolveError(error);
  }
}

async function resolvePlaylistUrlAsync(
  soundcloud: Soundcloud,
  transcodingUrl: string,
): Promise<string> {
  const clientId: string | undefined = await soundcloud.api.getClientId();
  if (clientId === undefined || clientId === "") {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  const connector: string = transcodingUrl.includes("?")
    ? `&client_id=${clientId}`
    : `?client_id=${clientId}`;
  const response: Response = await fetch(transcodingUrl + connector, {
    headers: soundcloud.api.headers,
  });
  if (!response.ok) {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("url" in body)) {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  const playlistUrl: unknown = body.url;
  if (typeof playlistUrl !== "string" || playlistUrl === "") {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  return playlistUrl;
}

async function fetchTextAsync(
  url: string,
  headers: { readonly [key: string]: string },
): Promise<string> {
  const response: Response = await fetch(url, { headers });
  if (!response.ok) {
    throw new TrackResolveError(NO_PLAYABLE_AUDIO);
  }
  return await response.text();
}

function createHlsSegmentStream(
  segmentUrls: readonly string[],
  headers: { readonly [key: string]: string },
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        for (const segmentUrl of segmentUrls) {
          const response: Response = await fetch(segmentUrl, { headers });
          if (!response.ok) {
            throw new TrackResolveError(NO_PLAYABLE_AUDIO);
          }
          const body: Uint8Array = new Uint8Array(await response.arrayBuffer());
          controller.enqueue(body);
        }
        controller.close();
      } catch (error) {
        controller.error(toResolveError(error));
      }
    },
  });
}

function parseM3u8SegmentUrls(playlistText: string): readonly string[] {
  const urls: string[] = [];
  for (const rawLine of playlistText.split(/\r?\n/)) {
    const line: string = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    if (URL.canParse(line)) {
      urls.push(line);
    }
  }
  return urls;
}

function pickHlsTranscoding(
  track: SoundcloudTrack,
): SoundcloudTranscoding | null {
  const transcodings: readonly SoundcloudTranscoding[] =
    track.media?.transcodings ?? [];
  const hls: readonly SoundcloudTranscoding[] = transcodings.filter(
    (item) => item.format.protocol === "hls",
  );
  const aac: SoundcloudTranscoding | undefined = hls.find((item) =>
    item.format.mime_type.startsWith("audio/mp4"),
  );
  if (aac !== undefined) {
    return aac;
  }
  const mpeg: SoundcloudTranscoding | undefined = hls.find((item) =>
    item.format.mime_type.startsWith("audio/mpeg"),
  );
  return mpeg ?? null;
}

function hasHlsTranscoding(track: SoundcloudTrack): boolean {
  return pickHlsTranscoding(track) !== null;
}

function mapKind(kind: string): "track" | "playlist" | "other" {
  if (kind === "track") {
    return "track";
  }
  if (kind === "playlist") {
    return "playlist";
  }
  return "other";
}

function durationSecondsFromMs(durationMs: number | undefined): number {
  if (typeof durationMs !== "number" || Number.isNaN(durationMs)) {
    return 0;
  }
  return Math.floor(durationMs / 1000);
}

async function resolveTrackUrlAsync(
  parsed: SoundCloudTrackUrlQuery | SoundCloudSearchQuery,
  client: SoundCloudClient,
): Promise<string> {
  if (parsed.kind === "track-url") {
    return parsed.url;
  }
  try {
    const url: string | null = await client.searchFirstTrackUrl(parsed.query);
    if (url === null) {
      throw new TrackResolveError(NO_SEARCH_HIT);
    }
    return url;
  } catch (error) {
    throw toResolveError(error);
  }
}

async function fetchTrackAsync(
  client: SoundCloudClient,
  url: string,
): Promise<{
  readonly title: string;
  readonly durationSeconds: number;
  readonly permalinkUrl: string;
  readonly kind: "track" | "playlist" | "other";
  readonly hasHlsAudio: boolean;
}> {
  try {
    return await client.getTrack(url);
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

function isSoundCloudHost(hostname: string): boolean {
  return (
    hostname === "soundcloud.com" ||
    hostname.endsWith(".soundcloud.com") ||
    hostname === "snd.sc"
  );
}
