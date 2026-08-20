import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const EMPTY_QUEUE_REPLY = "The queue is empty.";

/** Slash command payload for `/shuffle`. */
export const shuffleSlashData = new SlashCommandBuilder()
  .setName("shuffle")
  .setDescription("Shuffle the upcoming tracks.");

/**
 * Reorders upcoming tracks. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeShuffle(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  const n: number = readUpcomingSize(session);
  if (session === undefined || n === 0) {
    await ctx.reply(EMPTY_QUEUE_REPLY);
    return;
  }
  session.shuffleUpcoming();
  await ctx.reply(`Shuffled ${n} tracks.`);
}

function readUpcomingSize(session: GuildMusicSession | undefined): number {
  if (session === undefined) {
    return 0;
  }
  return session.snapshot().upcoming.length;
}
