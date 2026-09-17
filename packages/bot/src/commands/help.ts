import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { getGuildOperatorView } from "../operator-config.ts";

/** Slash command payload for `/help`. */
export const helpSlashData = new SlashCommandBuilder()
  .setName("help")
  .setDescription("List commands by class.");

/**
 * Replies with commands grouped by class. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @returns Resolves after a reply is sent.
 */
export async function executeHelp(ctx: CommandContext): Promise<void> {
  const prefix: string = getGuildOperatorView(ctx.guildId, process.env).prefix;
  await ctx.reply(formatHelpBody(prefix));
}

function formatHelpBody(prefix: string): string {
  return [
    "Music: play, scsearch, queue, nowplaying (np), skip",
    "DJ (when a DJ role is set): pause, resume, remove, shuffle, clear, stop, skip",
    "Admin (Manage Server): prefix, setdj, settc, setvc",
    "Also: settings, help",
    `Prefix: ${prefix} and @mention. Example: ${prefix}play and @bot skip`,
  ].join("\n");
}
