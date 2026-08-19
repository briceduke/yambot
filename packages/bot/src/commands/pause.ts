import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const NOTHING_PLAYING_REPLY = "Nothing is playing.";
const ALREADY_PAUSED_REPLY = "Already paused.";

/** Slash command payload for `/pause`. */
export const pauseSlashData = new SlashCommandBuilder()
  .setName("pause")
  .setDescription("Pause the current track.");

/**
 * Pauses the current track. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executePause(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  if (session === undefined || session.currentTrack === null) {
    await ctx.reply(NOTHING_PLAYING_REPLY);
    return;
  }
  if (session.isPaused()) {
    await ctx.reply(ALREADY_PAUSED_REPLY);
    return;
  }
  session.pause();
  await ctx.reply(`Paused: ${session.currentTrack.title}`);
}
