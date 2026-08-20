import type { Track } from "@yambot/audio-engine";
import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildMusicSession } from "../guild-music-session.ts";

const USAGE_REPLY = "Usage: /remove <position>";

/** Slash command payload for `/remove`. */
export const removeSlashData = new SlashCommandBuilder()
  .setName("remove")
  .setDescription("Remove a track from the queue.")
  .addIntegerOption((option) =>
    option
      .setName("position")
      .setDescription("Queue position to remove.")
      .setRequired(true)
      .setMinValue(1),
  );

/**
 * Removes one upcoming track by 1-based position.
 * Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door. Position is `ctx.args`.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeRemove(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  const n: number | null = parsePositionArg(ctx.args);
  if (n === null) {
    await ctx.reply(USAGE_REPLY);
    return;
  }
  const size: number = readUpcomingSize(session);
  if (session === undefined || n < 1 || n > size) {
    await ctx.reply(`No track at position ${n}.`);
    return;
  }
  const removed: Track | null = session.removeUpcomingAt(n - 1);
  if (removed === null) {
    await ctx.reply(`No track at position ${n}.`);
    return;
  }
  await ctx.reply(`Removed: ${removed.title}`);
}

function parsePositionArg(args: string): number | null {
  const raw: string = args.trim();
  if (raw === "" || !/^-?\d+$/.test(raw)) {
    return null;
  }
  return Number.parseInt(raw, 10);
}

function readUpcomingSize(session: GuildMusicSession | undefined): number {
  if (session === undefined) {
    return 0;
  }
  return session.snapshot().upcoming.length;
}
