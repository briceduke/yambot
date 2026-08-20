import type { Track } from "@yambot/audio-engine";
import { SlashCommandBuilder } from "discord.js";

import type { CommandContext } from "../command-context.ts";
import { formatDuration } from "../format-duration.ts";
import type {
  GuildMusicSession,
  SessionSnapshot,
} from "../guild-music-session.ts";

const EMPTY_QUEUE_REPLY = "Nothing is playing and the queue is empty.";
const IDLE_LEFTOVER_HEADER = "Nothing is playing.";
const UPCOMING_DISPLAY_LIMIT = 10;

/** Slash command payload for `/queue`. */
export const queueSlashData = new SlashCommandBuilder()
  .setName("queue")
  .setDescription("Show the current track and the queue.");

/**
 * Replies with the current track, or leftover upcoming when idle, up to 10 entries.
 * Transport-agnostic: no Interaction or Message.
 * @param ctx - Thin command input from either door.
 * @param session - Guild playback session, or `undefined` when none exists.
 * @returns Resolves after a reply is sent.
 */
export async function executeQueue(
  ctx: CommandContext,
  session: GuildMusicSession | undefined,
): Promise<void> {
  const snapshot: SessionSnapshot =
    session === undefined
      ? { current: null, upcoming: [] }
      : session.snapshot();
  await ctx.reply(formatQueueText(snapshot));
}

function formatQueueText(snapshot: SessionSnapshot): string {
  const { current, upcoming } = snapshot;
  if (current === null && upcoming.length === 0) {
    return EMPTY_QUEUE_REPLY;
  }
  const lines: string[] = [];
  if (current !== null) {
    lines.push(formatNowLine(current));
  } else {
    lines.push(IDLE_LEFTOVER_HEADER);
  }
  lines.push(...upcoming.slice(0, UPCOMING_DISPLAY_LIMIT).map(formatUpcomingLine));
  if (upcoming.length > UPCOMING_DISPLAY_LIMIT) {
    lines.push(`…and ${upcoming.length - UPCOMING_DISPLAY_LIMIT} more.`);
  }
  return lines.join("\n");
}

function formatNowLine(track: Track): string {
  return `Now: ${track.title} (${formatDuration(track.durationSeconds)})`;
}

function formatUpcomingLine(track: Track, index: number): string {
  return `${index + 1}. ${track.title} (${formatDuration(track.durationSeconds)})`;
}
