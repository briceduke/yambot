import {
  TrackResolveError,
  type ResolveResult,
  type Track,
  type TrackAudio,
} from "@yambot/audio-engine";

import type {
  CommandContext,
  CommandReplyOptions,
} from "./command-context.ts";
import { formatDuration } from "./format-duration.ts";
import type { GuildMusicSession } from "./guild-music-session.ts";
import {
  EMBED_COLOR,
  replyEmbed,
  youtubeThumbnailUrl,
} from "./reply-embed.ts";

const NOT_IN_VOICE_REPLY = "Join a voice channel first.";
const PLAYLIST_EMPTY_REPLY = "That playlist has no playable tracks.";

/** Copy and resolve options for `/play` and `/scsearch`. */
export interface PlayFromQueryInput {
  readonly usageReply: string;
  readonly resolveFailedReply: string;
  readonly source?: "soundcloud";
}

/**
 * Shared play door: join, resolve, then play or queue.
 * Overlaps join with resolve and the first open.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session.
 * @param input - Usage copy and optional SoundCloud hint.
 * @returns Resolves after a reply is sent.
 */
export async function playFromQueryAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  input: PlayFromQueryInput,
): Promise<void> {
  const voiceChannelId: string | null = await readVoiceChannelIdOrReplyAsync(
    ctx,
    session,
    input.usageReply,
  );
  if (voiceChannelId === null) {
    return;
  }
  const joinPromise: Promise<void> = session.joinInvoker(voiceChannelId);
  const result: ResolveResult | null = await resolveOrReplyAsync(
    ctx,
    session,
    input,
  );
  if (result === null) {
    void joinPromise.catch(() => {});
    return;
  }
  await playOrQueueAsync(ctx, session, result, joinPromise);
}

async function readVoiceChannelIdOrReplyAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  usageReply: string,
): Promise<string | null> {
  if (ctx.args === "") {
    await ctx.reply("", errorNotice(usageReply));
    return null;
  }
  const voiceChannelId: string | null = ctx.invokerVoiceChannelId;
  if (voiceChannelId === null) {
    await ctx.reply("", errorNotice(NOT_IN_VOICE_REPLY));
    return null;
  }
  if (session.isOccupiedInOtherChannel(voiceChannelId)) {
    await ctx.reply(
      "",
      errorNotice(
        `Already playing in #${session.voiceChannelName} — join there.`,
      ),
    );
    return null;
  }
  return voiceChannelId;
}

async function resolveOrReplyAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  input: PlayFromQueryInput,
): Promise<ResolveResult | null> {
  try {
    if (input.source === "soundcloud") {
      return await session.engine.resolveTrack({
        query: ctx.args,
        source: "soundcloud",
      });
    }
    return await session.engine.resolveTrack({ query: ctx.args });
  } catch (error) {
    if (error instanceof TrackResolveError) {
      await ctx.reply("", errorNotice(error.message));
      return null;
    }
    await ctx.reply("", errorNotice(input.resolveFailedReply));
    return null;
  }
}

async function playOrQueueAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  result: ResolveResult,
  joinPromise: Promise<void>,
): Promise<void> {
  const first: Track | undefined = result.tracks[0];
  if (first === undefined) {
    await awaitJoinOrReplyAsync(ctx, joinPromise);
    await ctx.reply("", errorNotice(PLAYLIST_EMPTY_REPLY));
    return;
  }
  if (session.currentTrack !== null) {
    const joined: boolean = await awaitJoinOrReplyAsync(ctx, joinPromise);
    if (!joined) {
      return;
    }
    await enqueueWhileCurrentAsync(ctx, session, result, first);
    return;
  }
  await playFirstOverlappingJoinAsync(ctx, session, result, first, joinPromise);
}

async function playFirstOverlappingJoinAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  result: ResolveResult,
  first: Track,
  joinPromise: Promise<void>,
): Promise<void> {
  const openPromise: Promise<TrackAudio> = session.engine.openTrackAudio({
    track: first,
  });
  const joined: boolean = await awaitJoinOrReplyAsync(
    ctx,
    joinPromise,
    openPromise,
  );
  if (!joined) {
    return;
  }
  try {
    const audio: TrackAudio = await openPromise;
    await session.playNow(first, audio);
  } catch (error) {
    await ctx.reply("", errorNotice(errorMessage(error)));
    return;
  }
  enqueueTracks(session, result.tracks.slice(1));
  await ctx.reply(
    "",
    successNotice(
      "Playing",
      playingOrAddedReply(result, first),
      isSingleTrackResult(result) ? first : undefined,
    ),
  );
}

async function awaitJoinOrReplyAsync(
  ctx: CommandContext,
  joinPromise: Promise<void>,
  openPromise?: Promise<TrackAudio>,
): Promise<boolean> {
  try {
    await joinPromise;
    return true;
  } catch (error) {
    if (openPromise !== undefined) {
      void openPromise
        .then((audio) => {
          void audio.stream.cancel();
        })
        .catch(() => {});
    }
    await ctx.reply(
      "",
      errorNotice(`Couldn't join voice: ${errorMessage(error)}`),
    );
    return false;
  }
}

async function enqueueWhileCurrentAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  result: ResolveResult,
  first: Track,
): Promise<void> {
  if (isSingleTrackResult(result)) {
    const position: number = session.enqueue(first);
    await ctx.reply(
      "",
      successNotice("Queued", queuedReply(first, position), first),
    );
    return;
  }
  enqueueTracks(session, result.tracks);
  await ctx.reply("", successNotice("Added", addedReply(result)));
}

function enqueueTracks(
  session: GuildMusicSession,
  tracks: readonly Track[],
): void {
  for (const track of tracks) {
    session.enqueue(track);
  }
}

function playingOrAddedReply(result: ResolveResult, first: Track): string {
  if (isSingleTrackResult(result)) {
    return playingReply(first);
  }
  return `${playingReply(first)}\n${addedReply(result)}`;
}

function isSingleTrackResult(result: ResolveResult): boolean {
  return result.playlistTitle === null && result.tracks.length === 1;
}

function playingReply(track: Track): string {
  return `Playing: ${track.title} (${formatDuration(track.durationSeconds)})`;
}

function queuedReply(track: Track, position: number): string {
  return `Queued (#${position}): ${track.title} (${formatDuration(track.durationSeconds)})`;
}

function addedReply(result: ResolveResult): string {
  const title: string = result.playlistTitle ?? "playlist";
  const line = `Added ${result.tracks.length} tracks from ${title}.`;
  if (!result.truncated) {
    return line;
  }
  return `${line.slice(0, -1)} (capped at 1000).`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function errorNotice(description: string): CommandReplyOptions {
  return replyEmbed({ description, color: EMBED_COLOR.error });
}

function successNotice(
  title: "Playing" | "Queued" | "Added",
  description: string,
  track?: Track,
): CommandReplyOptions {
  if (track === undefined) {
    return replyEmbed({ description, color: EMBED_COLOR.ok, title });
  }
  const thumbnailUrl: string | null = youtubeThumbnailUrl(track.uri);
  return replyEmbed({
    description,
    color: EMBED_COLOR.ok,
    title,
    url: track.uri,
    ...(thumbnailUrl === null ? {} : { thumbnailUrl }),
  });
}
