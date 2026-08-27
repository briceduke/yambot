import { describe, expect, test } from "bun:test";

import { parsePrefixMessage, readCommandPrefix } from "./prefix.ts";

describe("parsePrefixMessage", () => {
  test("returns null for bot messages", () => {
    expect(
      parsePrefixMessage({
        content: "!play never gonna give you up",
        prefix: "!",
        isBot: true,
        inGuild: true,
      }),
    ).toBeNull();
  });

  test("returns null for messages outside a guild", () => {
    expect(
      parsePrefixMessage({
        content: "!play never gonna give you up",
        prefix: "!",
        isBot: false,
        inGuild: false,
      }),
    ).toBeNull();
  });

  test("returns null when content does not start with the prefix", () => {
    expect(
      parsePrefixMessage({
        content: "play never gonna give you up",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toBeNull();
  });

  test("parses a name and remaining args", () => {
    expect(
      parsePrefixMessage({
        content: "!play never gonna give you up",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "play", args: "never gonna give you up" });
  });

  test("lowercases the command name and trims empty args", () => {
    expect(
      parsePrefixMessage({
        content: "!SKIP",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "skip", args: "" });
  });

  test("returns unknown names so doors can drop them", () => {
    expect(
      parsePrefixMessage({
        content: "!help me",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "help", args: "me" });
  });

  test("parses a user mention form as prefix", () => {
    expect(
      parsePrefixMessage({
        content: "<@bot123>skip",
        prefix: "!",
        isBot: false,
        inGuild: true,
        botUserId: "bot123",
      }),
    ).toEqual({ name: "skip", args: "" });
  });

  test("parses a nickname mention form as prefix", () => {
    expect(
      parsePrefixMessage({
        content: "<@!bot123>skip",
        prefix: "!",
        isBot: false,
        inGuild: true,
        botUserId: "bot123",
      }),
    ).toEqual({ name: "skip", args: "" });
  });

  test("parses mention prefix with args", () => {
    expect(
      parsePrefixMessage({
        content: "<@bot123> play never gonna give you up",
        prefix: "!",
        isBot: false,
        inGuild: true,
        botUserId: "bot123",
      }),
    ).toEqual({ name: "play", args: "never gonna give you up" });
  });

  test("returns null when mention remainder is empty", () => {
    expect(
      parsePrefixMessage({
        content: "<@bot123>",
        prefix: "!",
        isBot: false,
        inGuild: true,
        botUserId: "bot123",
      }),
    ).toBeNull();
  });

  test("still parses the string prefix when botUserId is set", () => {
    expect(
      parsePrefixMessage({
        content: "!play never gonna give you up",
        prefix: "!",
        isBot: false,
        inGuild: true,
        botUserId: "bot123",
      }),
    ).toEqual({ name: "play", args: "never gonna give you up" });
  });

  test("does not treat a mention as a command when botUserId is unset", () => {
    expect(
      parsePrefixMessage({
        content: "<@x>play",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toBeNull();
  });

  test("returns null for bot messages that mention the bot", () => {
    expect(
      parsePrefixMessage({
        content: "<@bot123>skip",
        prefix: "!",
        isBot: true,
        inGuild: true,
        botUserId: "bot123",
      }),
    ).toBeNull();
  });

  test("returns null for DM messages that mention the bot", () => {
    expect(
      parsePrefixMessage({
        content: "<@bot123>skip",
        prefix: "!",
        isBot: false,
        inGuild: false,
        botUserId: "bot123",
      }),
    ).toBeNull();
  });
});

describe("readCommandPrefix", () => {
  test("defaults to ! when COMMAND_PREFIX is missing", () => {
    expect(readCommandPrefix({})).toBe("!");
  });

  test("reads COMMAND_PREFIX from env", () => {
    expect(readCommandPrefix({ COMMAND_PREFIX: "?" })).toBe("?");
  });
});
