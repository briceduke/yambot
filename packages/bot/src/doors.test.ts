import { afterEach, describe, expect, test } from "bun:test";
import type { ResolveResult } from "@yambot/audio-engine";

import type { CommandContext } from "./command-context.ts";
import {
  ADMIN_DENY_REPLY,
  DJ_DENY_REPLY,
  applyDoorGates,
  boundTextChannelReply,
  boundVoiceChannelReply,
} from "./door-gates.ts";
import type { EnginePort, GuildMusicSession } from "./guild-music-session.ts";
import { dispatchCommand, readPrefixDoorCommand } from "./main.ts";
import {
  clearAllOverlays,
  setGuildOverlayDjRoleId,
  setGuildOverlayTextChannelId,
  setGuildOverlayVoiceChannelId,
} from "./operator-config.ts";
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
    await dispatchCommand("bogus", ctx, undefined);
    expect(ctx.replies).toEqual([]);
  });

  test("slash-like help runs executeHelp", async () => {
    const ctx = createContext({ args: "", invokerVoiceChannelId: null });
    await dispatchCommand("help", ctx, undefined);
    expect(ctx.replies[0]).toContain("Music: play");
    expect(ctx.replies[0]).toContain("Admin (Manage Server)");
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
        content: "!bogus me",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toBeNull();
  });

  test("parses !help", () => {
    expect(
      readPrefixDoorCommand({
        content: "!help",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "help", args: "" });
  });

  test("alias setprefix maps to prefix", () => {
    expect(
      readPrefixDoorCommand({
        content: "!setprefix none",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "prefix", args: "none" });
  });

  test("alias status maps to settings", () => {
    expect(
      readPrefixDoorCommand({
        content: "!status",
        prefix: "!",
        isBot: false,
        inGuild: true,
      }),
    ).toEqual({ name: "settings", args: "" });
  });

  test("parses a bot mention as prefix", () => {
    expect(
      readPrefixDoorCommand({
        content: "<@bot-1> skip",
        prefix: "!",
        isBot: false,
        inGuild: true,
        botUserId: "bot-1",
      }),
    ).toEqual({ name: "skip", args: "" });
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
  test("exported registration names are the canonical slash names", () => {
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
      "help",
      "settings",
      "setdj",
      "prefix",
      "settc",
      "setvc",
    ]);
    expect(registeredSlashNames).not.toContain("np");
    expect(registeredSlashNames).not.toContain("leave");
    expect(registeredSlashNames).not.toContain("setprefix");
    expect(registeredSlashNames).not.toContain("status");
  });
});

describe("applyDoorGates", () => {
  afterEach(() => {
    clearAllOverlays();
  });

  test("denies admin commands when the invoker is not admin", () => {
    expect(gate({ name: "setdj", invokerIsAdmin: false })).toBe(
      ADMIN_DENY_REPLY,
    );
    expect(gate({ name: "prefix", invokerIsAdmin: false })).toBe(
      ADMIN_DENY_REPLY,
    );
  });

  test("allows admin commands when the invoker is admin", () => {
    expect(gate({ name: "setdj", invokerIsAdmin: true })).toBeNull();
  });

  test("DJ commands stay open when no DJ role is set", () => {
    expect(gate({ name: "pause", invokerIsAdmin: false })).toBeNull();
  });

  test("denies DJ commands when a role is set and the invoker lacks it", () => {
    setGuildOverlayDjRoleId("guild-1", "dj-role");
    expect(
      gate({
        name: "pause",
        invokerIsAdmin: false,
        invokerRoleIds: ["other-role"],
      }),
    ).toBe(DJ_DENY_REPLY);
  });

  test("allows DJ commands for the DJ role or an admin", () => {
    setGuildOverlayDjRoleId("guild-1", "dj-role");
    expect(
      gate({
        name: "skip",
        invokerIsAdmin: false,
        invokerRoleIds: ["dj-role"],
      }),
    ).toBeNull();
    expect(
      gate({
        name: "stop",
        invokerIsAdmin: true,
        invokerRoleIds: [],
      }),
    ).toBeNull();
  });

  test("denies music commands in the wrong text channel", () => {
    setGuildOverlayTextChannelId("guild-1", "music-1");
    expect(gate({ name: "queue", channelId: "general-1" })).toBe(
      boundTextChannelReply("music-1"),
    );
    expect(gate({ name: "queue", channelId: "music-1" })).toBeNull();
    expect(gate({ name: "help", channelId: "general-1" })).toBeNull();
  });

  test("denies play when the invoker is not in the bound voice channel", () => {
    setGuildOverlayVoiceChannelId("guild-1", "voice-a");
    expect(
      gate({
        name: "play",
        invokerVoiceChannelId: "voice-b",
        boundVoiceChannelName: "Music",
      }),
    ).toBe(boundVoiceChannelReply("Music"));
    expect(
      gate({
        name: "play",
        invokerVoiceChannelId: "voice-a",
        boundVoiceChannelName: "Music",
      }),
    ).toBeNull();
    expect(
      gate({
        name: "play",
        invokerVoiceChannelId: null,
        boundVoiceChannelName: null,
      }),
    ).toBe(boundVoiceChannelReply(null));
  });
});

function gate(input: {
  readonly name: string;
  readonly invokerIsAdmin?: boolean;
  readonly invokerRoleIds?: readonly string[];
  readonly channelId?: string;
  readonly invokerVoiceChannelId?: string | null;
  readonly boundVoiceChannelName?: string | null;
}): string | null {
  return applyDoorGates({
    name: input.name,
    guildId: "guild-1",
    channelId: input.channelId ?? "text-1",
    invokerVoiceChannelId: input.invokerVoiceChannelId ?? "voice-1",
    invokerIsAdmin: input.invokerIsAdmin ?? false,
    invokerRoleIds: input.invokerRoleIds ?? [],
    env: {},
    boundVoiceChannelName: input.boundVoiceChannelName ?? null,
  });
}

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
