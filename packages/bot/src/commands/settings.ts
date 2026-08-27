import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import type { GuildOperatorView } from "../operator-config.ts";
import { getGuildOperatorView } from "../operator-config.ts";

/** Slash command payload for `/settings`. */
export const settingsSlashData = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Show guild operator settings.");

/**
 * Replies with the current guild operator view. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @returns Resolves after a reply is sent.
 */
export async function executeSettings(ctx: CommandContext): Promise<void> {
  const view: GuildOperatorView = getGuildOperatorView(
    ctx.guildId,
    process.env,
  );
  await ctx.reply(formatSettingsBody(view));
}

function formatSettingsBody(view: GuildOperatorView): string {
  const djLine: string =
    view.djRoleId === null
      ? "DJ role: none — DJ commands are open"
      : `DJ role: <@&${view.djRoleId}>`;
  const textLine: string =
    view.textChannelId === null
      ? "Text channel: none"
      : `Text channel: <#${view.textChannelId}>`;
  const voiceLine: string =
    view.voiceChannelId === null
      ? "Voice channel: none"
      : `Voice channel: <#${view.voiceChannelId}>`;
  const stayLine: string = `Stay in channel: ${view.stayInChannel ? "yes" : "no"}`;
  const aloneLine: string =
    view.aloneTimeUntilStopSeconds === 0
      ? "Alone time until stop: off"
      : `Alone time until stop: ${view.aloneTimeUntilStopSeconds}s`;
  const idleLine: string = `Idle leave: ${view.idleLeaveSeconds}s`;
  return [
    `Prefix: \`${view.prefix}\``,
    djLine,
    textLine,
    voiceLine,
    stayLine,
    aloneLine,
    idleLine,
  ].join("\n");
}
