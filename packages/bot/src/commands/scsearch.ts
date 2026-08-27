import {
  TrackResolveError,
  type ResolveResult,
  type Track,
} from "@yambot/audio-engine";
import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { formatDuration } from "../format-duration.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const USAGE_REPLY = "Usage: /scsearch <SoundCloud search words>";
const NOT_IN_VOICE_REPLY = "Join a voice channel first.";
const RESOLVE_FAILED_REPLY = "Couldn't play that SoundCloud track.";
const PLAYLIST_EMPTY_REPLY = "That playlist has no playable tracks.";

/** Slash command payload for `/scsearch`. `query` is optional so a bare `/scsearch` hits usage. */
export const scsearchSlashData = new SlashCommandBuilder()
  .setName("scsearch")
  .setDescription("Search SoundCloud and play the top hit.")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("SoundCloud search words.")
      .setRequired(false),
  );

/**
 * Runs scsearch against a guild session. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session.
 * @returns Resolves after a reply is sent.
 */
export async function executeScsearch(
  ctx: CommandContext,
  session: GuildMusicSession,
): Promise<void> {
  const voiceChannelId: string | null = await readVoiceChannelIdOrReplyAsync(
    ctx,
    session,
  );
  if (voiceChannelId === null) {
    return;
  }
  const didJoin: boolean = await joinOrReplyAsync(ctx, session, voiceChannelId);
  if (!didJoin) {
    return;
  }
  const result: ResolveResult | null = await resolveOrReplyAsync(ctx, session);
  if (result === null) {
    return;
  }
  await playOrQueueAsync(ctx, session, result);
}

async function readVoiceChannelIdOrReplyAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
): Promise<string | null> {
  if (ctx.args === "") {
    await ctx.reply(USAGE_REPLY);
    return null;
  }
  const voiceChannelId: string | null = ctx.invokerVoiceChannelId;
  if (voiceChannelId === null) {
    await ctx.reply(NOT_IN_VOICE_REPLY);
    return null;
  }
  if (session.isOccupiedInOtherChannel(voiceChannelId)) {
    await ctx.reply(occupiedReply(session.voiceChannelName));
    return null;
  }
  return voiceChannelId;
}

async function joinOrReplyAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  channelId: string,
): Promise<boolean> {
  try {
    await session.joinInvoker(channelId);
    return true;
  } catch (error) {
    await ctx.reply(`Couldn't join voice: ${errorMessage(error)}`);
    return false;
  }
}

async function resolveOrReplyAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
): Promise<ResolveResult | null> {
  try {
    return await session.engine.resolveTrack({
      query: ctx.args,
      source: "soundcloud",
    });
  } catch (error) {
    if (error instanceof TrackResolveError) {
      await ctx.reply(error.message);
      return null;
    }
    await ctx.reply(RESOLVE_FAILED_REPLY);
    return null;
  }
}

async function playOrQueueAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  result: ResolveResult,
): Promise<void> {
  const first: Track | undefined = result.tracks[0];
  if (first === undefined) {
    await ctx.reply(PLAYLIST_EMPTY_REPLY);
    return;
  }
  if (session.currentTrack !== null) {
    await enqueueWhileCurrentAsync(ctx, session, result, first);
    return;
  }
  await playFirstThenQueueRestAsync(ctx, session, result, first);
}

async function enqueueWhileCurrentAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  result: ResolveResult,
  first: Track,
): Promise<void> {
  if (isSingleTrackResult(result)) {
    const position: number = session.enqueue(first);
    await ctx.reply(queuedReply(first, position));
    return;
  }
  enqueueTracks(session, result.tracks);
  await ctx.reply(addedReply(result));
}

async function playFirstThenQueueRestAsync(
  ctx: CommandContext,
  session: GuildMusicSession,
  result: ResolveResult,
  first: Track,
): Promise<void> {
  try {
    await session.playNow(first);
  } catch (error) {
    await ctx.reply(errorMessage(error));
    return;
  }
  enqueueTracks(session, result.tracks.slice(1));
  await ctx.reply(playingOrAddedReply(result, first));
}

function enqueueTracks(
  session: GuildMusicSession,
  tracks: readonly Track[],
): void {
  for (const track of tracks) {
    session.enqueue(track);
  }
}

function occupiedReply(channelName: string): string {
  return `Already playing in #${channelName} — join there.`;
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
