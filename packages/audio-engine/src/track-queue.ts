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

  /**
   * Removes the track at a 0-based index, or returns `null` if the index is out of range.
   * @param index - 0-based position in the queue.
   * @returns The removed track, or `null`.
   */
  removeAt(index: number): Track | null {
    if (index < 0 || index >= this.#tracks.length) {
      return null;
    }
    const removed: Track[] = this.#tracks.splice(index, 1);
    return removed[0] ?? null;
  }

  /**
   * Reorders upcoming tracks in place. Size and membership stay the same.
   */
  shuffle(): void {
    const tracks: Track[] = this.#tracks;
    for (let i = tracks.length - 1; i > 0; i -= 1) {
      const j: number = Math.floor(Math.random() * (i + 1));
      const left: Track | undefined = tracks[i];
      const right: Track | undefined = tracks[j];
      if (left === undefined || right === undefined) {
        continue;
      }
      tracks[i] = right;
      tracks[j] = left;
    }
  }

  /**
   * Drops every upcoming track.
   */
  clear(): void {
    this.#tracks.length = 0;
  }
}
