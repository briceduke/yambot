import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

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
    await ctx.reply(NOTHING_PLAYING_REPLY);
    return;
  }
  if (!session.isPaused()) {
    await ctx.reply(NOTHING_PAUSED_REPLY);
    return;
  }
  session.unpause();
  await ctx.reply(`Resumed: ${session.currentTrack.title}`);
}
