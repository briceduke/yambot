import type { Track } from "@yambot/audio-engine";
import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { formatDuration } from "../format-duration.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import {
  EMBED_COLOR,
  formatProgressBar,
  type NoticeEmbedInput,
  replyEmbed,
  youtubeThumbnailUrl,
} from "../reply-embed.ts";

const NOTHING_PLAYING_REPLY = "Nothing is playing.";

/** Slash command payload for `/nowplaying`. */
export const nowplayingSlashData = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("Show the current track and elapsed time.");

/**
 * Shows the current track, elapsed time, and URL as a notice embed.
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
    await ctx.reply(
      "",
      replyEmbed({
        color: EMBED_COLOR.error,
        description: NOTHING_PLAYING_REPLY,
      }),
    );
    return;
  }
  await ctx.reply("", replyEmbed(nowPlayingNotice(session, session.currentTrack)));
}

function nowPlayingNotice(
  session: GuildMusicSession,
  track: Track,
): NoticeEmbedInput {
  const elapsedSeconds: number = Math.floor(session.playbackDurationMs() / 1000);
  const elapsed: string = formatDuration(elapsedSeconds);
  const duration: string = formatDuration(track.durationSeconds);
  const paused: boolean = session.isPaused();
  const status: string = paused ? "Paused" : "Now playing";
  const line1: string = `${status}: ${track.title} (${elapsed} / ${duration})`;
  const bar: string = formatProgressBar(elapsedSeconds, track.durationSeconds);
  const description: string = bar === "" ? line1 : `${line1}\n${bar}`;
  const thumbnailUrl: string | null = youtubeThumbnailUrl(track.uri);
  return {
    title: status,
    color: paused ? EMBED_COLOR.warn : EMBED_COLOR.info,
    description,
    url: track.uri,
    ...(thumbnailUrl !== null ? { thumbnailUrl } : {}),
  };
}
