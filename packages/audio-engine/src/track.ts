/** Closed set of audio formats the engine can yield. Grows only when a real source needs a new member. */
export const audioFormats = ["webm/opus", "hls/aac"] as const;
export type AudioFormat = (typeof audioFormats)[number];

/** One playable item resolved from a source. */
export interface Track {
  readonly title: string;
  /** Canonical watch URL; also the handle a source module uses to open audio. */
  readonly uri: string;
  readonly durationSeconds: number;
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
