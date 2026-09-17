import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { setGuildOverlayDjRoleId } from "../operator-config.ts";
import { EMBED_COLOR, replyEmbed } from "../reply-embed.ts";

const USAGE_REPLY = "Usage: /setdj <role>";
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const ROLE_MENTION_PATTERN = /^<@&(\d{17,20})>$/;

/** Slash command payload for `/setdj`. */
export const setdjSlashData = new SlashCommandBuilder()
  .setName("setdj")
  .setDescription("Set or clear the DJ role.")
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("DJ role. Omit to clear.")
      .setRequired(false),
  );

/**
 * Sets or clears the guild DJ role overlay. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door. Role id, mention, `none`, or empty is `ctx.args`.
 * @returns Resolves after a reply is sent.
 */
export async function executeSetDj(ctx: CommandContext): Promise<void> {
  const parsed: string | "none" | null = parseRoleArg(ctx.args);
  if (parsed === null) {
    await ctx.reply(
      "",
      replyEmbed({ description: USAGE_REPLY, color: EMBED_COLOR.error }),
    );
    return;
  }
  if (parsed === "none") {
    setGuildOverlayDjRoleId(ctx.guildId, null);
    await ctx.reply(
      "",
      replyEmbed({
        description: "DJ role cleared. DJ commands are open.",
        color: EMBED_COLOR.ok,
      }),
    );
    return;
  }
  setGuildOverlayDjRoleId(ctx.guildId, parsed);
  await ctx.reply(
    "",
    replyEmbed({
      description: `DJ role set to <@&${parsed}>.`,
      color: EMBED_COLOR.ok,
    }),
  );
}

function parseRoleArg(args: string): string | "none" | null {
  const trimmed: string = args.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "none") {
    return "none";
  }
  const mention: RegExpExecArray | null = ROLE_MENTION_PATTERN.exec(trimmed);
  const mentionId: string | undefined = mention?.[1];
  if (mentionId !== undefined) {
    return mentionId;
  }
  if (SNOWFLAKE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}
