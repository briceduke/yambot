import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import {
  clearGuildOverlayPrefix,
  readOperatorEnv,
  setGuildOverlayPrefix,
} from "../operator-config.ts";

const USAGE_REPLY = "Usage: /prefix <prefix>";
const LENGTH_REPLY = "Prefix must be 1 to 8 characters.";
const MAX_PREFIX_LENGTH = 8;

/** Slash command payload for `/prefix`. */
export const prefixSlashData = new SlashCommandBuilder()
  .setName("prefix")
  .setDescription("Set or reset the guild command prefix.")
  .addStringOption((option) =>
    option
      .setName("value")
      .setDescription("New prefix, or none to reset.")
      .setRequired(true),
  );

/**
 * Sets or clears the guild prefix overlay. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door. New prefix or `none` is `ctx.args`.
 * @returns Resolves after a reply is sent.
 */
export async function executePrefix(ctx: CommandContext): Promise<void> {
  const raw: string = ctx.args;
  const trimmed: string = raw.trim();
  if (trimmed.length === 0) {
    if (raw.length === 0) {
      await ctx.reply(USAGE_REPLY);
      return;
    }
    await ctx.reply(LENGTH_REPLY);
    return;
  }
  if (trimmed.toLowerCase() === "none") {
    clearGuildOverlayPrefix(ctx.guildId);
    const envPrefix: string = readOperatorEnv(process.env).commandPrefix;
    await ctx.reply(`Prefix reset to \`${envPrefix}\`.`);
    return;
  }
  if (trimmed.length > MAX_PREFIX_LENGTH) {
    await ctx.reply(LENGTH_REPLY);
    return;
  }
  setGuildOverlayPrefix(ctx.guildId, trimmed);
  await ctx.reply(`Prefix set to \`${trimmed}\`.`);
}
