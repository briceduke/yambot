import { TrackResolveError, type Track } from "@yambot/audio-engine";
import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { formatDuration } from "../format-duration.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const USAGE_REPLY = "Usage: /play <YouTube URL or search words>";
const NOT_IN_VOICE_REPLY = "Join a voice channel first.";
const RESOLVE_FAILED_REPLY = "Couldn't play that YouTube video.";

/** Slash command payload for `/play`. `query` is optional so a bare `/play` hits usage. */
export const playSlashData = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a YouTube URL or search words.")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("YouTube URL or search words.")
      .setRequired(false),
  );

/**
 * Runs play against a guild session. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session from Task 2.
 * @returns Resolves after a reply is sent.
 */
export async function executePlay(
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
  const track: Track | null = await resolveOrReplyAsync(ctx, session);
  if (track === null) {
    return;
  }
  await playOrQueueAsync(ctx, session, track);
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
): Promise<Track | null> {
  try {
    return await session.engine.resolveTrack({ query: ctx.args });
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
  track: Track,
): Promise<void> {
  if (session.currentTrack !== null) {
    const position: number = session.enqueue(track);
    await ctx.reply(queuedReply(track, position));
    return;
  }
  try {
    await session.playNow(track);
  } catch (error) {
    await ctx.reply(errorMessage(error));
    return;
  }
  await ctx.reply(playingReply(track));
}

function occupiedReply(channelName: string): string {
  return `Already playing in #${channelName} — join there.`;
}

function playingReply(track: Track): string {
  return `Playing: ${track.title} (${formatDuration(track.durationSeconds)})`;
}

function queuedReply(track: Track, position: number): string {
  return `Queued (#${position}): ${track.title} (${formatDuration(track.durationSeconds)})`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
