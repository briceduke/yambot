import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { EMBED_COLOR, replyEmbed, youtubeThumbnailUrl } from "../reply-embed.ts";

const NOTHING_PLAYING_REPLY = "Nothing is playing.";
const NOTHING_PAUSED_REPLY = "Nothing is paused.";

/** Slash command payload for `/resume`. */
export const resumeSlashData = new SlashCommandBuilder()
  .setName("resume")
  .setDescription("Resume the paused track.");

/**
 * Resumes the paused track. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeResume(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  if (session === undefined || session.currentTrack === null) {
    await ctx.reply(
      "",
      replyEmbed({
        description: NOTHING_PLAYING_REPLY,
        color: EMBED_COLOR.error,
      }),
    );
    return;
  }
  if (!session.isPaused()) {
    await ctx.reply(
      "",
      replyEmbed({
        description: NOTHING_PAUSED_REPLY,
        color: EMBED_COLOR.error,
      }),
    );
    return;
  }
  const track = session.currentTrack;
  const thumbnailUrl = youtubeThumbnailUrl(track.uri);
  session.unpause();
  await ctx.reply(
    "",
    replyEmbed({
      description: `Resumed: ${track.title}`,
      color: EMBED_COLOR.ok,
      url: track.uri,
      ...(thumbnailUrl === null ? {} : { thumbnailUrl }),
    }),
  );
}
