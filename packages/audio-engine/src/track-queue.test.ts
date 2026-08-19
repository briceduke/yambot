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

  test("removeAt returns the track and shifts the rest", () => {
    const queue = new TrackQueue();
    const a = sampleTrack("a");
    const b = sampleTrack("b");
    const c = sampleTrack("c");
    queue.enqueue(a);
    queue.enqueue(b);
    queue.enqueue(c);

    expect(queue.removeAt(1)).toBe(b);
    expect(queue.list()).toEqual([a, c]);
    expect(queue.size).toBe(2);
  });

  test("removeAt returns null and leaves the list unchanged when out of range", () => {
    const queue = new TrackQueue();
    const first = sampleTrack("one");
    const second = sampleTrack("two");
    queue.enqueue(first);
    queue.enqueue(second);

    expect(queue.removeAt(-1)).toBeNull();
    expect(queue.list()).toEqual([first, second]);

    expect(queue.removeAt(5)).toBeNull();
    expect(queue.list()).toEqual([first, second]);
    expect(queue.size).toBe(2);

    const empty = new TrackQueue();
    expect(empty.removeAt(0)).toBeNull();
    expect(empty.list()).toEqual([]);
    expect(empty.size).toBe(0);
  });

  test("shuffle keeps size and membership", () => {
    const queue = new TrackQueue();
    queue.enqueue(sampleTrack("a"));
    queue.enqueue(sampleTrack("b"));
    queue.enqueue(sampleTrack("c"));

    queue.shuffle();
    expect(queue.size).toBe(3);
    const titles: string[] = queue.list().map((track: Track) => track.title);
    expect(titles.sort()).toEqual(["a", "b", "c"]);
  });

  test("shuffle on empty and on one track does not throw", () => {
    const empty = new TrackQueue();
    empty.shuffle();
    expect(empty.size).toBe(0);

    const single = new TrackQueue();
    const only = sampleTrack("only");
    single.enqueue(only);
    single.shuffle();
    expect(single.list()).toEqual([only]);
  });

  test("clear empties the queue and enqueue still works", () => {
    const queue = new TrackQueue();
    queue.enqueue(sampleTrack("a"));
    queue.enqueue(sampleTrack("b"));

    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.list()).toEqual([]);

    const after = sampleTrack("after");
    queue.enqueue(after);
    expect(queue.list()).toEqual([after]);
    expect(queue.size).toBe(1);
  });
});
