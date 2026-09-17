import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";
import { playFromQueryAsync } from "../play-from-query.ts";

const USAGE_REPLY = "Usage: /scsearch <SoundCloud search words>";
const RESOLVE_FAILED_REPLY = "Couldn't play that SoundCloud track.";

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
  await playFromQueryAsync(ctx, session, {
    usageReply: USAGE_REPLY,
    resolveFailedReply: RESOLVE_FAILED_REPLY,
    source: "soundcloud",
  });
}
