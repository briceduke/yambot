import { describe, expect, test } from "bun:test";
import { TrackResolveError, type ResolveResult, type Track } from "@yambot/audio-engine";

import type { CommandContext } from "../command-context.ts";
import type { EnginePort, GuildMusicSession } from "../guild-music-session.ts";
import { executePlay } from "./play.ts";

describe("executePlay", () => {
  test("replies usage and does not join when args are empty", async () => {
    const session = new FakeSession();
    const ctx = createContext({ args: "", invokerVoiceChannelId: "voice-1" });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Usage: /play <YouTube, SoundCloud, playlist, or stream URL, or YouTube search words>",
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

  test("replies the playlist-empty resolve error", async () => {
    const session = new FakeSession();
    session.resolveError = new TrackResolveError(
      "That playlist has no playable tracks.",
    );
    const ctx = createContext({
      args: "https://www.youtube.com/playlist?list=PL8oEkrReXiOLp1N9czSJ6XAu1CvyZWgMB",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["That playlist has no playable tracks."]);
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
    expect(session.resolveInputs).toEqual([
      { query: "never gonna give you up" },
    ]);
  });

  test("replies the ffmpeg-miss message when playNow throws it", async () => {
    const session = new FakeSession();
    session.resolvedTrack = sampleTrack("Lo-Fi Study", 180);
    session.playNowError = new Error(
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    );
    const ctx = createContext({
      args: "https://soundcloud.com/artist/track",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Couldn't play that SoundCloud track: ffmpeg is not installed.",
    ]);
    expect(session.played).toEqual([]);
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

  test("enqueues and stays paused when current is paused", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("current", 100);
    session.paused = true;
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
    expect(session.unpauseCalls).toBe(0);
    expect(session.isPaused()).toBe(true);
  });

  test("plays the first playlist track and enqueues the rest when idle", async () => {
    const session = new FakeSession();
    const first = sampleTrack("One", 10);
    const second = sampleTrack("Two", 20);
    session.resolvedResult = playlistResult("Summer Mix", [first, second]);
    const ctx = createContext({
      args: "https://www.youtube.com/playlist?list=PL8oEkrReXiOLp1N9czSJ6XAu1CvyZWgMB",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Playing: One (0:10)\nAdded 2 tracks from Summer Mix.",
    ]);
    expect(session.played).toEqual([first]);
    expect(session.queued).toEqual([second]);
  });

  test("enqueues every playlist track and replies Added when occupied", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("current", 100);
    const first = sampleTrack("One", 10);
    const second = sampleTrack("Two", 20);
    session.resolvedResult = playlistResult("Summer Mix", [first, second]);
    const ctx = createContext({
      args: "https://www.youtube.com/playlist?list=PLtest",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Added 2 tracks from Summer Mix."]);
    expect(session.played).toEqual([]);
    expect(session.queued).toEqual([first, second]);
  });

  test("notes the cap when the playlist was truncated", async () => {
    const session = new FakeSession();
    const first = sampleTrack("One", 10);
    session.resolvedResult = {
      tracks: [first],
      playlistTitle: "Long",
      truncated: true,
    };
    const ctx = createContext({
      args: "https://www.youtube.com/playlist?list=PLlong",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual([
      "Playing: One (0:10)\nAdded 1 tracks from Long (capped at 1000).",
    ]);
    expect(session.played).toEqual([first]);
  });

  test("does not enqueue remaining tracks when playNow fails on the first", async () => {
    const session = new FakeSession();
    const first = sampleTrack("One", 10);
    const second = sampleTrack("Two", 20);
    session.resolvedResult = playlistResult("Summer Mix", [first, second]);
    session.playNowError = new Error("Couldn't play that YouTube video.");
    const ctx = createContext({
      args: "https://www.youtube.com/playlist?list=PLtest",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Couldn't play that YouTube video."]);
    expect(session.played).toEqual([]);
    expect(session.queued).toEqual([]);
  });

  test("enqueues a playlist and stays paused when current is paused", async () => {
    const session = new FakeSession();
    session.currentTrack = sampleTrack("current", 100);
    session.paused = true;
    const first = sampleTrack("One", 10);
    const second = sampleTrack("Two", 20);
    session.resolvedResult = playlistResult("Summer Mix", [first, second]);
    const ctx = createContext({
      args: "https://www.youtube.com/playlist?list=PLtest",
      invokerVoiceChannelId: "voice-1",
    });

    await executePlay(ctx, session.asGuildSession());

    expect(ctx.replies).toEqual(["Added 2 tracks from Summer Mix."]);
    expect(session.queued).toEqual([first, second]);
    expect(session.unpauseCalls).toBe(0);
    expect(session.isPaused()).toBe(true);
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
  resolvedTrack: Track = sampleTrack("Song", 213);
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
    uri: `https://www.youtube.com/watch?v=${title}`,
    durationSeconds,
  };
}

function playlistResult(
  title: string,
  tracks: readonly Track[],
): ResolveResult {
  return { tracks, playlistTitle: title, truncated: false };
}
