import { describe, expect, test } from "bun:test";
import { TrackResolveError, type ResolveResult, type Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { EnginePort, GuildMusicSession } from "../guild-music-session.ts";
import { executeScsearch } from "./scsearch.ts";

describe("executeScsearch", () => {
  test("replies usage and does not join when args are empty", async () => {
    const session = new FakeSession();
    const ctx = createContext({ args: "", invokerVoiceChannelId: "voice-1" });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Usage: /scsearch <SoundCloud search words>",
    ]);
    expect(session.joinChannelIds).toEqual([]);
  });

  test("replies to join voice first and does not join when invoker is not in voice", async () => {
    const session = new FakeSession();
    const ctx = createContext({
      args: "lofi beats",
      invokerVoiceChannelId: null,
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Join a voice channel first."]);
    expect(session.joinChannelIds).toEqual([]);
  });

  test("replies with the other channel and does not join when occupied", async () => {
    const session = new FakeSession();
    session.occupied = true;
    session.voiceChannelName = "music";
    const ctx = createContext({
      args: "lofi beats",
      invokerVoiceChannelId: "voice-b",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Already playing in #music — join there.",
    ]);
    expect(session.joinChannelIds).toEqual([]);
  });

  test("replies the resolve error and does not queue", async () => {
    const session = new FakeSession();
    session.resolveError = new TrackResolveError(
      "No SoundCloud results for that search.",
    );
    const ctx = createContext({
      args: "zzzz-no-results",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["No SoundCloud results for that search."]);
    expect(session.joinChannelIds).toEqual(["voice-1"]);
    expect(session.queued).toEqual([]);
    expect(session.played).toEqual([]);
  });

  test("replies that a YouTube URL is not a SoundCloud track", async () => {
    const session = new FakeSession();
    session.resolveError = new TrackResolveError(
      "That is not a SoundCloud track.",
    );
    const ctx = createContext({
      args: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["That is not a SoundCloud track."]);
    expect(session.queued).toEqual([]);
    expect(session.played).toEqual([]);
  });

  test("replies Playing when idle", async () => {
    const session = new FakeSession();
    const track = sampleTrack("Lo-Fi Study", 180);
    session.resolvedTrack = track;
    const ctx = createContext({
      args: "lofi beats",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Playing: Lo-Fi Study (3:00)"]);
    expect(session.played).toEqual([track]);
    expect(session.queued).toEqual([]);
    expect(session.resolveInputs).toEqual([
      { query: "lofi beats", source: "soundcloud" },
    ]);
  });

  test("replies Queued (#2) when a track is already current", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("current", 100);
    session.enqueuePosition = 2;
    const queued = sampleTrack("Next Beat", 61);
    session.resolvedTrack = queued;
    const ctx = createContext({
      args: "next beat",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Queued (#2): Next Beat (1:01)"]);
    expect(session.queued).toEqual([queued]);
    expect(session.played).toEqual([]);
  });

  test("enqueues and stays paused when current is paused", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("current", 100);
    session.paused = true;
    session.enqueuePosition = 2;
    const queued = sampleTrack("Next Beat", 61);
    session.resolvedTrack = queued;
    const ctx = createContext({
      args: "next beat",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Queued (#2): Next Beat (1:01)"]);
    expect(session.queued).toEqual([queued]);
    expect(session.played).toEqual([]);
    expect(session.unpauseCalls).toBe(0);
    expect(session.isPaused()).toBe(true);
  });

  test("replies the ffmpeg-miss message when playNow throws it", async () => {
    const session = new FakeSession();
    session.resolvedTrack = sampleTrack("Lo-Fi Study", 180);
    session.playNowError = new Error(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
    const ctx = createContext({
      args: "lofi beats",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    ]);
    expect(session.played).toEqual([]);
  });

  test("expands a SoundCloud set when idle", async () => {
    const session = new FakeSession();
    const first = sampleTrack("A", 10);
    const second = sampleTrack("C", 30);
    session.resolvedResult = {
      tracks: [first, second],
      playlistTitle: "Album",
      truncated: false,
    };
    const ctx = createContext({
      args: "https://soundcloud.com/artist/sets/album",
      invokerVoiceChannelId: "voice-1",
    });

    await executeScsearch(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Playing: A (0:10)\nAdded 2 tracks from Album.",
    ]);
    expect(session.played).toEqual([first]);
    expect(session.queued).toEqual([second]);
    expect(session.resolveInputs).toEqual([
      {
        query: "https://soundcloud.com/artist/sets/album",
        source: "soundcloud",
      },
    ]);
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
  paused = false;
  unpauseCalls = 0;
  voiceChannelName = "music";
  occupied = false;
  enqueuePosition = 2;
  resolvedTrack: Track = sampleTrack("Song", 180);
  resolvedResult: ResolveResult | null = null;
  resolveError: Error | null = null;
  playNowError: Error | null = null;
  readonly resolveInputs: {
    readonly query: string;
    readonly source?: "soundcloud";
  }[] = [];
  readonly engine: EnginePort = {
    resolveTrack: async (input: {
      readonly query: string;
      readonly source?: "soundcloud";
    }): Promise<ResolveResult> => {
      this.resolveInputs.push(input);
      if (this.resolveError !== null) {
        throw this.resolveError;
      }
      if (this.resolvedResult !== null) {
        return this.resolvedResult;
      }
      return {
        tracks: [this.resolvedTrack],
        playlistTitle: null,
        truncated: false,
      };
    },
    openTrackAudio: async (): Promise<never> => {
      throw new Error("openTrackAudio is not used by scsearch tests");
    },
  };

  isOccupiedInOtherChannel(_invokerVoiceChannelId: string): boolean {
    return this.occupied;
  }

  async joinInvoker(channelId: string): Promise<void> {
    this.joinChannelIds.push(channelId);
  }

  async playNow(track: Track): Promise<void> {
    if (this.playNowError !== null) {
      throw this.playNowError;
    }
    this.played.push(track);
    this.currentTrack = track;
  }

  enqueue(track: Track): number {
    this.queued.push(track);
    return this.enqueuePosition;
  }

  isPaused(): boolean {
    return this.paused;
  }

  unpause(): boolean {
    this.unpauseCalls += 1;
    this.paused = false;
    return true;
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
    uri: `https://soundcloud.com/artist/${title}`,
    durationSeconds,
  };
}
