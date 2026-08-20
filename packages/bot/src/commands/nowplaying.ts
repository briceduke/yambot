import type { Track } from "@yambot/audio-engine";
import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { formatDuration } from "../format-duration.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const NOTHING_PLAYING_REPLY = "Nothing is playing.";

/** Slash command payload for `/nowplaying`. */
export const nowplayingSlashData = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Show the current track and elapsed time.");

/**
 * Shows the current track, elapsed time, and URL.
 * Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeNowPlaying(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  if (session === undefined || session.currentTrack === null) {
    await ctx.reply(NOTHING_PLAYING_REPLY);
    return;
  }
  await ctx.reply(formatNowPlayingReply(session, session.currentTrack));
}

function formatNowPlayingReply(
  session: GuildMusicSession,
  track: Track,
): string {
  const elapsed: string = formatDuration(
    Math.floor(session.playbackDurationMs() / 1000),
  );
  const duration: string = formatDuration(track.durationSeconds);
  const status: string = session.isPaused() ? "Paused" : "Now playing";
  return `${status}: ${track.title} (${elapsed} / ${duration})\n<${track.uri}>`;
}
