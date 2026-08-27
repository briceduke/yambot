import { describe, expect, test } from "bun:test";
import type { ResolveResult } from "@yambot/audio-engine";

import type { CommandContext } from "./command-context.ts";
import type { EnginePort, GuildMusicSession } from "./guild-music-session.ts";
import { dispatchCommand, readPrefixDoorCommand } from "./main.ts";
import { registeredSlashNames } from "./register-commands.ts";

describe("dispatchCommand", () => {
  test("slash-like and prefix-like play both run executePlay", async () => {
    const slashCtx = createContext({
      args: "never gonna",
      invokerVoiceChannelId: null,
    });
    await dispatchCommand("play", slashCtx, new FakePlaySession().asGuildSession());
    expect(slashCtx.replies).toEqual(["Join a voice channel first."]);

    const parsed = readPrefixDoorCommand({
      content: "!play never gonna",
      prefix: "!",
      isBot: false,
      inGuild: true,
    });
    expect(parsed).toEqual({ name: "play", args: "never gonna" });
    const prefixCtx = createContext({
      args: parsed?.args ?? "",
      invokerVoiceChannelId: null,
    });
    await dispatchCommand(
      parsed?.name ?? "",
      prefixCtx,
      new FakePlaySession().asGuildSession(),
    );
    expect(prefixCtx.replies).toEqual(["Join a voice channel first."]);
  });

  test("slash-like and prefix-like scsearch both run executeScsearch", async () => {
    const slashCtx = createContext({
      args: "lofi beats",
      invokerVoiceChannelId: null,
    });
    await dispatchCommand(
      "scsearch",
      slashCtx,
      new FakePlaySession().asGuildSession(),
    );
    expect(slashCtx.replies).toEqual(["Join a voice channel first."]);

    const parsed = readPrefixDoorCommand({
      content: "!scsearch lofi beats",
      prefix: "!",
      isBot: false,
      inGuild: true,
    });
    expect(parsed).toEqual({ name: "scsearch", args: "lofi beats" });
    const prefixCtx = createContext({
      args: parsed?.args ?? "",
      invokerVoiceChannelId: null,
    });
    await dispatchCommand(
      parsed?.name ?? "",
      prefixCtx,
      new FakePlaySession().asGuildSession(),
    );
    expect(prefixCtx.replies).toEqual(["Join a voice channel first."]);
  });

  test("slash-like and prefix-like skip both run executeSkip", async () => {
    const slashCtx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("skip", slashCtx, undefined);
    expect(slashCtx.replies).toEqual(["Nothing is playing."]);

    const parsed = readPrefixDoorCommand({
      content: "!skip",
      prefix: "!",
      isBot: false,
      inGuild: true,
    });
    expect(parsed).toEqual({ name: "skip", args: "" });
    const prefixCtx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("skip", prefixCtx, undefined);
    expect(prefixCtx.replies).toEqual(["Nothing is playing."]);
  });

  test("slash-like and prefix-like queue both run executeQueue", async () => {
    const slashCtx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("queue", slashCtx, undefined);
    expect(slashCtx.replies).toEqual([
      "Nothing is playing and the queue is empty.",
    ]);

    const parsed = readPrefixDoorCommand({
      content: "!queue",
      prefix: "!",
      isBot: false,
      inGuild: true,
    });
    expect(parsed).toEqual({ name: "queue", args: "" });
    const prefixCtx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("queue", prefixCtx, undefined);
    expect(prefixCtx.replies).toEqual([
      "Nothing is playing and the queue is empty.",
    ]);
  });

  test("unknown command names do not reply", async () => {
    const ctx = createContext({ args: "me", invokerVoiceChannelId: null });
    await dispatchCommand("help", ctx, undefined);
    expect(ctx.replies).toEqual([]);
  });

  test("prefix !np runs nowplaying", async () => {
    const parsed = readPrefixDoorCommand({
      content: "!np",
      prefix: "!",
      isBot: false,
      inGuild: true,
    });
    expect(parsed).toEqual({ name: "nowplaying", args: "" });
    const ctx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand(parsed?.name ?? "", ctx, undefined);
    expect(ctx.replies).toEqual(["Nothing is playing."]);
  });

  test("prefix !leave runs stop", async () => {
    const parsed = readPrefixDoorCommand({
      content: "!leave",
      prefix: "!",
      isBot: false,
      inGuild: true,
    });
    expect(parsed).toEqual({ name: "stop", args: "" });
    const ctx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand(parsed?.name ?? "", ctx, undefined);
    expect(ctx.replies).toEqual(["Nothing is playing."]);
  });

  test("slash names np and leave are unknown", async () => {
    const npCtx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("np", npCtx, undefined);
    expect(npCtx.replies).toEqual([]);

    const leaveCtx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("leave", leaveCtx, undefined);
    expect(leaveCtx.replies).toEqual([]);
  });

  test("remove with args 1 runs executeRemove", async () => {
    const ctx = createContext({ args: "1", invokerVoiceChannelId: null });
    await dispatchCommand("remove", ctx, undefined);
    expect(ctx.replies).toEqual(["No track at position 1."]);
  });
});

describe("readPrefixDoorCommand", () => {
  test("ignores bot messages", () => {
    expect(
      readPrefixDoorCommand({
        content: "!play never gonna",
        prefix: "!",
        isBot: true,
        inGuild: true,
      }),
    ).toBeNull();
  });

  test("ignores unknown command names", () => {
    expect(
      readPrefixDoorCommand({
        content: "!help me",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toBeNull();
  });

  test("parses !play never gonna into play with args never gonna", () => {
    expect(
      readPrefixDoorCommand({
        content: "!play never gonna",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "play", args: "never gonna" });
  });

  test("parses !scsearch words", () => {
    expect(
      readPrefixDoorCommand({
        content: "!scsearch lofi beats",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "scsearch", args: "lofi beats" });
  });

  test("accepts the seven new canonical prefix names", () => {
    const names: readonly string[] = [
      "pause",
      "resume",
      "nowplaying",
      "remove",
      "shuffle",
      "clear",
      "stop",
    ];
    for (const name of names) {
      expect(
        readPrefixDoorCommand({
          content: `!${name}`,
          prefix: "!",
          isBot: false,
          inGuild: true,
        }),
      ).toEqual({ name, args: "" });
    }
  });
});

describe("registeredSlashNames", () => {
  test("exported registration names are the eleven canonical slash names", () => {
    expect(registeredSlashNames).toEqual([
      "play",
      "scsearch",
      "skip",
      "queue",
      "pause",
      "resume",
      "nowplaying",
      "remove",
      "shuffle",
      "clear",
      "stop",
    ]);
    expect(registeredSlashNames).not.toContain("np");
    expect(registeredSlashNames).not.toContain("leave");
  });
});

class FakeContext implements CommandContext {
  readonly guildId = "guild-1";
  readonly channelId = "text-1";
  readonly invokerVoiceChannelId: string | null;
  readonly args: string;
  readonly replies: string[] = [];

  constructor(input: {
    readonly args: string;
    readonly invokerVoiceChannelId: string | null;
  }) {
    this.args = input.args;
    this.invokerVoiceChannelId = input.invokerVoiceChannelId;
  }

  async reply(text: string): Promise<void> {
    this.replies.push(text);
  }
}

class FakePlaySession {
  readonly engine: EnginePort = {
    resolveTrack: async (): Promise<ResolveResult> => {
      throw new Error("resolveTrack is not used by door tests");
    },
    openTrackAudio: async (): Promise<never> => {
      throw new Error("openTrackAudio is not used by door tests");
    },
  };

  isOccupiedInOtherChannel(_invokerVoiceChannelId: string): boolean {
    return false;
  }

  asGuildSession(): GuildMusicSession {
    return this as unknown as GuildMusicSession;
  }
}

function createContext(input: {
  readonly args: string;
  readonly invokerVoiceChannelId: string | null;
}): FakeContext {
  return new FakeContext(input);
}
