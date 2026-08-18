import { describe, expect, test } from "bun:test";

import type { Track } from "./track.ts";
import { TrackQueue } from "./track-queue.ts";

function sampleTrack(title: string): Track {
  return {
    title,
    uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    durationSeconds: 213,
  };
}

describe("TrackQueue", () => {
  test("FIFO enqueue, list copy, size, and dequeueNext", () => {
    const queue = new TrackQueue();
    const first = sampleTrack("one");
    const second = sampleTrack("two");

    expect(queue.size).toBe(0);
    expect(queue.dequeueNext()).toBeNull();
    expect(queue.list()).toEqual([]);

    queue.enqueue(first);
    queue.enqueue(second);
    expect(queue.size).toBe(2);

    const listed = queue.list();
    expect(listed).toEqual([first, second]);
    queue.enqueue(sampleTrack("three"));
    expect(listed).toEqual([first, second]);
    expect(queue.size).toBe(3);

    expect(queue.dequeueNext()).toBe(first);
    expect(queue.dequeueNext()).toBe(second);
    expect(queue.dequeueNext()?.title).toBe("three");
    expect(queue.dequeueNext()).toBeNull();
    expect(queue.size).toBe(0);
  });
});
