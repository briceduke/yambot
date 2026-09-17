import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { playFromQueryAsync } from "../play-from-query.ts";

const USAGE_REPLY =
  "Usage: /play <YouTube, SoundCloud, playlist, or stream URL, or YouTube search words>";
const RESOLVE_FAILED_REPLY = "Couldn't play that YouTube video.";

/** Slash command payload for `/play`. `query` is optional so a bare `/play` hits usage. */
export const playSlashData = new SlashCommandBuilder()
  .setName("play")
  .setDescription(
    "Play a URL (video, playlist, set, or stream) or YouTube search words.",
  )
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription(
        "YouTube, SoundCloud, playlist, or stream URL, or YouTube search words.",
      )
      .setRequired(false),
  );

/**
 * Runs play against a guild session. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session.
 * @returns Resolves after a reply is sent.
 */
export async function executePlay(
  ctx: CommandContext,
  session: GuildMusicSession,
): Promise<void> {
  await playFromQueryAsync(ctx, session, {
    usageReply: USAGE_REPLY,
    resolveFailedReply: RESOLVE_FAILED_REPLY,
  });
}
