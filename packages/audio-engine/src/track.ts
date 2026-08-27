/** Closed set of audio formats the engine can yield. Grows only when a real source needs a new member. */
export const audioFormats = ["webm/opus", "hls/aac", "http/mpeg"] as const;
export type AudioFormat = (typeof audioFormats)[number];

/** Maximum playable tracks kept from one playlist URL. */
export const MAX_PLAYLIST_TRACKS = 1000;

/** One playable item resolved from a source. */
export interface Track {
  readonly title: string;
  /** Canonical watch URL; also the handle a source module uses to open audio. */
  readonly uri: string;
  readonly durationSeconds: number;
}

/** Result of resolve: one track, a playlist, or a live stream (length 1). */
export interface ResolveResult {
  readonly tracks: readonly Track[];
  readonly playlistTitle: string | null;
  readonly truncated: boolean;
}

/**
 * Wraps a single track as a resolve result.
 * @param track - The resolved track.
 * @returns One-track result with no playlist title.
 */
export function oneTrackResult(track: Track): ResolveResult {
  return { tracks: [track], playlistTitle: null, truncated: false };
}

/**
 * Builds a playlist resolve result, capped at `MAX_PLAYLIST_TRACKS`.
 * @param title - Playlist title; empty becomes `"playlist"`.
 * @param tracks - Playable tracks in list order.
 * @returns Capped playlist result.
 */
export function playlistResult(
  title: string,
  tracks: readonly Track[],
): ResolveResult {
  const truncated: boolean = tracks.length > MAX_PLAYLIST_TRACKS;
  const kept: readonly Track[] = truncated
    ? tracks.slice(0, MAX_PLAYLIST_TRACKS)
    : tracks;
  return {
    tracks: kept,
    playlistTitle: title === "" ? "playlist" : title,
    truncated,
  };
}

/** Open audio for one track. */
export interface TrackAudio {
  readonly stream: ReadableStream<Uint8Array>;
  readonly format: AudioFormat;
}

/**
 * A query cannot become a playable track. Message is safe to show users.
 */
export class TrackResolveError extends Error {}
