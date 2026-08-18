import type { Track } from "./track.ts";

/**
 * Per-guild FIFO of tracks waiting to play. Pure state; no I/O.
 */
export class TrackQueue {
  readonly #tracks: Track[] = [];

  /**
   * Appends a track at the end of the queue.
   * @param track - Track to enqueue.
   */
  enqueue(track: Track): void {
    this.#tracks.push(track);
  }

  /**
   * Removes and returns the next track, or `null` when empty.
   * @returns The next track, or `null`.
   */
  dequeueNext(): Track | null {
    const next: Track | undefined = this.#tracks.shift();
    return next ?? null;
  }

  /**
   * Returns a shallow copy of the queued tracks in FIFO order.
   * @returns Copy of the queue contents.
   */
  list(): readonly Track[] {
    return [...this.#tracks];
  }

  /**
   * Number of tracks waiting to play.
   * @returns Queue length.
   */
  get size(): number {
    return this.#tracks.length;
  }
}
