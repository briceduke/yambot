import { TrackResolveError, type ResolveResult, type Track, type TrackAudio } from "./track.ts";
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
): "youtube" | "soundcloud" {
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
  return "youtube";
}

/**
 * Resolves a query with injected YouTube and SoundCloud clients.
 * @param input - Query and optional SoundCloud hint.
 * @param clients - Testable source clients.
 * @returns One track or a playlist of tracks.
 */
export async function resolveTrackWithClients(
  input: ResolveTrackInput,
  clients: ResolveClients,
): Promise<ResolveResult> {
  const source: "youtube" | "soundcloud" = pickSource(input);
  if (source === "soundcloud") {
    return resolveSoundCloudTrackWithClient(
      { query: input.query },
      clients.soundcloud,
    );
  }
  return resolveTrackWithClient({ query: input.query }, clients.youtube);
}

/**
 * Opens audio with injected YouTube and SoundCloud clients.
 * @param input - Track whose uri selects the source.
 * @param clients - Testable source clients.
 * @returns Stream and format.
 */
export async function openTrackAudioWithClients(
  input: { readonly track: Track },
  clients: ResolveClients,
): Promise<TrackAudio> {
  const source: "youtube" | "soundcloud" = pickSourceForUri(input.track.uri);
  if (source === "soundcloud") {
    return openSoundCloudAudioWithClient(input, clients.soundcloud);
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
  });
}

function pickSourceForUri(uri: string): "youtube" | "soundcloud" {
  if (isSoundCloudUrl(uri)) {
    return "soundcloud";
  }
  if (isYoutubeUrl(uri)) {
    return "youtube";
  }
  throw new TrackResolveError(PLAY_FAILED);
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
