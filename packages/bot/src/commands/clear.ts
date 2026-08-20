import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { dropSession, type GuildMusicSession } from "../guild-music-session.ts";

const EMPTY_QUEUE_REPLY = "The queue is empty.";

/** Slash command payload for `/clear`. */
export const clearSlashData = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Clear the upcoming tracks.");

/**
 * Wipes upcoming tracks. Drops the session when nothing is current.
 * Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeClear(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  const size: number = readUpcomingSize(session);
  if (session === undefined || size === 0) {
    await ctx.reply(EMPTY_QUEUE_REPLY);
    return;
  }
  const n: number = session.clearUpcoming();
  await ctx.reply(`Cleared ${n} tracks.`);
  if (session.currentTrack === null) {
    dropSession(ctx.guildId);
  }
}

function readUpcomingSize(session: GuildMusicSession | undefined): number {
  if (session === undefined) {
    return 0;
  }
  return session.snapshot().upcoming.length;
}
