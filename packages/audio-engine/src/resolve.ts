import { TrackResolveError, type ResolveResult, type Track, type TrackAudio } from "./track.ts";
import {
  getDefaultHttpStreamClient,
  NOT_HTTP_STREAM,
  openHttpAudioWithClient,
  resolveHttpStreamWithClient,
  type HttpStreamClient,
} from "./sources/http.ts";
import {
  getDefaultSoundCloudClient,
  openSoundCloudAudioWithClient,
  resolveSoundCloudTrackWithClient,
  type SoundCloudClient,
} from "./sources/soundcloud.ts";
import {
  getDefaultYoutubeClientAsync,
  openTrackAudioWithClient,
  resolveTrackWithClient,
  type YoutubeClient,
} from "./sources/youtube.ts";

const NOT_SOUNDCLOUD = "That is not a SoundCloud track.";
const PLAY_FAILED = "Couldn't play that track.";

export interface ResolveClients {
  readonly youtube: YoutubeClient;
  readonly soundcloud: SoundCloudClient;
  readonly http: HttpStreamClient;
}

export interface ResolveTrackInput {
  readonly query: string;
  readonly source?: "soundcloud";
}

/**
 * Chooses the source module for a resolve query.
 * @param input - Query and optional SoundCloud hint.
 * @returns Source name.
 */
export function pickSource(
  input: ResolveTrackInput,
): "youtube" | "soundcloud" | "http" {
  const trimmed: string = input.query.trim();
  if (input.source === "soundcloud") {
    if (isYoutubeUrl(trimmed)) {
      throw new TrackResolveError(NOT_SOUNDCLOUD);
    }
    return "soundcloud";
  }
  if (isSoundCloudUrl(trimmed)) {
    return "soundcloud";
  }
  if (isYoutubeUrl(trimmed)) {
    return "youtube";
  }
  if (isHttpUrl(trimmed)) {
    return "http";
  }
  return "youtube";
}

/**
 * Resolves a query with injected source clients.
 * @param input - Query and optional SoundCloud hint.
 * @param clients - Testable source clients.
 * @returns One track or a playlist of tracks.
 */
export async function resolveTrackWithClients(
  input: ResolveTrackInput,
  clients: ResolveClients,
): Promise<ResolveResult> {
  const source: "youtube" | "soundcloud" | "http" = pickSource(input);
  if (source === "soundcloud") {
    return resolveSoundCloudTrackWithClient(
      { query: input.query },
      clients.soundcloud,
    );
  }
  if (source === "http") {
    return resolveHttpOrYoutubeAsync(input, clients);
  }
  return resolveTrackWithClient({ query: input.query }, clients.youtube);
}

async function resolveHttpOrYoutubeAsync(
  input: ResolveTrackInput,
  clients: ResolveClients,
): Promise<ResolveResult> {
  try {
    return await resolveHttpStreamWithClient(
      { query: input.query },
      clients.http,
    );
  } catch (error) {
    if (isNotHttpStream(error)) {
      return resolveTrackWithClient({ query: input.query }, clients.youtube);
    }
    throw error;
  }
}

/**
 * Opens audio with injected source clients.
 * @param input - Track whose uri selects the source.
 * @param clients - Testable source clients.
 * @returns Stream and format.
 */
export async function openTrackAudioWithClients(
  input: { readonly track: Track },
  clients: ResolveClients,
): Promise<TrackAudio> {
  const source: "youtube" | "soundcloud" | "http" = pickSourceForUri(
    input.track.uri,
  );
  if (source === "soundcloud") {
    return openSoundCloudAudioWithClient(input, clients.soundcloud);
  }
  if (source === "http") {
    return openHttpAudioWithClient(input, clients.http);
  }
  return openTrackAudioWithClient(input, clients.youtube);
}

/**
 * Resolves a URL or search into one track.
 * @param input - Query and optional SoundCloud hint.
 * @returns One track or a playlist of tracks.
 */
export async function resolveTrack(
  input: ResolveTrackInput,
): Promise<ResolveResult> {
  return resolveTrackWithClients(input, {
    youtube: await getDefaultYoutubeClientAsync(),
    soundcloud: getDefaultSoundCloudClient(),
    http: getDefaultHttpStreamClient(),
  });
}

/**
 * Opens audio for one resolved track.
 * @param input - Track to open.
 * @returns Stream and format.
 */
export async function openTrackAudio(input: {
  readonly track: Track;
}): Promise<TrackAudio> {
  return openTrackAudioWithClients(input, {
    youtube: await getDefaultYoutubeClientAsync(),
    soundcloud: getDefaultSoundCloudClient(),
    http: getDefaultHttpStreamClient(),
  });
}

function pickSourceForUri(uri: string): "youtube" | "soundcloud" | "http" {
  if (isSoundCloudUrl(uri)) {
    return "soundcloud";
  }
  if (isYoutubeUrl(uri)) {
    return "youtube";
  }
  if (isHttpUrl(uri)) {
    return "http";
  }
  throw new TrackResolveError(PLAY_FAILED);
}

function isNotHttpStream(error: unknown): boolean {
  return error instanceof TrackResolveError && error.message === NOT_HTTP_STREAM;
}

function isHttpUrl(query: string): boolean {
  if (!URL.canParse(query)) {
    return false;
  }
  const protocol: string = new URL(query).protocol;
  return protocol === "http:" || protocol === "https:";
}

function isSoundCloudUrl(query: string): boolean {
  if (!URL.canParse(query)) {
    return false;
  }
  const hostname: string = new URL(query).hostname;
  return (
    hostname === "soundcloud.com" ||
    hostname.endsWith(".soundcloud.com") ||
    hostname === "snd.sc"
  );
}

function isYoutubeUrl(query: string): boolean {
  if (!URL.canParse(query)) {
    return false;
  }
  const hostname: string = new URL(query).hostname;
  return hostname === "youtu.be" || hostname.endsWith("youtube.com");
}
