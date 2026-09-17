import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import {
  dropSession,
  type GuildMusicSession,
} from "../guild-music-session.ts";
import { EMBED_COLOR, replyEmbed } from "../reply-embed.ts";

const NOTHING_PLAYING_REPLY = "Nothing is playing.";
const STOPPED_REPLY = "Stopped.";

/** Slash command payload for `/stop`. */
export const stopSlashData = new SlashCommandBuilder()
  .setName("stop")
  .setDescription("Stop playback and leave the voice channel.");

/**
 * Stops playback and leaves voice. Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeStop(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  if (session === undefined) {
    await ctx.reply(
      "",
      replyEmbed({
        color: EMBED_COLOR.error,
        description: NOTHING_PLAYING_REPLY,
      }),
    );
    return;
  }
  if (session.currentTrack !== null) {
    session.clearUpcoming();
    dropSession(ctx.guildId);
    await ctx.reply(
      "",
      replyEmbed({ color: EMBED_COLOR.ok, description: STOPPED_REPLY }),
    );
    return;
  }
  if (isIdleLeaveWait(session)) {
    dropSession(ctx.guildId);
    await ctx.reply(
      "",
      replyEmbed({ color: EMBED_COLOR.ok, description: STOPPED_REPLY }),
    );
    return;
  }
  await ctx.reply(
    "",
    replyEmbed({
      color: EMBED_COLOR.error,
      description: NOTHING_PLAYING_REPLY,
    }),
  );
}

function isIdleLeaveWait(session: GuildMusicSession): boolean {
  return (
    session.hasVoiceConnection() && session.snapshot().upcoming.length === 0
  );
}
