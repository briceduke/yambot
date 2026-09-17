import { ChannelType, SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { setGuildOverlayVoiceChannelId } from "../operator-config.ts";
import { EMBED_COLOR, replyEmbed } from "../reply-embed.ts";

const USAGE_REPLY = "Usage: /setvc <channel>";
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const CHANNEL_MENTION_PATTERN = /^<#(\d{17,20})>$/;

/** Slash command payload for `/setvc`. */
export const setvcSlashData = new SlashCommandBuilder()
  .setName("setvc")
  .setDescription("Bind or clear the voice channel for play.")
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Voice channel. Omit to clear.")
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(false),
  );

/**
 * Sets or clears the guild voice-channel overlay. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door. Channel id, mention, `none`, or empty is `ctx.args`.
 * @returns Resolves after a reply is sent.
 */
export async function executeSetVc(ctx: CommandContext): Promise<void> {
  const parsed: string | "none" | null = parseChannelArg(ctx.args);
  if (parsed === null) {
    await ctx.reply(
      "",
      replyEmbed({ description: USAGE_REPLY, color: EMBED_COLOR.error }),
    );
    return;
  }
  if (parsed === "none") {
    setGuildOverlayVoiceChannelId(ctx.guildId, null);
    await ctx.reply(
      "",
      replyEmbed({
        description: "Voice channel cleared.",
        color: EMBED_COLOR.ok,
      }),
    );
    return;
  }
  setGuildOverlayVoiceChannelId(ctx.guildId, parsed);
  await ctx.reply(
    "",
    replyEmbed({
      description: `Voice channel set to <#${parsed}>.`,
      color: EMBED_COLOR.ok,
    }),
  );
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
