import { EmbedBuilder, type APIEmbed } from "discord.js";

import type { CommandReplyOptions } from "./command-context.ts";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PROGRESS_BAR_WIDTH = 12;

/** Notice embed colors for ok, info, warn, and error replies. */
export const EMBED_COLOR = {
  ok: 0x2ecc71,
  info: 0x5865f2,
  warn: 0xf1c40f,
  error: 0xe74c3c,
} as const;

/** Fields for a one-embed notice reply. */
export interface NoticeEmbedInput {
  readonly description: string;
  readonly color: number;
  readonly title?: string;
  readonly url?: string;
  readonly thumbnailUrl?: string;
}

/**
 * Builds one Discord notice embed from the given fields.
 * @param input - Description, color, and optional title, url, and thumbnail.
 * @returns A plain API embed.
 */
export function buildNoticeEmbed(input: NoticeEmbedInput): APIEmbed {
  const builder: EmbedBuilder = new EmbedBuilder()
    .setDescription(input.description)
    .setColor(input.color);
  if (input.title !== undefined) {
    builder.setTitle(input.title);
  }
  if (input.url !== undefined) {
    builder.setURL(input.url);
  }
  if (input.thumbnailUrl !== undefined) {
    builder.setThumbnail(input.thumbnailUrl);
  }
  return builder.toJSON();
}

/**
 * Wraps a notice embed for `reply("", options)` embed-only sends.
 * @param input - Notice embed fields.
 * @returns Reply options with exactly one embed.
 */
export function replyEmbed(input: NoticeEmbedInput): CommandReplyOptions {
  return { embeds: [buildNoticeEmbed(input)] };
}

/**
 * Maps a YouTube watch, youtu.be, or shorts URI to the hqdefault thumbnail.
 * @param uri - Track URI to inspect.
 * @returns Thumbnail URL, or `null` when the URI is not a YouTube video.
 */
export function youtubeThumbnailUrl(uri: string): string | null {
  const parsed: URL | null = parseUrl(uri);
  if (parsed === null) {
    return null;
  }
  const id: string | null = readYoutubeVideoId(parsed);
  if (id === null) {
    return null;
  }
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Builds a 12-cell progress bar. Filled cells use `▰`; empty cells use `▱`.
 * @param elapsedSeconds - Playback position in seconds.
 * @param durationSeconds - Track length in seconds.
 * @returns Twelve cells, or `""` when duration is not positive.
 */
export function formatProgressBar(
  elapsedSeconds: number,
  durationSeconds: number,
): string {
  if (durationSeconds <= 0) {
    return "";
  }
  const ratio: number = elapsedSeconds / durationSeconds;
  const filled: number = Math.min(
    PROGRESS_BAR_WIDTH,
    Math.max(0, Math.round(ratio * PROGRESS_BAR_WIDTH)),
  );
  return "▰".repeat(filled) + "▱".repeat(PROGRESS_BAR_WIDTH - filled);
}

/**
 * Picks the recorded reply string for tests. Prefers the first embed description.
 * @param text - Plain reply text.
 * @param options - Optional embeds from `reply`.
 * @returns Embed description when present; otherwise `text`.
 */
export function recordedReplyText(
  text: string,
  options?: CommandReplyOptions,
): string {
  return options?.embeds?.[0]?.description ?? text;
}

function parseUrl(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

function readYoutubeVideoId(parsed: URL): string | null {
  const host: string = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host === "youtu.be") {
    return validYoutubeId(parsed.pathname.split("/")[1] ?? "");
  }
  if (!host.endsWith("youtube.com")) {
    return null;
  }
  const path: string = parsed.pathname.replace(/\/+$/, "");
  if (path === "/watch") {
    return validYoutubeId(parsed.searchParams.get("v") ?? "");
  }
  const shortsParts: readonly string[] = path.split("/");
  if (shortsParts[1] === "shorts") {
    return validYoutubeId(shortsParts[2] ?? "");
  }
  return null;
}

function validYoutubeId(id: string): string | null {
  if (!YOUTUBE_VIDEO_ID.test(id)) {
    return null;
  }
  return id;
}
