import {
  AudioPlayerStatus,
  entersState,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice";
import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";

import {
  createPlaybackPlayer,
  createPlaybackResource,
  mapHlsPlayError,
  mapHttpPlayError,
  streamTypeFor,
} from "./discord-voice.ts";

describe("streamTypeFor", () => {
  test("maps webm/opus to StreamType.WebmOpus", () => {
    expect(streamTypeFor("webm/opus")).toBe(StreamType.WebmOpus);
  });

  test("maps hls/aac to StreamType.Arbitrary", () => {
    expect(streamTypeFor("hls/aac")).toBe(StreamType.Arbitrary);
  });

  test("maps http/mpeg to StreamType.Arbitrary", () => {
    expect(streamTypeFor("http/mpeg")).toBe(StreamType.Arbitrary);
  });
});

describe("mapHlsPlayError", () => {
  test("maps a missing ffmpeg spawn error to the pinned message", () => {
    const mapped: Error = mapHlsPlayError(new Error("FFmpeg/avconv not found!"));
    expect(mapped.message).toBe(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
  });

  test("maps ENOENT that mentions ffmpeg to the pinned message", () => {
    const error = new Error("spawn ffmpeg ENOENT") as Error & {
      code: string;
    };
    error.code = "ENOENT";
    const mapped: Error = mapHlsPlayError(error);
    expect(mapped.message).toBe(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
  });

  test("keeps a non-ffmpeg error message", () => {
    const mapped: Error = mapHlsPlayError(new Error("player exploded"));
    expect(mapped.message).toBe("player exploded");
  });
});

describe("mapHttpPlayError", () => {
  test("maps a missing ffmpeg spawn error to the stream message", () => {
    const mapped: Error = mapHttpPlayError(
      new Error("FFmpeg/avconv not found!"),
    );
    expect(mapped.message).toBe(
      "Couldn't play that stream: ffmpeg is not installed.",
    );
  });

  test("keeps the SoundCloud string on the HLS mapper", () => {
    const mapped: Error = mapHlsPlayError(
      new Error("FFmpeg/avconv not found!"),
    );
    expect(mapped.message).toBe(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
  });
});

describe("live webm/opus dry spell", () => {
  test("keeps the same resource Playing through a 400ms read pause", async () => {
    const player = createPlaybackPlayer({
      noSubscriber: NoSubscriberBehavior.Play,
    });
    const resource = createPlaybackResource(
      createHitchOpusStream({
        hitchAfterPackets: 12,
        hitchMs: 400,
        totalPackets: 80,
      }),
      StreamType.Opus,
    );
    player.play(resource);
    await entersState(player, AudioPlayerStatus.Playing, 2_000);
    await sleepAsync(800);
    expect(player.state.status).toBe(AudioPlayerStatus.Playing);
    if (player.state.status === AudioPlayerStatus.Playing) {
      expect(player.state.resource).toBe(resource);
    }
    player.stop(true);
  }, 10_000);
});

/** Opus comfort-noise packet used by Discord as a silence frame. */
const OPUS_SILENCE: Buffer = Buffer.from([0xf8, 0xff, 0xfe]);

/**
 * Object-mode opus stream that pauses `read()` once, then continues.
 * @param input - Hitch timing and packet counts.
 * @returns Stream of silence packets.
 */
function createHitchOpusStream(input: {
  readonly hitchAfterPackets: number;
  readonly hitchMs: number;
  readonly totalPackets: number;
}): Readable {
  let sent = 0;
  let hitching = false;
  return new Readable({
    objectMode: true,
    read(): void {
      if (hitching) {
        return;
      }
      if (sent >= input.totalPackets) {
        this.push(null);
        return;
      }
      if (sent === input.hitchAfterPackets) {
        hitching = true;
        setTimeout(() => {
          hitching = false;
          sent += 1;
          this.push(OPUS_SILENCE);
        }, input.hitchMs);
        return;
      }
      sent += 1;
      this.push(OPUS_SILENCE);
    },
  });
}

function sleepAsync(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
