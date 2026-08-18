import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const NOTHING_PLAYING_REPLY = "Nothing is playing.";

/** Slash command payload for `/skip`. */
export const skipSlashData = new SlashCommandBuilder()
  .setName("skip")
  .setDescription("Skip the current track.");

/**
 * Skips the current track. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeSkip(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  if (session === undefined || session.currentTrack === null) {
    await ctx.reply(NOTHING_PLAYING_REPLY);
    return;
  }
  await ctx.reply(`Skipped: ${session.currentTrack.title}`);
  session.skipCurrent();
}
