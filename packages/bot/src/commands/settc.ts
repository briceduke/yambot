import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { setGuildOverlayTextChannelId } from "../operator-config.ts";

const USAGE_REPLY = "Usage: /settc <channel>";
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const CHANNEL_MENTION_PATTERN = /^<#(\d{17,20})>$/;

/** Slash command payload for `/settc`. */
export const settcSlashData = new SlashCommandBuilder()
  .setName("settc")
  .setDescription("Bind or clear the text channel for music commands.")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Text channel. Omit to clear.")
      .setRequired(false),
  );

/**
 * Sets or clears the guild text-channel overlay. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door. Channel id, mention, `none`, or empty is `ctx.args`.
 * @returns Resolves after a reply is sent.
 */
export async function executeSetTc(ctx: CommandContext): Promise<void> {
  const parsed: string | "none" | null = parseChannelArg(ctx.args);
  if (parsed === null) {
    await ctx.reply(USAGE_REPLY);
    return;
  }
  if (parsed === "none") {
    setGuildOverlayTextChannelId(ctx.guildId, null);
    await ctx.reply("Text channel cleared.");
    return;
  }
  setGuildOverlayTextChannelId(ctx.guildId, parsed);
  await ctx.reply(`Text channel set to <#${parsed}>.`);
}

function parseChannelArg(args: string): string | "none" | null {
  const trimmed: string = args.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "none") {
    return "none";
  }
  const mention: RegExpExecArray | null = CHANNEL_MENTION_PATTERN.exec(trimmed);
  const mentionId: string | undefined = mention?.[1];
  if (mentionId !== undefined) {
    return mentionId;
  }
  if (SNOWFLAKE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}
