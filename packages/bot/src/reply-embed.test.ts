import { describe, expect, test } from "bun:test";

import {
  EMBED_COLOR,
  buildNoticeEmbed,
  formatProgressBar,
  recordedReplyText,
  replyEmbed,
  youtubeThumbnailUrl,
} from "./reply-embed.ts";

describe("EMBED_COLOR", () => {
  test("uses the four notice colors", () => {
    expect(EMBED_COLOR.ok).toBe(0x2ecc71);
    expect(EMBED_COLOR.info).toBe(0x5865f2);
    expect(EMBED_COLOR.warn).toBe(0xf1c40f);
    expect(EMBED_COLOR.error).toBe(0xe74c3c);
  });
});

describe("youtubeThumbnailUrl", () => {
  test("maps watch, youtu.be, and shorts ids to hqdefault", () => {
    const expected: string = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
    expect(
      youtubeThumbnailUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe(expected);
    expect(youtubeThumbnailUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(expected);
    expect(
      youtubeThumbnailUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe(expected);
  });

  test("returns null when the uri is not a YouTube video", () => {
    expect(youtubeThumbnailUrl("https://soundcloud.com/artist/track")).toBeNull();
    expect(youtubeThumbnailUrl("not-a-url")).toBeNull();
  });
});

describe("formatProgressBar", () => {
  test("fills half of 100 seconds as 6 filled and 6 empty", () => {
    expect(formatProgressBar(50, 100)).toBe("▰▰▰▰▰▰▱▱▱▱▱▱");
  });

  test("returns empty when duration is not positive", () => {
    expect(formatProgressBar(10, 0)).toBe("");
  });
});

describe("buildNoticeEmbed", () => {
  test("sets description and color", () => {
    const embed: ReturnType<typeof buildNoticeEmbed> = buildNoticeEmbed({
      description: "Denied.",
      color: EMBED_COLOR.error,
    });
    expect(embed.description).toBe("Denied.");
    expect(embed.color).toBe(EMBED_COLOR.error);
  });
});

describe("replyEmbed", () => {
  test("wraps one notice embed", () => {
    const options: ReturnType<typeof replyEmbed> = replyEmbed({
      description: "Now playing.",
      color: EMBED_COLOR.ok,
    });
    expect(options.embeds).toHaveLength(1);
    expect(options.embeds?.[0]?.description).toBe("Now playing.");
  });
});

describe("recordedReplyText", () => {
  test("prefers the first embed description", () => {
    expect(
      recordedReplyText(
        "",
        replyEmbed({ description: "Denied.", color: EMBED_COLOR.error }),
      ),
    ).toBe("Denied.");
  });

  test("falls back to text", () => {
    expect(recordedReplyText("plain")).toBe("plain");
  });
});
