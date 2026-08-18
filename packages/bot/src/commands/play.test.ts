import { describe, expect, test } from "bun:test";
import { TrackResolveError, type Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { EnginePort, GuildMusicSession } from "../guild-music-session.ts";
import { executePlay } from "./play.ts";

describe("executePlay", () => {
  test("replies usage and does not join when args are empty", async () => {
    const session = new FakeSession();
    const ctx = createContext({ args: "", invokerVoiceChannelId: "voice-1" });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Usage: /play <YouTube URL or search words>",
    ]);
    expect(session.joinChannelIds).toEqual([]);
  });

  test("replies to join voice first and does not join when invoker is not in voice", async () => {
    const session = new FakeSession();
    const ctx = createContext({
      args: "never gonna give you up",
      invokerVoiceChannelId: null,
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Join a voice channel first."]);
    expect(session.joinChannelIds).toEqual([]);
  });

  test("replies with the other channel and does not join when occupied", async () => {
    const session = new FakeSession();
    session.occupied = true;
    session.voiceChannelName = "music";
    const ctx = createContext({
      args: "never gonna give you up",
      invokerVoiceChannelId: "voice-b",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Already playing in #music — join there.",
    ]);
    expect(session.joinChannelIds).toEqual([]);
  });

  test("replies the resolve error and does not queue", async () => {
    const session = new FakeSession();
    session.resolveError = new TrackResolveError(
      "That video has no playable audio.",
    );
    const ctx = createContext({
      args: "https://www.youtube.com/watch?v=missing",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["That video has no playable audio."]);
    expect(session.joinChannelIds).toEqual(["voice-1"]);
    expect(session.queued).toEqual([]);
    expect(session.played).toEqual([]);
  });

  test("replies Playing when idle", async () => {
    const session = new FakeSession();
    const track = sampleTrack("Never Gonna Give You Up", 213);
    session.resolvedTrack = track;
    const ctx = createContext({
      args: "never gonna give you up",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Playing: Never Gonna Give You Up (3:33)"]);
    expect(session.played).toEqual([track]);
    expect(session.queued).toEqual([]);
  });

  test("replies Queued (#2) when a track is already current", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("current", 100);
    session.enqueuePosition = 2;
    const queued = sampleTrack("Next Song", 61);
    session.resolvedTrack = queued;
    const ctx = createContext({
      args: "next song",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Queued (#2): Next Song (1:01)"]);
    expect(session.queued).toEqual([queued]);
    expect(session.played).toEqual([]);
  });
});

class FakeContext implements CommandContext {
  readonly guildId = "guild-1";
  readonly channelId = "text-1";
  readonly invokerVoiceChannelId: string | null;
  readonly args: string;
  readonly replies: string[] = [];

  constructor(input: {
    readonly args: string;
    readonly invokerVoiceChannelId: string | null;
  }) {
    this.args = input.args;
    this.invokerVoiceChannelId = input.invokerVoiceChannelId;
  }

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }
}

class FakeSession {
  readonly joinChannelIds: string[] = [];
  readonly played: Track[] = [];
  readonly queued: Track[] = [];
  currentTrack: Track | null = null;
  voiceChannelName = "music";
  occupied = false;
  enqueuePosition = 2;
  resolvedTrack: Track = sampleTrack("Song", 213);
  resolveError: Error | null = null;
  readonly engine: EnginePort = {
    resolveTrack: async (): Promise<Track> => {
      if (this.resolveError !== null) {
        throw this.resolveError;
      }
      return this.resolvedTrack;
    },
    openTrackAudio: async (): Promise<never> => {
      throw new Error("openTrackAudio is not used by play tests");
    },
  };

  isOccupiedInOtherChannel(_invokerVoiceChannelId: string): boolean {
    return this.occupied;
  }

  async joinInvoker(channelId: string): Promise<void> {
    this.joinChannelIds.push(channelId);
  }

  async playNow(track: Track): Promise<void> {
    this.played.push(track);
    this.currentTrack = track;
  }

  enqueue(track: Track): number {
    this.queued.push(track);
    return this.enqueuePosition;
  }

  asGuildSession(): GuildMusicSession {
    return this as unknown as GuildMusicSession;
  }
}

function createContext(input: {
  readonly args: string;
  readonly invokerVoiceChannelId: string | null;
}): FakeContext {
  return new FakeContext(input);
}

function sampleTrack(title: string, durationSeconds: number): Track {
  return {
    title,
    uri: `https://www.youtube.com/watch?v=${title}`,
    durationSeconds,
  };
}
